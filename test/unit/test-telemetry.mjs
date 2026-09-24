/**
 * Unit tests for telemetry opt-out + metrics.json permissions (WS-C4).
 * telemetryDisabled is evaluated at module load, so each case runs in a
 * spawned process with a sandbox HOME and the env var set (or not).
 * Run: node --test test/unit/test-telemetry.mjs
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir, platform } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const METRICS = `${ROOT}/dist/metrics.js`;

const sandboxes = [];
function run(env = {}) {
  const home = mkdtempSync(resolve(tmpdir(), 'mux-tel-'));
  sandboxes.push(home);
  const script = `
    import { record, flushMetrics } from ${JSON.stringify(METRICS)};
    record({ ts: Date.now(), type: 'call', server: 's', durationMs: 5 });
    flushMetrics();
  `;
  return new Promise((resolvePromise) => {
    const proc = spawn('node', ['--input-type=module', '-e', script], {
      env: { ...process.env, HOME: home, ...env },
    });
    proc.on('close', () => resolvePromise(home));
  });
}
after(() => {
  for (const h of sandboxes) rmSync(h, { recursive: true, force: true });
});

const metricsPath = (home) => resolve(home, '.mux', 'metrics.json');

describe('telemetry opt-out', () => {
  it('writes metrics.json by default', async () => {
    const home = await run();
    assert.ok(existsSync(metricsPath(home)), 'metrics.json should be written by default');
  });

  it('MUX_NO_TELEMETRY=1 records nothing', async () => {
    const home = await run({ MUX_NO_TELEMETRY: '1' });
    assert.equal(existsSync(metricsPath(home)), false, 'no metrics.json when opted out');
  });

  it('DO_NOT_TRACK=1 records nothing', async () => {
    const home = await run({ DO_NOT_TRACK: '1' });
    assert.equal(existsSync(metricsPath(home)), false, 'no metrics.json when DO_NOT_TRACK set');
  });

  it('metrics.json is written 0600', async () => {
    if (platform() === 'win32') return; // POSIX perms only
    const home = await run();
    const bits = statSync(metricsPath(home)).mode & 0o777;
    assert.equal(bits, 0o600, `expected 0600, got ${bits.toString(8)}`);
  });
});
