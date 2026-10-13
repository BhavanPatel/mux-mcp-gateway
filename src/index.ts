import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { loadRegistry, watchRegistry } from './registry.js';
import { disconnectAll } from './pool.js';
import { logger } from './logger.js';
import { loadEnvFiles } from './env.js';
import { loadMetrics, flushMetrics, pruneOldEvents } from './metrics.js';
import { installCrashHandlers } from './errors.js';

/**
 * Entry dispatch.
 *
 * FENCE: the headless MCP gateway path (bare `mux`, `mux serve`) must reach
 * startGateway() with byte-identical stdout — stdout is owned exclusively by the
 * MCP StdioServerTransport; startGateway() itself writes nothing to stdout
 * (all logging goes to stderr via logger). To guarantee this, we dispatch the
 * gateway BEFORE constructing yargs, so the CLI parser can never emit to stdout
 * on the gateway path. Only non-gateway invocations go through the yargs layer.
 */
const argv = process.argv.slice(2);
const first = argv[0];
const GATEWAY_ONLY_FLAGS = new Set(['--plain', '--no-color']);
const isColorOnly = argv.length > 0 && argv.every((a) => GATEWAY_ONLY_FLAGS.has(a));
// stdout TTY decides bare `mux`: interactive terminal → dashboard, pipe/redirect
// → headless gateway. Read directly (not via env-flags) to keep this dispatch
// dependency-free and before any TUI import.
const stdoutIsTTY = Boolean(process.stdout.isTTY);
// Bare `mux` (no args) or bare `mux` + only colour flags counts as "no command".
const noCommand = first === undefined || isColorOnly;
// Dashboard: explicit `--tui`/`dashboard`, OR a no-command invocation on a TTY.
const isDashboard = argv.includes('--tui') || first === 'dashboard' || (noCommand && stdoutIsTTY);
// Gateway path: `mux serve`, or a no-command invocation with NO TTY (piped).
// --version/--help and any subcommand fall through to the yargs CLI.
const isGateway = !isDashboard && (first === 'serve' || noCommand);

if (isDashboard) {
  // WS-B3: the Ink TUI requires an interactive terminal. Refuse rather than
  // rendering escape sequences into a pipe/file. The headless MCP path is
  // unaffected — this gate only guards the interactive branch. (Reachable via
  // an explicit `--tui`/`dashboard` on a non-TTY; bare `mux` non-TTY is routed
  // to the gateway above.)
  const { envFlags } = await import('./tui/env-flags.js');
  if (!envFlags.isTTY) {
    process.stderr.write(
      'mux: the dashboard requires an interactive terminal (TTY). Refusing to render to a non-TTY stdout.\n',
    );
    process.exit(1);
  }
  const { renderTui } = await import('./tui/App.js');
  renderTui();
} else if (isGateway) {
  // `mux serve`, bare `mux` piped, or `mux --plain`/`--no-color` (colour flags
  // consumed by env-flags, not a subcommand). Run the gateway directly — no yargs.
  startGateway().catch((err) => {
    logger.error(`Fatal: ${err.stack || err.message}`);
    process.exit(1);
  });
} else {
  // A subcommand was given — hand off to the yargs CLI layer.
  const { runCli } = await import('./cli.js');
  await runCli(process.argv);
}

export async function startGateway() {
  // Crash safety FIRST: an async throw before/within setup must still flush
  // metrics and leave a redacted crash report instead of dying with a raw
  // stack and losing buffered events (WS-C3).
  installCrashHandlers({ onCrash: flushMetrics });

  // Load env vars from shell profiles and .env files
  loadEnvFiles();

  // Load metrics history
  loadMetrics();
  pruneOldEvents();

  logger.info('Mux starting...');

  // Load registry
  loadRegistry();
  watchRegistry();

  // Create MCP server
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('Mux MCP server running on stdio');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    flushMetrics();
    await disconnectAll();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Exit if parent closes stdin (prevents orphan processes)
  process.stdin.on('end', shutdown);
  process.stdin.on('close', shutdown);
}
