import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs';
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

/**
 * Telemetry is LOCAL-ONLY (written to ~/.mux/metrics.json, never transmitted).
 * Respect the standard opt-out env vars anyway: when set, Mux records nothing
 * and writes nothing. See TELEMETRY.md.
 */
const telemetryDisabled = Boolean(process.env.MUX_NO_TELEMETRY) || Boolean(process.env.DO_NOT_TRACK);

function ensureDir() {
  const dir = dirname(METRICS_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    chmodSync(dir, 0o700);
  }
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
    chmodSync(METRICS_PATH, 0o600); // local-only data — owner read/write only
    dirty = false;
  } catch (err: any) {
    logger.debug(`Failed to persist metrics: ${err.message}`);
  }
}

export function record(event: MetricEvent): void {
  if (telemetryDisabled) return; // opt-out: record nothing
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
}

/**
 * Number of tools Mux exposes to the model, regardless of how many downstream
 * servers/tools exist: mux_list_servers, mux_call_tool, mux_find_tool,
 * mux_status. This is a real, fixed count (see server.ts), not an estimate.
 */
const MUX_EXPOSED_TOOL_COUNT = 4;

function aggregate(since: number): Omit<AggregatedMetrics, 'period'> {
  const events = store.events.filter((e) => e.ts >= since);

  const calls = events.filter((e) => e.type === 'call');
  const spawns = events.filter((e) => e.type === 'spawn');
  const kills = events.filter((e) => e.type === 'kill');
  const authHits = events.filter((e) => e.type === 'auth_hit');
  const authRefreshes = events.filter((e) => e.type === 'auth_refresh');
  const authFlows = events.filter((e) => e.type === 'auth_flow');
  const errors = events.filter((e) => e.type === 'error');

  const durations = calls.filter((e) => e.durationMs).map((e) => e.durationMs!);
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

  // Context reduction is MEASURED, not estimated: without Mux every downstream
  // tool sits in the model's context; with Mux only MUX_EXPOSED_TOOL_COUNT do.
  // Downstream tool counts come from real spawn events (spawn.toolCount).
  const spawnToolCounts = spawns.filter((e) => e.toolCount).map((e) => e.toolCount!);
  const totalDownstreamTools = spawnToolCounts.length > 0 ? spawnToolCounts.reduce((a, b) => a + b, 0) : 0;
  const contextReductionPct =
    totalDownstreamTools > MUX_EXPOSED_TOOL_COUNT
      ? Math.round((1 - MUX_EXPOSED_TOOL_COUNT / totalDownstreamTools) * 100)
      : 0;

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
  topServer: string;
} {
  const all = aggregate(0);
  return {
    totalCalls: all.totalCalls,
    upSince: new Date(store.firstSeen).toISOString().split('T')[0],
    contextReductionPct: all.contextReductionPct,
    topServer: all.topServers[0]?.name || 'none',
  };
}

/**
 * Real per-day call counts for the last `days` days, oldest first. Each bucket
 * is the measured number of `call` events whose ts falls in that local day.
 * No synthesis, no weighting — every bar is a real count. (WS-C5)
 */
export function getDailyActivity(days: number): number[] {
  const counts = new Array(days).fill(0);
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  for (const e of store.events) {
    if (e.type !== 'call') continue;
    const dayStart = new Date(e.ts).setHours(0, 0, 0, 0);
    const idx = days - 1 - Math.round((startOfToday - dayStart) / 86400_000);
    if (idx >= 0 && idx < days) counts[idx] += 1;
  }
  return counts;
}

// Prune events older than 6 months to prevent unbounded growth
export function pruneOldEvents(): void {
  const cutoff = Date.now() - 180 * 86400_000;
  const before = store.events.length;
  store.events = store.events.filter((e) => e.ts >= cutoff);
  if (store.events.length < before) {
    dirty = true;
    persist();
    logger.debug(`Pruned ${before - store.events.length} old metric events`);
  }
}
