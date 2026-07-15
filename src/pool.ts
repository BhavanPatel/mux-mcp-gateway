import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { getServer, resolveServerName, ServerConfig } from './registry.js';
import { connectStdio, DownstreamConnection } from './transport/stdio.js';
import { connectHttp, HttpDownstreamConnection } from './transport/http.js';
import { storeToolsForServer } from './tool-catalog.js';
import { generateAndStoreKeywords } from './keyword-extractor.js';
import { record } from './metrics.js';
import { logger } from './logger.js';

const DEFAULT_IDLE_TIMEOUT_MS = parseInt(process.env.MUX_DEFAULT_IDLE_TIMEOUT || '300000', 10);
const MAX_RETRIES = 1;

interface ToolSchema {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

interface PoolEntry {
  name: string;
  client: Client;
  transport: StdioClientTransport | StreamableHTTPClientTransport;
  tools: ToolSchema[];
  config: ServerConfig;
  lastUsed: number;
  idleTimer: ReturnType<typeof setTimeout>;
}

const pool = new Map<string, PoolEntry>();

function scheduleIdle(entry: PoolEntry): void {
  clearTimeout(entry.idleTimer);
  const timeout = entry.config.idleTimeoutMs || DEFAULT_IDLE_TIMEOUT_MS;
  entry.idleTimer = setTimeout(() => {
    logger.info(`Idle timeout reached for "${entry.name}", disconnecting...`);
    disconnect(entry.name);
  }, timeout);
}

async function connect(name: string): Promise<PoolEntry> {
  const config = getServer(name);
  if (!config) throw new Error(`Server "${name}" not found in registry`);

  let connection: DownstreamConnection | HttpDownstreamConnection;

  if (config.transport === 'http') {
    connection = await connectHttp(name, config);
  } else {
    connection = await connectStdio(name, config);
  }

  const entry: PoolEntry = {
    name,
    client: connection.client,
    transport: connection.transport,
    tools: connection.tools,
    config,
    lastUsed: Date.now(),
    idleTimer: setTimeout(() => {}, 0),
  };

  storeToolsForServer(name, connection.tools);
  record({ ts: Date.now(), type: 'spawn', server: name, toolCount: connection.tools.length });
  generateAndStoreKeywords(name, connection.tools);

  scheduleIdle(entry);
  pool.set(name, entry);
  return entry;
}

async function disconnect(name: string): Promise<void> {
  const entry = pool.get(name);
  if (!entry) return;

  clearTimeout(entry.idleTimer);
  pool.delete(name);

  try {
    if (entry.config.transport === 'http') {
      await (entry.transport as StreamableHTTPClientTransport).close();
    } else {
      await (entry.transport as StdioClientTransport).close();
    }
    record({ ts: Date.now(), type: 'kill', server: name });
    logger.info(`Disconnected: ${name}`);
  } catch (err: any) {
    logger.warn(`Error disconnecting ${name}: ${err.message}`);
  }
}

export async function getOrConnect(name: string): Promise<PoolEntry> {
  const resolved = resolveServerName(name);
  if (!resolved) throw new Error(`Server "${name}" not found in registry`);

  const existing = pool.get(resolved);
  if (existing) {
    existing.lastUsed = Date.now();
    scheduleIdle(existing);
    return existing;
  }

  return connect(resolved);
}

export async function callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const entry = await getOrConnect(serverName);
    entry.lastUsed = Date.now();
    scheduleIdle(entry);

    try {
      logger.debug(`Routing call: ${serverName}.${toolName} (attempt ${attempt + 1})`, { args });
      const start = Date.now();
      const result = await entry.client.callTool({ name: toolName, arguments: args });
      record({ ts: Date.now(), type: 'call', server: serverName, durationMs: Date.now() - start });
      return result;
    } catch (err: any) {
      lastError = err;
      logger.warn(`Call failed for ${serverName}.${toolName}: ${err.message}`);
      await disconnect(serverName);

      if (attempt < MAX_RETRIES) {
        logger.info(`Retrying ${serverName}.${toolName} after reconnect...`);
      }
    }
  }

  record({ ts: Date.now(), type: 'error', server: serverName });
  throw lastError;
}

export function getPoolStatus(): Array<{ name: string; status: 'active'; tools: number; idleMs: number }> {
  return Array.from(pool.entries()).map(([name, entry]) => ({
    name,
    status: 'active' as const,
    tools: entry.tools.length,
    idleMs: Date.now() - entry.lastUsed,
  }));
}

export async function disconnectAll(): Promise<void> {
  const names = Array.from(pool.keys());
  await Promise.all(names.map(disconnect));
  logger.info('All downstream connections closed');
}
