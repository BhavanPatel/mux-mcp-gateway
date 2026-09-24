import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { getServer, resolveServerName, ServerConfig } from './registry.js';
import { connectStdio, DownstreamConnection } from './transport/stdio.js';
import { connectHttp, HttpDownstreamConnection } from './transport/http.js';
import { storeToolsForServer } from './tool-catalog.js';
import { generateAndStoreKeywords } from './keyword-extractor.js';
import { record } from './metrics.js';
import { logger, newCorrelationId } from './logger.js';
import { redactArgs } from './redact.js';
import {
  MAX_RETRIES,
  CONNECT_TIMEOUT_MS,
  CALL_TIMEOUT_MS,
  POOL_MAX_SIZE,
  NEGATIVE_CACHE_TTL_MS,
  backoffDelay,
  sleep,
  classifyError,
  CircuitBreaker,
} from './pool-policy.js';

const DEFAULT_IDLE_TIMEOUT_MS = parseInt(process.env.MUX_DEFAULT_IDLE_TIMEOUT || '300000', 10);

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
  /** Set while auth or an in-flight call is running — blocks the idle reaper. */
  busy: boolean;
}

const pool = new Map<string, PoolEntry>();

// --- Resilience state (WS-A3) ---
/** In-flight connect promises, keyed by server name (dedupe concurrent connects). */
const connecting = new Map<string, Promise<PoolEntry>>();
/** Per-server circuit breakers. */
const breakers = new Map<string, CircuitBreaker>();
/** Negative cache: server name -> last spawn-failure timestamp + reason. */
interface NegativeCacheEntry {
  ts: number;
  reason: string;
}
const negativeCache = new Map<string, NegativeCacheEntry>();

/** Raw connector, overridable in tests. */
type Connector = (name: string, config: ServerConfig) => Promise<DownstreamConnection | HttpDownstreamConnection>;
const defaultConnector: Connector = (name, config) =>
  config.transport === 'http' ? connectHttp(name, config) : connectStdio(name, config);
let connector: Connector = defaultConnector;

function getBreaker(name: string): CircuitBreaker {
  let cb = breakers.get(name);
  if (!cb) {
    cb = new CircuitBreaker();
    breakers.set(name, cb);
  }
  return cb;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms);
    timer.unref?.();
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function scheduleIdle(entry: PoolEntry): void {
  clearTimeout(entry.idleTimer);
  const timeout = entry.config.idleTimeoutMs || DEFAULT_IDLE_TIMEOUT_MS;
  entry.idleTimer = setTimeout(() => {
    // Never reap a connection mid-auth or mid-call — reschedule instead.
    if (entry.busy) {
      logger.debug(`Idle timer fired for "${entry.name}" while busy; rescheduling`);
      scheduleIdle(entry);
      return;
    }
    logger.info(`Idle timeout reached for "${entry.name}", disconnecting...`);
    disconnect(entry.name);
  }, timeout);
  entry.idleTimer.unref?.();
}

/** Evict the least-recently-used idle (non-busy) entry to honour the pool cap. */
async function evictLruIfFull(): Promise<void> {
  if (pool.size < POOL_MAX_SIZE) return;
  let lru: PoolEntry | undefined;
  for (const entry of pool.values()) {
    if (entry.busy) continue;
    if (!lru || entry.lastUsed < lru.lastUsed) lru = entry;
  }
  if (lru) {
    logger.info(`Pool at capacity (${pool.size}/${POOL_MAX_SIZE}), evicting LRU "${lru.name}"`);
    await disconnect(lru.name);
  } else {
    logger.warn(`Pool at capacity (${pool.size}/${POOL_MAX_SIZE}) and all entries busy`);
  }
}

async function connect(name: string): Promise<PoolEntry> {
  const config = getServer(name);
  if (!config) throw new Error(`Server "${name}" not found in registry`);

  await evictLruIfFull();

  const connection = await withTimeout(connector(name, config), CONNECT_TIMEOUT_MS, `connect("${name}")`);

  const entry: PoolEntry = {
    name,
    client: connection.client,
    transport: connection.transport,
    tools: connection.tools,
    config,
    lastUsed: Date.now(),
    idleTimer: setTimeout(() => {}, 0),
    busy: false,
  };

  storeToolsForServer(name, connection.tools);
  record({ ts: Date.now(), type: 'spawn', server: name, toolCount: connection.tools.length });
  generateAndStoreKeywords(name, connection.tools);

  scheduleIdle(entry);
  pool.set(name, entry);
  negativeCache.delete(name);
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

  // In-flight connect dedupe: concurrent callers share one connect (and its
  // auth/refresh). Folds in the deferred WS-A2 "dedupe concurrent refreshes".
  const inFlight = connecting.get(resolved);
  if (inFlight) return inFlight;

  // Circuit breaker: a dead downstream must not cost a cold spawn per call.
  const breaker = getBreaker(resolved);
  if (!breaker.canAttempt()) {
    const neg = negativeCache.get(resolved);
    const reason = neg ? ` (last failure: ${neg.reason})` : '';
    throw new Error(
      `Server "${resolved}" circuit open — ${Math.ceil(breaker.cooldownRemaining() / 1000)}s cooldown${reason}`,
    );
  }

  const promise = connect(resolved)
    .then((entry) => {
      breaker.recordSuccess();
      return entry;
    })
    .catch((err: any) => {
      breaker.recordFailure();
      negativeCache.set(resolved, { ts: Date.now(), reason: err?.message || 'connect failed' });
      throw err;
    })
    .finally(() => {
      connecting.delete(resolved);
    });

  connecting.set(resolved, promise);
  return promise;
}

export async function callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
  let lastError: Error | undefined;
  const cid = newCorrelationId();
  const log = logger.child(cid);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const entry = await getOrConnect(serverName);
    entry.lastUsed = Date.now();
    entry.busy = true;
    scheduleIdle(entry);

    try {
      log.debug(`Routing call: ${serverName}.${toolName} (attempt ${attempt + 1})`, {
        args: redactArgs(args),
      });
      const start = Date.now();
      const result = await withTimeout(
        entry.client.callTool({ name: toolName, arguments: args }),
        CALL_TIMEOUT_MS,
        `callTool("${serverName}.${toolName}")`,
      );
      record({ ts: Date.now(), type: 'call', server: serverName, durationMs: Date.now() - start });
      return result;
    } catch (err: any) {
      lastError = err;
      const kind = classifyError(err);
      log.warn(`Call failed for ${serverName}.${toolName} (${kind}): ${err.message}`);

      // Validation errors are not transient: replaying doubles side effects
      // for non-idempotent tools. Surface immediately, no reconnect/retry.
      if (kind === 'validation') {
        record({ ts: Date.now(), type: 'error', server: serverName });
        throw err;
      }

      await disconnect(serverName);

      if (attempt < MAX_RETRIES) {
        const delay = backoffDelay(attempt);
        log.info(`Retrying ${serverName}.${toolName} after ${delay}ms backoff...`);
        await sleep(delay);
      }
    } finally {
      // entry may have been deleted by disconnect(); guard the flag write.
      const live = pool.get(serverName);
      if (live) live.busy = false;
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

/** Health signal for tool-catalog: is a server currently negatively cached / breaker-open? */
export function getServerHealth(name: string): { healthy: boolean; reason?: string; cooldownMs?: number } {
  const breaker = breakers.get(name);
  if (breaker && !breaker.canAttempt()) {
    const neg = negativeCache.get(name);
    return { healthy: false, reason: neg?.reason || 'circuit open', cooldownMs: breaker.cooldownRemaining() };
  }
  const neg = negativeCache.get(name);
  if (neg && Date.now() - neg.ts < NEGATIVE_CACHE_TTL_MS) {
    return { healthy: false, reason: neg.reason };
  }
  return { healthy: true };
}

export async function disconnectAll(): Promise<void> {
  const names = Array.from(pool.keys());
  await Promise.all(names.map(disconnect));
  logger.info('All downstream connections closed');
}

// --- Test seams (only used by unit/e2e harnesses) ---
export function __setConnectorForTest(fn: Connector | null): void {
  connector = fn ?? defaultConnector;
}

export function __resetPoolForTest(): void {
  for (const entry of pool.values()) clearTimeout(entry.idleTimer);
  pool.clear();
  connecting.clear();
  breakers.clear();
  negativeCache.clear();
}
