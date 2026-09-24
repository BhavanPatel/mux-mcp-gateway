/**
 * Unit tests for typed errors + crash reporting (WS-C3).
 * Group-16: uncaught handlers write a report AND flush; crash report has no secrets;
 * errors carry stable codes; exit codes distinct per class.
 * Run: node --test test/unit/test-errors.mjs
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const ERRORS = `${ROOT}/dist/errors.js`;

const sandboxes = [];
function sandbox() {
  const h = mkdtempSync(resolve(tmpdir(), 'mux-err-'));
  sandboxes.push(h);
  return h;
}
after(() => {
  for (const h of sandboxes) rmSync(h, { recursive: true, force: true });
});

/** Run inline ESM against the real dist/errors.js with a sandbox HOME. */
function run(body, env = {}) {
  const home = sandbox();
  const script = `
    import { MuxError, MuxErrorCode, mapErrorToExitCode, writeCrashReport, latestCrashReport, installCrashHandlers } from ${JSON.stringify(ERRORS)};
    ${body}
  `;
  return new Promise((resolvePromise) => {
    const proc = spawn('node', ['--input-type=module', '-e', script], {
      env: { ...process.env, HOME: home, ...env },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => resolvePromise({ code, stdout, stderr, home }));
  });
}

function crashDir(home) {
  return resolve(home, '.mux', 'crashes');
}

describe('MuxError', () => {
  it('carries a stable code and preserves stack', async () => {
    const { stdout } = await run(`
      const e = new MuxError(MuxErrorCode.CONFIG_INVALID, 'bad config');
      console.log(JSON.stringify({ code: e.code, name: e.name, hasStack: !!e.stack }));
    `);
    const out = JSON.parse(stdout.trim());
    assert.equal(out.code, 'MUX_E_CONFIG_INVALID');
    assert.equal(out.name, 'MuxError');
    assert.equal(out.hasStack, true);
  });
});

describe('mapErrorToExitCode', () => {
  it('maps codes to distinct exit codes', async () => {
    const { stdout } = await run(`
      console.log(JSON.stringify({
        config: mapErrorToExitCode(new MuxError(MuxErrorCode.CONFIG_INVALID, 'x')),
        net: mapErrorToExitCode(new MuxError(MuxErrorCode.DOWNSTREAM_UNREACHABLE, 'x')),
        plain: mapErrorToExitCode(new Error('x')),
      }));
    `);
    const out = JSON.parse(stdout.trim());
    assert.equal(out.config, 2); // USAGE
    assert.equal(out.net, 6); // NETWORK
    assert.equal(out.plain, 1); // GENERAL
  });
});

describe('writeCrashReport', () => {
  it('writes valid redacted JSON, no secrets', async () => {
    const { home } = await run(`
      const e = new Error('boom with token ghp_0123456789abcdefghijABCDEF');
      writeCrashReport(e, { apiKey: 'sk-abcdefghijklmnopqrstuvwx', origin: 'test' });
    `);
    const dir = crashDir(home);
    assert.ok(existsSync(dir), 'crash dir should exist');
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    assert.equal(files.length, 1);
    const raw = readFileSync(resolve(dir, files[0]), 'utf-8');
    const parsed = JSON.parse(raw); // valid JSON
    assert.equal(parsed.code, 'UNCAUGHT');
    assert.ok(!raw.includes('ghp_0123456789abcdefghijABCDEF'), 'token leaked in message/stack');
    assert.ok(!raw.includes('sk-abcdefghijklmnopqrstuvwx'), 'secret leaked in context');
    assert.equal(parsed.context.apiKey, '[redacted]');
  });

  it('caps retained crash files at 20', async () => {
    const { home } = await run(`
      for (let i = 0; i < 25; i++) writeCrashReport(new Error('e' + i));
    `);
    const files = readdirSync(crashDir(home)).filter((f) => f.endsWith('.json'));
    assert.ok(files.length <= 20, 'should retain at most 20 crash files, got ' + files.length);
  });
});

describe('installCrashHandlers', () => {
  it('on uncaughtException: writes a report, flushes, exits non-zero', async () => {
    const { code, home, stderr } = await run(`
      let flushed = false;
      installCrashHandlers({ onCrash: () => { flushed = true; }, exit: (c) => {
        process.stderr.write('FLUSHED=' + flushed + ' CODE=' + c + '\\n');
        process.exit(c);
      }});
      setTimeout(() => { throw new Error('async boom'); }, 10);
    `);
    assert.match(stderr, /FLUSHED=true/);
    assert.notEqual(code, 0);
    const files = readdirSync(crashDir(home)).filter((f) => f.endsWith('.json'));
    assert.equal(files.length, 1, 'a crash report should be written');
  });
});
