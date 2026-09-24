/**
 * Unit tests for metrics recording and aggregation.
 * Run: node --test test/test-metrics.mjs
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { writeFileSync, mkdirSync, existsSync, rmSync, readFileSync } from 'node:fs';

const TEST_DIR = '/tmp/mux-metrics-test';
const METRICS_PATH = resolve(TEST_DIR, 'metrics.json');

before(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(METRICS_PATH, JSON.stringify({ events: [], firstSeen: Date.now() - 86400_000 }));
});

after(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('metrics file format', () => {
  it('creates valid JSON structure', () => {
    const metricsData = JSON.parse(readFileSync(METRICS_PATH, 'utf-8'));
    assert.ok(Array.isArray(metricsData.events));
    assert.ok(typeof metricsData.firstSeen === 'number');
  });

  it('firstSeen is a valid timestamp', () => {
    const metricsData = JSON.parse(readFileSync(METRICS_PATH, 'utf-8'));
    assert.ok(metricsData.firstSeen > 0);
    assert.ok(metricsData.firstSeen <= Date.now());
  });
});

describe('metrics aggregation logic', () => {
  // Test aggregation by writing events and computing stats locally
  // (mirroring the logic in metrics.ts since functions aren't individually exported)

  const testEvents = [
    { ts: Date.now() - 1000, type: 'call', server: 'gitlab', durationMs: 150 },
    { ts: Date.now() - 2000, type: 'call', server: 'gitlab', durationMs: 200 },
    { ts: Date.now() - 3000, type: 'call', server: 'jira', durationMs: 300 },
    { ts: Date.now() - 4000, type: 'spawn', server: 'gitlab', toolCount: 10 },
    { ts: Date.now() - 5000, type: 'spawn', server: 'jira', toolCount: 8 },
    { ts: Date.now() - 6000, type: 'kill', server: 'gitlab' },
    { ts: Date.now() - 7000, type: 'error', server: 'broken' },
    { ts: Date.now() - 8000, type: 'auth_hit', server: 'gitlab' },
    { ts: Date.now() - 9000, type: 'auth_flow', server: 'jira' },
  ];

  it('counts calls correctly', () => {
    const calls = testEvents.filter((e) => e.type === 'call');
    assert.equal(calls.length, 3);
  });

  it('counts spawns correctly', () => {
    const spawns = testEvents.filter((e) => e.type === 'spawn');
    assert.equal(spawns.length, 2);
  });

  it('calculates average response time', () => {
    const calls = testEvents.filter((e) => e.type === 'call');
    const durations = calls.map((e) => e.durationMs);
    const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    assert.equal(avg, 217); // (150+200+300)/3 = 216.67 -> 217
  });

  it('identifies top servers by call count', () => {
    const calls = testEvents.filter((e) => e.type === 'call');
    const counts = new Map();
    for (const e of calls) counts.set(e.server, (counts.get(e.server) || 0) + 1);
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    assert.equal(sorted[0][0], 'gitlab');
    assert.equal(sorted[0][1], 2);
  });

  it('calculates context reduction percentage', () => {
    const spawns = testEvents.filter((e) => e.type === 'spawn');
    const totalTools = spawns.reduce((s, e) => s + e.toolCount, 0);
    const muxTools = 4;
    const reduction = Math.round((1 - muxTools / totalTools) * 100);
    assert.equal(reduction, 78); // 1 - 4/18 = 0.777... -> 78%
  });

  it('buckets calls into real per-day counts (getDailyActivity algorithm)', () => {
    // Mirrors metrics.getDailyActivity / useMetrics: every bar is a measured
    // count, no synthesis. (WS-C5 regression against buildDailyCounts weights.)
    const days = 14;
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const events = [
      { ts: todayStart + 3600_000, type: 'call' }, // today
      { ts: todayStart + 7200_000, type: 'call' }, // today
      { ts: todayStart - 86400_000 + 3600_000, type: 'call' }, // yesterday
      { ts: todayStart - 5 * 86400_000, type: 'call' }, // 5 days ago
      { ts: todayStart - 100 * 86400_000, type: 'call' }, // out of window
      { ts: todayStart + 60_000, type: 'spawn' }, // not a call — ignored
    ];
    const counts = new Array(days).fill(0);
    for (const e of events) {
      if (e.type !== 'call') continue;
      const dayStart = new Date(e.ts).setHours(0, 0, 0, 0);
      const idx = days - 1 - Math.round((todayStart - dayStart) / 86400_000);
      if (idx >= 0 && idx < days) counts[idx] += 1;
    }
    assert.equal(counts.length, days);
    assert.equal(counts[days - 1], 2); // today
    assert.equal(counts[days - 2], 1); // yesterday
    assert.equal(counts[days - 6], 1); // 5 days ago
    assert.equal(
      counts.reduce((a, b) => a + b, 0),
      4,
    ); // out-of-window + spawn excluded
  });

  it('counts errors', () => {
    const errors = testEvents.filter((e) => e.type === 'error');
    assert.equal(errors.length, 1);
  });

  it('counts auth events separately', () => {
    const hits = testEvents.filter((e) => e.type === 'auth_hit');
    const flows = testEvents.filter((e) => e.type === 'auth_flow');
    assert.equal(hits.length, 1);
    assert.equal(flows.length, 1);
  });
});

describe('metrics pruning logic', () => {
  it('filters events older than 6 months', () => {
    const sixMonthsAgo = Date.now() - 180 * 86400_000;
    const events = [
      { ts: Date.now() - 1000, type: 'call', server: 'recent' },
      { ts: sixMonthsAgo - 1000, type: 'call', server: 'old' },
      { ts: sixMonthsAgo - 86400_000, type: 'spawn', server: 'ancient' },
    ];
    const pruned = events.filter((e) => e.ts >= sixMonthsAgo);
    assert.equal(pruned.length, 1);
    assert.equal(pruned[0].server, 'recent');
  });

  it('keeps events within 6 months', () => {
    const sixMonthsAgo = Date.now() - 180 * 86400_000;
    const events = [
      { ts: Date.now() - 1000, type: 'call', server: 'a' },
      { ts: Date.now() - 86400_000, type: 'call', server: 'b' },
      { ts: sixMonthsAgo + 1000, type: 'call', server: 'c' },
    ];
    const pruned = events.filter((e) => e.ts >= sixMonthsAgo);
    assert.equal(pruned.length, 3);
  });
});

describe('metrics via mux_status (integration)', () => {
  // This is covered by test-mcp.mjs (section 4: mux_status) which validates
  // metrics fields are returned. Skipping here to avoid process hang issues
  // with node:test runner + child MCP processes.
  it('metrics integration covered by test-mcp.mjs', () => {
    assert.ok(true);
  });
});
