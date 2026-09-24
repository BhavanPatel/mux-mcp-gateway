/**
 * Hook to read metrics data for the TUI dashboard.
 * Reads directly from ~/.mux/metrics.json.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

interface MetricEvent {
  ts: number;
  type: string;
  server?: string;
  durationMs?: number;
}

export interface MetricsData {
  totalCalls: number;
  callsToday: number;
  callsLast7d: number;
  successRate: number;
  avgLatencyMs: number;
  callsPerServer: Record<string, number>;
  topServers: Array<{ name: string; calls: number }>;
  /** Real per-day call counts, last 14 days, oldest first (WS-C5). */
  dailyActivity: number[];
}

const METRICS_PATH = resolve(homedir(), '.mux', 'metrics.json');

const ACTIVITY_DAYS = 14;

export function useMetrics(): MetricsData {
  const empty: MetricsData = {
    totalCalls: 0,
    callsToday: 0,
    callsLast7d: 0,
    successRate: 100,
    avgLatencyMs: 0,
    callsPerServer: {},
    topServers: [],
    dailyActivity: new Array(ACTIVITY_DAYS).fill(0),
  };

  try {
    if (!existsSync(METRICS_PATH)) return empty;

    const raw = JSON.parse(readFileSync(METRICS_PATH, 'utf-8'));
    const events: MetricEvent[] = raw.events || [];

    const calls = events.filter((e) => e.type === 'call');
    const errors = events.filter((e) => e.type === 'error');
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const callsToday = calls.filter((e) => e.ts >= todayStart).length;
    const callsLast7d = calls.filter((e) => e.ts >= Date.now() - 7 * 86400_000).length;

    // Real per-day buckets for the activity chart — no synthesis (WS-C5).
    const dailyActivity = new Array(ACTIVITY_DAYS).fill(0);
    for (const e of calls) {
      const dayStart = new Date(e.ts).setHours(0, 0, 0, 0);
      const idx = ACTIVITY_DAYS - 1 - Math.round((todayStart - dayStart) / 86400_000);
      if (idx >= 0 && idx < ACTIVITY_DAYS) dailyActivity[idx] += 1;
    }

    const durations = calls.filter((e) => e.durationMs).map((e) => e.durationMs!);
    const avgLatencyMs = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

    const totalCalls = calls.length;
    const successRate = totalCalls > 0 ? Math.round(((totalCalls - errors.length) / totalCalls) * 1000) / 10 : 100;

    // Calls per server
    const callsPerServer: Record<string, number> = {};
    for (const e of calls) {
      if (e.server) {
        callsPerServer[e.server] = (callsPerServer[e.server] || 0) + 1;
      }
    }

    // Top servers sorted by call count
    const topServers = Object.entries(callsPerServer)
      .map(([name, count]) => ({ name, calls: count }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 5);

    return {
      totalCalls,
      callsToday,
      callsLast7d,
      successRate,
      avgLatencyMs,
      callsPerServer,
      topServers,
      dailyActivity,
    };
  } catch {
    return empty;
  }
}
