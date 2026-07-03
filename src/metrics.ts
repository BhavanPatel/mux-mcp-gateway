import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { logger } from './logger.js';

const METRICS_PATH = resolve(homedir(), '.mux', 'metrics.json');

export interface MetricEvent {
  ts: number; // unix ms
  type: 'call' | 'spawn' | 'kill' | 'auth_hit' | 'auth_refresh' | 'auth_flow' | 'error';
  server?: string;
  durationMs?: number;
  toolCount?: number;
}

interface MetricsStore {
  events: MetricEvent[];
  firstSeen: number;
}

let store: MetricsStore = { events: [], firstSeen: Date.now() };
let dirty = false;

function ensureDir() {
  const dir = dirname(METRICS_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function loadMetrics(): void {
  try {
    if (existsSync(METRICS_PATH)) {
      store = JSON.parse(readFileSync(METRICS_PATH, 'utf-8'));
    }
  } catch {
    store = { events: [], firstSeen: Date.now() };
  }
}

function persist(): void {
  if (!dirty) return;
  try {
    ensureDir();
    writeFileSync(METRICS_PATH, JSON.stringify(store), 'utf-8');
    dirty = false;
  } catch (err: any) {
    logger.debug(`Failed to persist metrics: ${err.message}`);
  }
}

export function record(event: MetricEvent): void {
  store.events.push(event);
  dirty = true;
  // Persist every 10 events or on important events
  if (store.events.length % 10 === 0 || event.type === 'auth_flow') {
    persist();
  }
}

export function flushMetrics(): void {
  persist();
}

// ---- Aggregation ----

interface TimeRange {
  label: string;
  since: number;
}

function getTimeRanges(): TimeRange[] {
  const now = Date.now();
  return [
    { label: 'yesterday', since: now - 86400_000 },
    { label: 'last_week', since: now - 7 * 86400_000 },
    { label: 'last_15_days', since: now - 15 * 86400_000 },
    { label: 'last_month', since: now - 30 * 86400_000 },
    { label: 'last_6_months', since: now - 180 * 86400_000 },
    { label: 'all_time', since: 0 },
  ];
}

export interface AggregatedMetrics {
  period: string;
  totalCalls: number;
  totalSpawns: number;
  totalKills: number;
  authCacheHits: number;
  authRefreshes: number;
  authFlows: number;
  errors: number;
  avgResponseMs: number;
  topServers: Array<{ name: string; calls: number }>;
  contextReductionPct: number;
  estimatedTokensSaved: number;
}

function aggregate(since: number): Omit<AggregatedMetrics, 'period'> {
  const events = store.events.filter(e => e.ts >= since);

  const calls = events.filter(e => e.type === 'call');
  const spawns = events.filter(e => e.type === 'spawn');
  const kills = events.filter(e => e.type === 'kill');
  const authHits = events.filter(e => e.type === 'auth_hit');
  const authRefreshes = events.filter(e => e.type === 'auth_refresh');
  const authFlows = events.filter(e => e.type === 'auth_flow');
  const errors = events.filter(e => e.type === 'error');

  const durations = calls.filter(e => e.durationMs).map(e => e.durationMs!);
  const avgResponseMs = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

  // Top servers by call count
  const serverCounts = new Map<string, number>();
  for (const e of calls) {
    if (e.server) serverCounts.set(e.server, (serverCounts.get(e.server) || 0) + 1);
  }
  const topServers = [...serverCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, calls: count }));

  // Context reduction: without Mux all downstream tools are in context.
  // With Mux only 4 tools are exposed. Calculate % reduction from spawn toolCounts.
  const spawnToolCounts = spawns.filter(e => e.toolCount).map(e => e.toolCount!);
  const totalDownstreamTools = spawnToolCounts.length > 0
    ? spawnToolCounts.reduce((a, b) => a + b, 0)
    : 0;
  const muxTools = 4;
  const contextReductionPct = totalDownstreamTools > muxTools
    ? Math.round((1 - muxTools / totalDownstreamTools) * 100)
    : 0;

  // Tokens saved estimate: ~200 tokens per tool definition, per message round-trip
  const tokensPerTool = 200;
  const estimatedTokensSaved = calls.length * Math.max(0, totalDownstreamTools - muxTools) * tokensPerTool;

  return {
    totalCalls: calls.length,
    totalSpawns: spawns.length,
    totalKills: kills.length,
    authCacheHits: authHits.length,
    authRefreshes: authRefreshes.length,
    authFlows: authFlows.length,
    errors: errors.length,
    avgResponseMs,
    topServers,
    contextReductionPct,
    estimatedTokensSaved,
  };
}

export function getInsights(): Record<string, AggregatedMetrics> {
  const ranges = getTimeRanges();
  const result: Record<string, AggregatedMetrics> = {};
  for (const r of ranges) {
    result[r.label] = { period: r.label, ...aggregate(r.since) };
  }
  return result;
}

export function getQuickStats(): {
  totalCalls: number;
  upSince: string;
  contextReductionPct: number;
  estimatedTokensSaved: number;
  topServer: string;
} {
  const all = aggregate(0);
  return {
    totalCalls: all.totalCalls,
    upSince: new Date(store.firstSeen).toISOString().split('T')[0],
    contextReductionPct: all.contextReductionPct,
    estimatedTokensSaved: all.estimatedTokensSaved,
    topServer: all.topServers[0]?.name || 'none',
  };
}

// Prune events older than 6 months to prevent unbounded growth
export function pruneOldEvents(): void {
  const cutoff = Date.now() - 180 * 86400_000;
  const before = store.events.length;
  store.events = store.events.filter(e => e.ts >= cutoff);
  if (store.events.length < before) {
    dirty = true;
    persist();
    logger.debug(`Pruned ${before - store.events.length} old metric events`);
  }
}
