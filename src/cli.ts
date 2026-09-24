/**
 * Mux CLI — yargs command surface (WS-B2).
 *
 * This layer is only reached for explicit subcommands. The headless MCP gateway
 * (bare `mux` / `mux serve`) is dispatched in index.ts BEFORE this module is
 * imported, so nothing here can touch the gateway's stdout (the fence).
 *
 * Colour/plain handling is owned by env-flags + styles (single source). `--plain`
 * and `--no-color` are declared here only so yargs tolerates them and shows them
 * in help — env-flags reads them directly from process.argv; this layer does not
 * re-derive colour.
 *
 * Every subcommand supports `--json` (parseable, ANSI-free) and exits with a
 * distinct code per failure class (see cli-output.ExitCode).
 */
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';

import { VERSION } from './version.js';
import { ExitCode, emit, emitError, canProceedUnconfirmed, type OutputMode } from './cli-output.js';
import { loadRegistry, getRegistry, removeServer, setServerKeywords } from './registry.js';
import { restoreLatestBackup } from './config-writer.js';
import { addServerToRegistry } from './tui/actions/import-servers.js';
import { authServer } from './tui/actions/auth.js';
import { runHealthChecks } from './tui/actions/health-check.js';
import { loadMetrics, getInsights, getQuickStats } from './metrics.js';
import { readStoredToken, isTokenExpired } from './auth/index.js';
import { checkLoopbackBind, detectClientConfigs, logSizeCheck } from './doctor-checks.js';
import { latestCrashReport } from './errors.js';
import { redactValue } from './redact.js';
import type { ServerCheckResult } from './tui/views/HealthCheck.js';

const MUX_DIR = resolve(homedir(), '.mux');
const LOG_PATH = resolve(MUX_DIR, 'mux.log');
const REGISTRY_PATH = resolve(MUX_DIR, 'servers.json');

interface GlobalArgs {
  json: boolean;
  yes: boolean;
  'dry-run': boolean;
}

function mode(argv: { json?: boolean }): OutputMode {
  return { json: Boolean(argv.json) };
}

/** Terminates the process with a code. Isolated for testability. */
function done(code: number): never {
  process.exit(code);
}

// `serve` is intercepted in index.ts before yargs is constructed, so this
// handler is unreachable in normal use — it exists only so `serve` appears in
// `--help`. We do NOT import index.js here (that would re-run entry dispatch).
async function serveHandler(): Promise<never> {
  process.stderr.write('mux: run `mux` or `mux serve` with no other arguments to start the gateway.\n');
  return done(ExitCode.OK);
}

async function addHandler(
  argv: GlobalArgs & {
    name: string;
    transport: 'http' | 'stdio';
    url?: string;
    command?: string;
    args?: string[];
    env?: string[];
    header?: string[];
    keyword?: string[];
  },
): Promise<never> {
  const m = mode(argv);
  const env = kvList(argv.env);
  const headers = kvList(argv.header);
  const keywords = argv.keyword ?? [];

  if (argv.transport === 'http' && !argv.url) {
    emitError(m, 'http transport requires --url', ExitCode.USAGE);
    return done(ExitCode.USAGE);
  }
  if (argv.transport === 'stdio' && !argv.command) {
    emitError(m, 'stdio transport requires --command', ExitCode.USAGE);
    return done(ExitCode.USAGE);
  }

  if (argv['dry-run']) {
    emit(
      m,
      { dryRun: true, wouldAdd: argv.name, transport: argv.transport },
      `Would add "${argv.name}" (no changes made).`,
    );
    return done(ExitCode.OK);
  }

  try {
    await addServerToRegistry(argv.name, {
      transport: argv.transport,
      url: argv.url,
      command: argv.command,
      args: argv.args,
      env,
      headers,
      keywords,
    });
    emit(m, { added: argv.name }, `Added server "${argv.name}".`);
    return done(ExitCode.OK);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const already = /already exists/.test(message);
    emitError(m, message, already ? ExitCode.USAGE : ExitCode.WRITE_FAILED);
    return done(already ? ExitCode.USAGE : ExitCode.WRITE_FAILED);
  }
}

async function removeHandler(argv: GlobalArgs & { name: string }): Promise<never> {
  const m = mode(argv);
  if (!canProceedUnconfirmed(argv.yes)) {
    emitError(
      m,
      `refusing to remove "${argv.name}" without --yes in a non-interactive shell`,
      ExitCode.CONFIRMATION_REQUIRED,
    );
    return done(ExitCode.CONFIRMATION_REQUIRED);
  }
  if (!argv.yes && process.stdin.isTTY) {
    const ok = await confirm(`Remove server "${argv.name}"?`);
    if (!ok) {
      emit(m, { removed: false, cancelled: true }, 'Cancelled.');
      return done(ExitCode.OK);
    }
  }
  if (argv['dry-run']) {
    emit(m, { dryRun: true, wouldRemove: argv.name }, `Would remove "${argv.name}" (no changes made).`);
    return done(ExitCode.OK);
  }
  const result = await removeServer(argv.name);
  switch (result) {
    case 'removed':
      emit(m, { removed: argv.name }, `Removed server "${argv.name}".`);
      return done(ExitCode.OK);
    case 'not-found':
      emitError(m, `server "${argv.name}" not found`, ExitCode.NOT_FOUND);
      return done(ExitCode.NOT_FOUND);
    case 'write-failed':
      emitError(m, `failed to write registry while removing "${argv.name}"`, ExitCode.WRITE_FAILED);
      return done(ExitCode.WRITE_FAILED);
  }
}

async function editHandler(argv: GlobalArgs & { name: string; keyword?: string[] }): Promise<never> {
  const m = mode(argv);
  loadRegistry();
  const reg = getRegistry();
  if (!reg.servers[argv.name]) {
    emitError(m, `server "${argv.name}" not found`, ExitCode.NOT_FOUND);
    return done(ExitCode.NOT_FOUND);
  }
  const keywords = argv.keyword ?? [];
  if (argv['dry-run']) {
    emit(m, { dryRun: true, wouldSetKeywords: keywords }, `Would set tags for "${argv.name}" (no changes made).`);
    return done(ExitCode.OK);
  }
  setServerKeywords(argv.name, keywords);
  emit(m, { edited: argv.name, keywords }, `Updated tags for "${argv.name}".`);
  return done(ExitCode.OK);
}

async function authHandler(argv: GlobalArgs & { name: string }): Promise<never> {
  const m = mode(argv);
  const result = await authServer(argv.name);
  if (result.success) {
    emit(m, { authorized: argv.name }, `Authorized "${argv.name}".`);
    return done(ExitCode.OK);
  }
  emitError(m, result.error || `authorization failed for "${argv.name}"`, ExitCode.NETWORK);
  return done(ExitCode.NETWORK);
}

async function healthHandler(argv: GlobalArgs & { name?: string }): Promise<never> {
  const m = mode(argv);
  loadRegistry();
  const reg = getRegistry();
  const names = argv.name ? [argv.name] : Object.keys(reg.servers);
  if (names.length === 0) {
    emit(m, { servers: [], healthy: true }, 'No servers registered.');
    return done(ExitCode.OK);
  }
  const results: Record<string, Partial<ServerCheckResult>> = {};
  await runHealthChecks(names, {
    onResult: (name, partial) => {
      results[name] = { ...results[name], ...partial };
    },
    onComplete: () => {},
  });
  const rows = names.map((n) => ({
    name: n,
    status: results[n]?.status ?? 'fail',
    error: results[n]?.error,
    latencyMs: results[n]?.latencyMs,
  }));
  const allPass = rows.every((r) => r.status === 'pass');
  emit(
    m,
    { servers: rows, healthy: allPass },
    rows.map((r) => `${r.status === 'pass' ? 'PASS' : 'FAIL'}  ${r.name}${r.error ? ` — ${r.error}` : ''}`),
  );
  return done(allPass ? ExitCode.OK : ExitCode.CHECK_FAILED);
}

async function metricsHandler(argv: GlobalArgs): Promise<never> {
  const m = mode(argv);
  loadMetrics();
  const quick = getQuickStats();
  const insights = getInsights();
  emit(m, { quick, insights }, [
    `Total calls:       ${quick.totalCalls}`,
    `Up since:          ${quick.upSince}`,
    `Context saved:     ~${quick.contextReductionPct}%`,
    `Top server:        ${quick.topServer ?? '—'}`,
  ]);
  return done(ExitCode.OK);
}

async function doctorHandler(argv: GlobalArgs): Promise<never> {
  const m = mode(argv);
  const checks: Array<{ name: string; ok: boolean; detail: string }> = [];

  const major = Number(process.versions.node.split('.')[0]);
  checks.push({ name: 'node-version', ok: major >= 20, detail: `node ${process.versions.node} (require >=20)` });

  let registryOk = false;
  if (!existsSync(REGISTRY_PATH)) {
    checks.push({ name: 'registry', ok: true, detail: 'no registry yet (fresh install)' });
    registryOk = true;
  } else {
    try {
      JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
      checks.push({ name: 'registry', ok: true, detail: 'servers.json parses' });
      registryOk = true;
    } catch (e) {
      checks.push({ name: 'registry', ok: false, detail: `servers.json invalid: ${(e as Error).message}` });
    }
  }

  if (existsSync(MUX_DIR)) {
    const modeBits = statSync(MUX_DIR).mode & 0o777;
    checks.push({
      name: 'mux-dir-perms',
      ok: modeBits === 0o700,
      detail: `~/.mux mode ${modeBits.toString(8)} (expect 700)`,
    });
  }

  // Per-server reachability (+latency) and token state — only if the registry
  // is usable, so a corrupt registry doesn't cascade into noise.
  if (registryOk) {
    loadRegistry();
    const reg = getRegistry();
    const names = Object.keys(reg.servers);

    if (names.length > 0) {
      const health: Record<string, Partial<ServerCheckResult>> = {};
      await runHealthChecks(names, {
        onResult: (name, partial) => {
          health[name] = { ...health[name], ...partial };
        },
        onComplete: () => {},
      });
      for (const name of names) {
        const r = health[name];
        const pass = r?.status === 'pass';
        const latency = r?.latencyMs != null ? ` (${r.latencyMs}ms)` : '';
        checks.push({
          name: `reach:${name}`,
          ok: pass,
          detail: pass ? `reachable${latency}` : `unreachable${latency}${r?.error ? ` — ${r.error}` : ''}`,
        });
      }

      // Token presence / expiry / decryptability for servers configured for auth.
      for (const name of names) {
        if (!reg.servers[name].auth) continue;
        try {
          const entry = readStoredToken(name);
          if (!entry) {
            checks.push({ name: `token:${name}`, ok: true, detail: 'no token stored (auth on demand)' });
          } else if (isTokenExpired(entry)) {
            checks.push({ name: `token:${name}`, ok: false, detail: 'token expired — run `mux auth`' });
          } else {
            checks.push({ name: `token:${name}`, ok: true, detail: 'token present and valid' });
          }
        } catch (e) {
          checks.push({
            name: `token:${name}`,
            ok: false,
            detail: `token store undecryptable: ${(e as Error).message}`,
          });
        }
      }
    }
  }

  // OAuth callback precondition: can we bind an ephemeral loopback port?
  checks.push(await checkLoopbackBind());

  // Detected MCP client configs (only reports clients present on disk).
  for (const c of detectClientConfigs((p) => readFileSync(p, 'utf-8'))) checks.push(c);

  // Log size (informational).
  checks.push(logSizeCheck());

  const allOk = checks.every((c) => c.ok);
  emit(
    m,
    { healthy: allOk, checks },
    checks.map((c) => `${c.ok ? 'OK  ' : 'FAIL'}  ${c.name}: ${c.detail}`),
  );
  return done(allOk ? ExitCode.OK : ExitCode.CHECK_FAILED);
}

/** Parse a --since value: relative (30s/15m/2h/3d/1w) or an ISO datetime. Returns epoch ms or undefined. */
function parseSince(since: string | undefined): number | undefined {
  if (!since) return undefined;
  const rel = /^(\d+)([smhdw])$/.exec(since.trim());
  if (rel) {
    const n = Number(rel[1]);
    const unit = { s: 1e3, m: 60e3, h: 3600e3, d: 86400e3, w: 7 * 86400e3 }[rel[2]]!;
    return Date.now() - n * unit;
  }
  const parsed = Date.parse(since);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** Timestamp of an NDJSON log line, or undefined if unparseable. */
function lineTs(line: string): number | undefined {
  try {
    const ts = JSON.parse(line).ts;
    const ms = typeof ts === 'string' ? Date.parse(ts) : typeof ts === 'number' ? ts : NaN;
    return Number.isNaN(ms) ? undefined : ms;
  } catch {
    return undefined;
  }
}

async function logsHandler(argv: GlobalArgs & { lines: number; since?: string; follow?: boolean }): Promise<never> {
  const m = mode(argv);
  if (!existsSync(LOG_PATH)) {
    emitError(
      m,
      `no log file at ${LOG_PATH} (file logging is on by default; set MUX_LOG_TO_FILE=false to disable)`,
      ExitCode.NOT_FOUND,
    );
    return done(ExitCode.NOT_FOUND);
  }

  const sinceMs = parseSince(argv.since);
  if (argv.since && sinceMs === undefined) {
    emitError(m, `invalid --since value "${argv.since}" (use 30s/15m/2h/3d/1w or an ISO datetime)`, ExitCode.USAGE);
    return done(ExitCode.USAGE);
  }

  const filterSince = (lines: string[]): string[] =>
    sinceMs === undefined ? lines : lines.filter((l) => (lineTs(l) ?? Infinity) >= sinceMs);

  const all = readFileSync(LOG_PATH, 'utf-8').split('\n').filter(Boolean);
  const sinceFiltered = filterSince(all);
  const tail = sinceMs === undefined ? sinceFiltered.slice(-argv.lines) : sinceFiltered;

  if (!argv.follow) {
    emit(m, { lines: tail }, tail);
    return done(ExitCode.OK);
  }

  // --follow: print the initial tail, then poll for appended lines. Human and
  // JSON modes both stream raw NDJSON lines to stdout as they arrive; Ctrl-C exits.
  for (const line of tail) process.stdout.write(line + '\n');
  let offset = readFileSync(LOG_PATH, 'utf-8').length;
  const poll = setInterval(() => {
    try {
      const buf = readFileSync(LOG_PATH, 'utf-8');
      if (buf.length < offset) offset = 0; // rotated/truncated — restart
      if (buf.length > offset) {
        const fresh = buf.slice(offset).split('\n').filter(Boolean);
        offset = buf.length;
        for (const line of filterSince(fresh)) process.stdout.write(line + '\n');
      }
    } catch {
      // transient read error during rotation — ignore, retry next tick
    }
  }, 500);
  poll.unref?.();
  process.on('SIGINT', () => {
    clearInterval(poll);
    done(ExitCode.OK);
  });
  // Keep the event loop alive until interrupted.
  await new Promise<void>(() => {});
  return done(ExitCode.OK);
}

async function reportBugHandler(argv: GlobalArgs): Promise<never> {
  const m = mode(argv);
  // Redacted diagnostic bundle: version + node + platform + recent log tail +
  // the most recent crash report (if any). The whole bundle is passed through
  // redactValue so a token in a log line or crash stack never ships (WS-C3).
  const recentLogs = existsSync(LOG_PATH) ? readFileSync(LOG_PATH, 'utf-8').split('\n').filter(Boolean).slice(-50) : [];
  const crashPath = latestCrashReport();
  let lastCrash: unknown;
  if (crashPath) {
    try {
      lastCrash = JSON.parse(readFileSync(crashPath, 'utf-8'));
    } catch {
      lastCrash = { error: 'crash report unreadable', path: crashPath };
    }
  }
  const bundle = redactValue({
    version: VERSION,
    node: process.versions.node,
    platform: process.platform,
    registryExists: existsSync(REGISTRY_PATH),
    recentLogs,
    lastCrash,
  }) as Record<string, unknown>;

  const issueBody = [
    `Mux ${VERSION} on node ${process.versions.node} (${process.platform})`,
    `Crash report: ${lastCrash ? 'included' : 'none'}`,
    '',
    'Please paste the `mux report-bug --json` output here (already redacted).',
  ].join('\n');
  const issueUrl = `https://github.com/mux-mcp/mux/issues/new?body=${encodeURIComponent(issueBody)}`;

  emit(m, { ...bundle, issueUrl }, [
    `Mux ${VERSION} on node ${process.versions.node} (${process.platform})`,
    `Registry present: ${existsSync(REGISTRY_PATH)}`,
    `Recent log lines: ${recentLogs.length}`,
    `Last crash: ${crashPath ?? 'none'}`,
    '',
    `Open an issue (redacted bundle in --json): ${issueUrl}`,
  ]);
  return done(ExitCode.OK);
}

async function updateHandler(argv: GlobalArgs): Promise<never> {
  const m = mode(argv);
  // Real check against the npm registry (D1 decision). Offline/timeout -> honest.
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://registry.npmjs.org/mux-mcp-gateway/latest', {
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) {
      emitError(m, `version check failed (HTTP ${res.status})`, ExitCode.NETWORK);
      return done(ExitCode.NETWORK);
    }
    const data = (await res.json()) as { version?: string };
    const latest = data.version ?? 'unknown';
    const upToDate = latest === VERSION;
    emit(
      m,
      { current: VERSION, latest, upToDate },
      upToDate
        ? `Up to date (v${VERSION}).`
        : `Update available: v${VERSION} → v${latest}. Run: npm i -g mux-mcp-gateway@${latest}`,
    );
    return done(ExitCode.OK);
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    emitError(
      m,
      aborted ? 'version check timed out (offline?)' : `version check failed: ${(err as Error).message}`,
      ExitCode.NETWORK,
    );
    return done(ExitCode.NETWORK);
  }
}

async function uninstallHandler(argv: GlobalArgs): Promise<never> {
  const m = mode(argv);
  if (!canProceedUnconfirmed(argv.yes)) {
    emitError(m, 'refusing to uninstall without --yes in a non-interactive shell', ExitCode.CONFIRMATION_REQUIRED);
    return done(ExitCode.CONFIRMATION_REQUIRED);
  }
  if (!existsSync(MUX_DIR)) {
    emit(m, { removed: false, reason: 'not-present' }, 'Nothing to remove (~/.mux does not exist).');
    return done(ExitCode.OK);
  }
  if (!argv.yes && process.stdin.isTTY) {
    // Type-to-confirm, preserving the TUI gate string.
    const typed = await prompt('Type "uninstall" to permanently delete ~/.mux: ');
    if (typed.trim() !== 'uninstall') {
      emit(m, { removed: false, cancelled: true }, 'Cancelled.');
      return done(ExitCode.OK);
    }
  }
  if (argv['dry-run']) {
    emit(m, { dryRun: true, wouldRemove: MUX_DIR }, `Would remove ${MUX_DIR} (no changes made).`);
    return done(ExitCode.OK);
  }
  try {
    rmSync(MUX_DIR, { recursive: true, force: true });
    emit(m, { removed: MUX_DIR }, `Removed ${MUX_DIR}. Also run: npm uninstall -g mux-mcp-gateway`);
    return done(ExitCode.OK);
  } catch (err) {
    emitError(m, `failed to remove ${MUX_DIR}: ${(err as Error).message}`, ExitCode.WRITE_FAILED);
    return done(ExitCode.WRITE_FAILED);
  }
}

async function configRestoreHandler(argv: GlobalArgs): Promise<never> {
  const m = mode(argv);
  if (argv['dry-run']) {
    emit(m, { dryRun: true }, 'Would restore the latest registry backup (no changes made).');
    return done(ExitCode.OK);
  }
  const outcome = await restoreLatestBackup(REGISTRY_PATH);
  if (outcome.ok) {
    emit(m, { restored: outcome.value }, `Restored registry from ${outcome.value}.`);
    return done(ExitCode.OK);
  }
  const code = outcome.error === 'not-found' ? ExitCode.NOT_FOUND : ExitCode.WRITE_FAILED;
  emitError(m, outcome.message, code);
  return done(code);
}

// ---- helpers ----

/** Parse `KEY=VALUE` repeatable flags into a record. */
function kvList(pairs?: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of pairs ?? []) {
    const eq = p.indexOf('=');
    if (eq > 0) out[p.slice(0, eq)] = p.slice(eq + 1);
  }
  return out;
}

function confirm(question: string): Promise<boolean> {
  return prompt(`${question} [y/N] `).then((a) => /^y(es)?$/i.test(a.trim()));
}

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolvePrompt) => {
    rl.question(question, (answer) => {
      rl.close();
      resolvePrompt(answer);
    });
  });
}

/**
 * Build and run the CLI. Each handler calls process.exit with a distinct code.
 */
export async function runCli(processArgv: string[]): Promise<void> {
  const cli = yargs(hideBin(processArgv))
    .scriptName('mux')
    .version(VERSION)
    .option('json', { type: 'boolean', default: false, describe: 'Machine-readable JSON output (no ANSI)' })
    .option('yes', { alias: 'y', type: 'boolean', default: false, describe: 'Skip confirmation prompts' })
    .option('dry-run', { type: 'boolean', default: false, describe: 'Show what would happen without making changes' })
    // Declared so yargs tolerates them; env-flags is the real consumer.
    .option('plain', { type: 'boolean', default: false, describe: 'ASCII-only output (no colour, no box-drawing)' })
    .option('no-color', { type: 'boolean', default: false, describe: 'Disable colour output' })
    .command('serve', 'Run the MCP gateway on stdio (default)', {}, () => void serveHandler())
    .command(
      'add <name>',
      'Add a server to the registry',
      (y) =>
        y
          .positional('name', { type: 'string', demandOption: true })
          .option('transport', { choices: ['http', 'stdio'] as const, demandOption: true })
          .option('url', { type: 'string', describe: 'HTTP server URL' })
          .option('command', { type: 'string', describe: 'stdio server command' })
          .option('args', { type: 'array', string: true, describe: 'stdio command args' })
          .option('env', { type: 'array', string: true, describe: 'KEY=VALUE env var (repeatable)' })
          .option('header', { type: 'array', string: true, describe: 'KEY=VALUE HTTP header (repeatable)' })
          .option('keyword', { type: 'array', string: true, describe: 'discovery keyword (repeatable)' }),
      (a) => void addHandler(a as never),
    )
    .command(
      'remove <name>',
      'Remove a server from the registry',
      (y) => y.positional('name', { type: 'string', demandOption: true }),
      (a) => void removeHandler(a as never),
    )
    .command(
      'edit <name>',
      'Edit a server (discovery tags)',
      (y) =>
        y
          .positional('name', { type: 'string', demandOption: true })
          .option('keyword', { type: 'array', string: true, describe: 'replace discovery keywords' }),
      (a) => void editHandler(a as never),
    )
    .command(
      'auth <name>',
      'Authorize a server via OAuth',
      (y) => y.positional('name', { type: 'string', demandOption: true }),
      (a) => void authHandler(a as never),
    )
    .command(
      'health [name]',
      'Check server reachability',
      (y) => y.positional('name', { type: 'string' }),
      (a) => void healthHandler(a as never),
    )
    .command('metrics', 'Show usage metrics', {}, (a) => void metricsHandler(a as never))
    .command('doctor', 'Diagnose the installation', {}, (a) => void doctorHandler(a as never))
    .command(
      'logs',
      'Show recent log lines',
      (y) =>
        y
          .option('lines', { type: 'number', default: 50, describe: 'Number of trailing lines' })
          .option('since', { type: 'string', describe: 'Only lines newer than 30s/15m/2h/3d/1w or an ISO datetime' })
          .option('follow', {
            alias: 'f',
            type: 'boolean',
            default: false,
            describe: 'Stream new log lines until interrupted',
          }),
      (a) => void logsHandler(a as never),
    )
    .command('report-bug', 'Gather a redacted diagnostic bundle', {}, (a) => void reportBugHandler(a as never))
    .command('update', 'Check for a newer version', {}, (a) => void updateHandler(a as never))
    .command('uninstall', 'Remove Mux data (~/.mux)', {}, (a) => void uninstallHandler(a as never))
    .command('config <action>', 'Manage config', (y) =>
      y
        .command('restore', 'Restore the latest registry backup', {}, (a) => void configRestoreHandler(a as never))
        .demandCommand(1, 'Specify a config action (restore)'),
    )
    .demandCommand(1, 'Specify a command. Run `mux --help` for usage.')
    .strict()
    .completion('completion', 'Generate a shell completion script (bash/zsh/fish)')
    .help()
    .fail((msg, err) => {
      // Usage errors (unknown command, bad flags) -> stderr + USAGE exit.
      if (err) throw err;
      process.stderr.write(`mux: ${msg}\n`);
      done(ExitCode.USAGE);
    });

  await cli.parseAsync();
}
