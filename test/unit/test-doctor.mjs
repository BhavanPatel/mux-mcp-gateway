/**
 * Unit tests for doctor checks (WS-C2).
 * Run: node --test test/unit/test-doctor.mjs
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { checkLoopbackBind, knownClientConfigs, detectClientConfigs, logSizeCheck } from '../../dist/doctor-checks.js';

const read = (p) => readFileSync(p, 'utf-8');

const sandboxes = [];
function sandbox() {
  const h = mkdtempSync(resolve(tmpdir(), 'mux-doctor-'));
  sandboxes.push(h);
  return h;
}
after(() => {
  for (const h of sandboxes) rmSync(h, { recursive: true, force: true });
});

describe('checkLoopbackBind', () => {
  it('binds an ephemeral loopback port successfully', async () => {
    const check = await checkLoopbackBind();
    assert.equal(check.name, 'oauth-callback-bind');
    assert.equal(check.ok, true);
    assert.match(check.detail, /ephemeral loopback port \(got \d+\)/);
  });
});

describe('knownClientConfigs', () => {
  it('returns mac paths under Application Support on darwin', () => {
    const targets = knownClientConfigs('/Users/x', 'darwin');
    const claude = targets.find((t) => t.client === 'Claude Desktop');
    assert.ok(claude.path.includes('Library/Application Support/Claude'));
  });
  it('returns XDG paths on linux', () => {
    const targets = knownClientConfigs('/home/x', 'linux');
    const claude = targets.find((t) => t.client === 'Claude Desktop');
    assert.ok(claude.path.includes('.config/Claude'));
  });
});

describe('detectClientConfigs', () => {
  it('reports only clients present on disk, flags mux + serve', () => {
    const home = sandbox();
    // Create a Cursor config that wires mux with serve.
    mkdirSync(resolve(home, '.cursor'), { recursive: true });
    writeFileSync(
      resolve(home, '.cursor', 'mcp.json'),
      JSON.stringify({ mcpServers: { mux: { command: 'mux', args: ['serve'] } } }),
    );
    const checks = detectClientConfigs(read, home, 'linux');
    const cursor = checks.find((c) => c.name === 'client:Cursor');
    assert.ok(cursor, 'cursor config should be detected');
    assert.equal(cursor.ok, true);
    assert.match(cursor.detail, /mux configured \(with serve\)/);
    // No Claude config on disk -> not reported at all.
    assert.equal(
      checks.find((c) => c.name === 'client:Claude Desktop'),
      undefined,
    );
  });

  it('notes a present config that does not mention mux', () => {
    const home = sandbox();
    mkdirSync(resolve(home, '.cursor'), { recursive: true });
    writeFileSync(resolve(home, '.cursor', 'mcp.json'), JSON.stringify({ mcpServers: { other: {} } }));
    const checks = detectClientConfigs(read, home, 'linux');
    const cursor = checks.find((c) => c.name === 'client:Cursor');
    assert.equal(cursor.ok, true);
    assert.match(cursor.detail, /mux not configured/);
  });
});

describe('logSizeCheck', () => {
  it('reports 0 MB when no log exists', () => {
    const home = sandbox();
    const check = logSizeCheck(home);
    assert.equal(check.name, 'log-size');
    assert.equal(check.ok, true);
    assert.match(check.detail, /0\.00 MB/);
  });
  it('sums mux.log and mux.log.1', () => {
    const home = sandbox();
    mkdirSync(resolve(home, '.mux'), { recursive: true });
    writeFileSync(resolve(home, '.mux', 'mux.log'), 'x'.repeat(1024 * 1024));
    writeFileSync(resolve(home, '.mux', 'mux.log.1'), 'x'.repeat(1024 * 1024));
    const check = logSizeCheck(home);
    assert.match(check.detail, /2\.00 MB/);
  });
});
