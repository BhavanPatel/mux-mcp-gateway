/**
 * Unit tests for the logger module (WS-C1).
 * Exercises the REAL dist/logger.js in a spawned process with an isolated HOME
 * so the NDJSON file sink lands in a sandbox. Covers: dual sink, NDJSON
 * validity, rotation, stdout-sacred, redaction of meta, correlation ids.
 * Run: node --test test/unit/test-logger.mjs
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const LOGGER = `${ROOT}/dist/logger.js`;

/**
 * Run an inline ESM script that imports the real logger, with a sandbox HOME.
 * Returns { stdout, stderr, home }.
 */
function runWithLogger(body, env = {}) {
  const home = mkdtempSync(resolve(tmpdir(), 'mux-log-'));
  const script = `
    import { logger, newCorrelationId } from ${JSON.stringify(LOGGER)};
    ${body}
  `;
  return new Promise((resolvePromise, reject) => {
    const proc = spawn('node', ['--input-type=module', '-e', script], {
      env: { ...process.env, HOME: home, ...env },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', () => resolvePromise({ stdout, stderr, home }));
    proc.on('error', reject);
  });
}

function readLog(home) {
  const p = resolve(home, '.mux', 'mux.log');
  return existsSync(p) ? readFileSync(p, 'utf-8') : '';
}

const sandboxes = [];
after(() => {
  for (const h of sandboxes) rmSync(h, { recursive: true, force: true });
});

describe('logger dual sink', () => {
  it('writes a human line to stderr and NDJSON to the file', async () => {
    const { stdout, stderr, home } = await runWithLogger(`logger.info('hello world', { a: 1 });`);
    sandboxes.push(home);
    // stdout stays sacred
    assert.equal(stdout, '');
    // human sink
    assert.match(stderr, /\[MUX\] \[info\]/);
    assert.ok(stderr.includes('hello world'));
    // structured sink: one valid JSON object per line
    const lines = readLog(home).split('\n').filter(Boolean);
    assert.ok(lines.length >= 1);
    for (const line of lines) {
      const obj = JSON.parse(line); // throws if not valid NDJSON
      assert.equal(typeof obj.ts, 'string');
      assert.equal(typeof obj.level, 'string');
      assert.equal(typeof obj.msg, 'string');
    }
    const rec = JSON.parse(lines.at(-1));
    assert.equal(rec.msg, 'hello world');
    assert.equal(rec.a, 1);
  });

  it('MUX_LOG_TO_FILE=false disables the file sink', async () => {
    const { home, stderr } = await runWithLogger(`logger.info('no file please');`, { MUX_LOG_TO_FILE: 'false' });
    sandboxes.push(home);
    assert.ok(stderr.includes('no file please'));
    assert.equal(readLog(home), '');
  });
});

describe('logger redaction', () => {
  it('redacts secret-keyed meta in both sinks', async () => {
    const { stderr, home } = await runWithLogger(`logger.info('auth', { token: 'ghp_0123456789abcdefghijABCDEF' });`);
    sandboxes.push(home);
    const file = readLog(home);
    assert.ok(!stderr.includes('ghp_0123456789abcdefghijABCDEF'), 'secret leaked to stderr');
    assert.ok(!file.includes('ghp_0123456789abcdefghijABCDEF'), 'secret leaked to file');
    assert.ok(stderr.includes('[redacted]'));
  });
});

describe('logger correlation ids', () => {
  it('threads a consistent cid across a child logger', async () => {
    const { home } = await runWithLogger(`
      const cid = newCorrelationId();
      const log = logger.child(cid);
      log.info('first');
      log.warn('second');
    `);
    sandboxes.push(home);
    const lines = readLog(home)
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    const cids = new Set(lines.map((l) => l.cid));
    assert.equal(cids.size, 1, 'all lines should share one cid');
    assert.ok([...cids][0].length > 0);
  });
});

describe('logger rotation', () => {
  it('rotates to mux.log.1 when the size cap is exceeded', async () => {
    // Tiny cap so a couple of lines trip rotation.
    const { home } = await runWithLogger(
      `for (let i = 0; i < 50; i++) logger.info('padding line ' + i + ' ' + 'x'.repeat(50));`,
      { MUX_LOG_MAX_BYTES: '200' },
    );
    sandboxes.push(home);
    const rotated = resolve(home, '.mux', 'mux.log.1');
    assert.ok(existsSync(rotated), 'rotated file should exist');
    assert.ok(readLog(home).length > 0);
  });
});
