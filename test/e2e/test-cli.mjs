/**
 * Group 18 — CLI contract e2e tests (WS-B2).
 *
 * Spawns the built `dist/index.js` as a child process with an isolated HOME so
 * every ~/.mux path (registry, logs, uninstall target) is sandboxed and the
 * real user config is never touched. Asserts the CLI contract:
 *   - every subcommand --help exits 0
 *   - --version matches package.json (single-sourced)
 *   - --json is parseable with ZERO ANSI
 *   - NO_COLOR / --plain strip colour
 *   - --yes bypasses confirmation; nothing blocks on stdin (no TTY in CI)
 *   - --dry-run mutates nothing (registry mtime unchanged)
 *   - unknown command -> usage text + non-zero
 *   - remove/uninstall without --yes and no TTY -> refuse (do not proceed)
 *   - distinct exit codes per failure class
 */
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, statSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const MUX_BIN = resolve(ROOT, 'dist/index.js');
const PKG_VERSION = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8')).version;

// eslint-disable-next-line no-control-regex -- intentionally matches the ESC control char in ANSI SGR sequences
const ANSI = /\u001b\[[0-9;]*m/;

let pass = 0;
let fail = 0;
const results = [];

function assert(name, condition) {
  if (condition) {
    pass++;
    results.push({ name, status: 'pass' });
  } else {
    fail++;
    results.push({ name, status: 'fail' });
  }
}

/** Fresh sandboxed HOME per invocation so ~/.mux is isolated. */
function freshHome() {
  return mkdtempSync(resolve(tmpdir(), 'mux-cli-e2e-'));
}

/**
 * Run the CLI. `stdin: 'ignore'` guarantees there is no TTY, matching CI and
 * exercising the non-interactive refusal paths.
 */
function run(args, { home, env } = {}) {
  const h = home ?? freshHome();
  const res = spawnSync('node', [MUX_BIN, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf-8',
    env: { ...process.env, HOME: h, MUX_LOG_LEVEL: 'error', ...(env ?? {}) },
  });
  return { code: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '', home: h };
}

const SUBCOMMANDS = [
  'serve',
  'add',
  'remove',
  'edit',
  'auth',
  'health',
  'metrics',
  'doctor',
  'logs',
  'report-bug',
  'update',
  'uninstall',
];

// ---- every subcommand --help exits 0 ----
for (const cmd of SUBCOMMANDS) {
  const { code } = run([cmd, '--help']);
  assert(`${cmd} --help exits 0`, code === 0);
}
{
  const { code } = run(['--help']);
  assert('top-level --help exits 0', code === 0);
}

// ---- --version matches package.json ----
{
  const { code, stdout } = run(['--version']);
  assert('--version exits 0', code === 0);
  assert('--version matches package.json', stdout.trim() === PKG_VERSION);
}

// ---- --json parseable + zero ANSI (doctor is offline-safe) ----
{
  const { stdout } = run(['doctor', '--json']);
  let parsed = null;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch {
    parsed = null;
  }
  assert('doctor --json is parseable', parsed !== null && typeof parsed === 'object');
  assert('doctor --json has zero ANSI', !ANSI.test(stdout));
  assert('doctor --json has checks array', Array.isArray(parsed?.checks));
}

// ---- NO_COLOR / --plain strip colour on a human (non-json) command ----
{
  const { stdout: plainOut } = run(['doctor', '--plain']);
  assert('doctor --plain has zero ANSI', !ANSI.test(plainOut));
  const { stdout: ncOut } = run(['doctor'], { env: { NO_COLOR: '1' } });
  assert('doctor NO_COLOR=1 has zero ANSI', !ANSI.test(ncOut));
}

// ---- unknown command -> non-zero (USAGE=2) + usage text on stderr ----
{
  const { code, stderr } = run(['frobnicate']);
  assert('unknown command exits non-zero', code !== 0);
  assert('unknown command exit code is USAGE (2)', code === 2);
  assert('unknown command writes to stderr', stderr.length > 0);
}

// ---- a bad flag -> non-zero ----
{
  const { code } = run(['--not-a-flag']);
  assert('unknown flag exits non-zero', code !== 0);
}

// ---- remove without --yes and no TTY -> refuse (CONFIRMATION_REQUIRED=3) ----
{
  const home = freshHome();
  mkdirSync(resolve(home, '.mux'), { recursive: true });
  writeFileSync(resolve(home, '.mux', 'servers.json'), JSON.stringify({ version: 2, servers: {} }));
  const { code } = run(['remove', 'anything'], { home });
  assert('remove without --yes and no TTY refuses (exit 3)', code === 3);
}

// ---- uninstall without --yes and no TTY -> refuse (CONFIRMATION_REQUIRED=3) ----
{
  const home = freshHome();
  const muxDir = resolve(home, '.mux');
  mkdirSync(muxDir, { recursive: true });
  writeFileSync(resolve(muxDir, 'servers.json'), JSON.stringify({ version: 2, servers: {} }));
  const { code } = run(['uninstall'], { home });
  assert('uninstall without --yes and no TTY refuses (exit 3)', code === 3);
  assert('uninstall refusal did NOT delete ~/.mux', existsSync(muxDir));
}

// ---- --dry-run mutates nothing (registry mtime unchanged) ----
{
  const home = freshHome();
  const muxDir = resolve(home, '.mux');
  mkdirSync(muxDir, { recursive: true });
  const regPath = resolve(muxDir, 'servers.json');
  writeFileSync(regPath, JSON.stringify({ version: 2, servers: { keep: { transport: 'stdio', command: 'node' } } }));
  const before = statSync(regPath).mtimeMs;
  const { code } = run(['add', 'newsrv', '--transport', 'stdio', '--command', 'node', '--dry-run', '--yes'], { home });
  const after = statSync(regPath).mtimeMs;
  assert('add --dry-run exits 0', code === 0);
  assert('add --dry-run leaves registry mtime unchanged', before === after);
}

// ---- uninstall --yes actually removes ~/.mux (destructive path works) ----
{
  const home = freshHome();
  const muxDir = resolve(home, '.mux');
  mkdirSync(muxDir, { recursive: true });
  writeFileSync(resolve(muxDir, 'servers.json'), JSON.stringify({ version: 2, servers: {} }));
  const { code } = run(['uninstall', '--yes'], { home });
  assert('uninstall --yes exits 0', code === 0);
  assert('uninstall --yes removed ~/.mux', !existsSync(muxDir));
}

// ---- health with no servers is OK(0) ----
{
  const home = freshHome();
  mkdirSync(resolve(home, '.mux'), { recursive: true });
  writeFileSync(resolve(home, '.mux', 'servers.json'), JSON.stringify({ version: 2, servers: {} }));
  const { code } = run(['health', '--json'], { home });
  assert('health with no servers exits 0', code === 0);
}

// ---- logs with no log file -> NOT_FOUND(4) ----
{
  const { code } = run(['logs']);
  assert('logs with no file exits NOT_FOUND (4)', code === 4);
}

// ====== report ======
const GREEN = '\u001b[38;5;46m';
const RED = '\u001b[38;5;196m';
const RESET = '\u001b[0m';
for (const r of results) {
  const mark = r.status === 'pass' ? `${GREEN}✔${RESET}` : `${RED}✖${RESET}`;
  process.stdout.write(`  ${mark} ${r.name}\n`);
}
process.stdout.write(`\n  ${GREEN}✔ ${pass} passed${RESET}   ${RED}✖ ${fail} failed${RESET}\n\n`);
if (fail > 0) {
  process.stdout.write(`  ${RED}SOME TESTS FAILED${RESET}\n\n`);
  process.exit(1);
}
process.stdout.write(`  ${GREEN}ALL TESTS PASSED${RESET}\n\n`);
