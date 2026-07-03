import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ServerConfig } from '../registry.js';
import { logger } from '../logger.js';

export interface DownstreamConnection {
  client: Client;
  transport: StdioClientTransport;
  tools: Array<{ name: string; description?: string; inputSchema?: unknown }>;
}

export async function connectStdio(name: string, config: ServerConfig): Promise<DownstreamConnection> {
  if (!config.command) throw new Error(`Server "${name}" missing command`);

  logger.info(`Spawning stdio downstream: ${name}`, { command: config.command, args: config.args });

  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args || [],
    env: { ...process.env, ...(config.env || {}) } as Record<string, string>,
  });

  const client = new Client({ name: `mux->${name}`, version: '0.1.0' });
  await client.connect(transport);

  const { tools } = await client.listTools();
  logger.info(`Connected to ${name}: ${tools.length} tools available`);

  return { client, transport, tools };
}

export async function disconnectStdio(conn: DownstreamConnection): Promise<void> {
  try {
    await conn.transport.close();
  } catch {
    // ignore close errors
  }
}
