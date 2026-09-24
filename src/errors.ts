/**
 * Typed errors, crash reporting and process crash handlers (WS-C3).
 *
 * - `MuxError` carries a stable `MUX_E_*` code and preserves the original stack
 *   / cause, so failures are diagnosable instead of bare `new Error(string)`.
 * - `writeCrashReport` persists a REDACTED report to ~/.mux/crashes/<ts>.json
 *   (redactValue), capped to the most recent N files.
 * - `installCrashHandlers` wires uncaughtException + unhandledRejection so an
 *   async throw outside main()'s catch still flushes metrics and leaves a
 *   report, instead of dying with a raw stack and losing buffered events.
 *
 * Nothing here writes to stdout (stdout is the MCP protocol channel).
 */
import { writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { redactValue } from './redact.js';
import { ExitCode, type ExitCodeValue } from './cli-output.js';

export const MuxErrorCode = {
  CONFIG_INVALID: 'MUX_E_CONFIG_INVALID',
  AUTH_TIMEOUT: 'MUX_E_AUTH_TIMEOUT',
  DOWNSTREAM_UNREACHABLE: 'MUX_E_DOWNSTREAM_UNREACHABLE',
  PORT_IN_USE: 'MUX_E_PORT_IN_USE',
  UNKNOWN: 'MUX_E_UNKNOWN',
} as const;

export type MuxErrorCodeValue = (typeof MuxErrorCode)[keyof typeof MuxErrorCode];

/** An error with a stable code, preserving the original cause + stack. */
export class MuxError extends Error {
  readonly code: MuxErrorCodeValue;
  constructor(code: MuxErrorCodeValue, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'MuxError';
    this.code = code;
    if (options?.cause !== undefined) (this as { cause?: unknown }).cause = options.cause;
  }
}

/** Map any thrown value to a distinct process exit code. */
export function mapErrorToExitCode(err: unknown): ExitCodeValue {
  const code = err instanceof MuxError ? err.code : undefined;
  switch (code) {
    case MuxErrorCode.CONFIG_INVALID:
      return ExitCode.USAGE;
    case MuxErrorCode.AUTH_TIMEOUT:
    case MuxErrorCode.DOWNSTREAM_UNREACHABLE:
    case MuxErrorCode.PORT_IN_USE:
      return ExitCode.NETWORK;
    default:
      return ExitCode.GENERAL;
  }
}

const CRASH_DIR = resolve(homedir(), '.mux', 'crashes');
const MAX_CRASH_FILES = 20;

/** Environment keys safe to record (never the whole env — that leaks secrets). */
const SAFE_ENV_KEYS = ['MUX_LOG_LEVEL', 'MUX_LOG_TO_FILE', 'MUX_NO_TELEMETRY', 'DO_NOT_TRACK', 'NODE_ENV', 'TERM'];

interface CrashReport {
  ts: string;
  code: MuxErrorCodeValue | 'UNCAUGHT';
  message: string;
  stack?: string;
  cause?: string;
  node: string;
  platform: string;
  argv: string[];
  env: Record<string, string | undefined>;
  context?: Record<string, unknown>;
}

function pruneOldCrashes(): void {
  try {
    const files = readdirSync(CRASH_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort(); // ISO timestamps sort chronologically
    while (files.length > MAX_CRASH_FILES) {
      const oldest = files.shift();
      if (oldest) unlinkSync(resolve(CRASH_DIR, oldest));
    }
  } catch {
    // best effort
  }
}

/**
 * Write a redacted crash report. Returns the path, or undefined if writing
 * failed (must never itself throw — it runs from a crash handler).
 */
export function writeCrashReport(err: unknown, context?: Record<string, unknown>): string | undefined {
  try {
    if (!existsSync(CRASH_DIR)) mkdirSync(CRASH_DIR, { recursive: true, mode: 0o700 });

    const e = err instanceof Error ? err : new Error(String(err));
    const safeEnv: Record<string, string | undefined> = {};
    for (const k of SAFE_ENV_KEYS) safeEnv[k] = process.env[k];

    const report: CrashReport = {
      ts: new Date().toISOString(),
      code: err instanceof MuxError ? err.code : 'UNCAUGHT',
      message: e.message,
      stack: e.stack,
      cause: (e as { cause?: unknown }).cause ? String((e as { cause?: unknown }).cause) : undefined,
      node: process.versions.node,
      platform: process.platform,
      argv: process.argv.slice(2),
      env: safeEnv,
      context,
    };

    // Redact everything (message/stack/context may carry interpolated secrets).
    const redacted = redactValue(report) as Record<string, unknown>;
    const path = resolve(CRASH_DIR, `${report.ts.replace(/[:.]/g, '-')}.json`);
    writeFileSync(path, JSON.stringify(redacted, null, 2), { mode: 0o600 });
    try {
      chmodSync(path, 0o600);
    } catch {
      /* best effort */
    }
    pruneOldCrashes();
    return path;
  } catch {
    return undefined;
  }
}

/** Path of the most recent crash report, or undefined. */
export function latestCrashReport(): string | undefined {
  try {
    const files = readdirSync(CRASH_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort();
    const last = files.at(-1);
    return last ? resolve(CRASH_DIR, last) : undefined;
  } catch {
    return undefined;
  }
}

export interface CrashHandlerOptions {
  /** Called before exit so buffered state (e.g. metrics) is flushed. */
  onCrash?: () => void;
  /** Sink for the human-readable crash line. Defaults to stderr. */
  writeStderr?: (line: string) => void;
  /** Exit hook (injectable for tests). Defaults to process.exit. */
  exit?: (code: number) => void;
}

let installed = false;

/**
 * Install uncaughtException + unhandledRejection handlers. Idempotent.
 * Each handler writes a redacted crash report, flushes via onCrash, prints a
 * stack to stderr, and exits with a mapped code.
 */
export function installCrashHandlers(options: CrashHandlerOptions = {}): void {
  if (installed) return;
  installed = true;

  const writeStderr = options.writeStderr ?? ((line: string) => process.stderr.write(line));
  const exit = options.exit ?? ((code: number) => process.exit(code));

  const handle = (err: unknown, origin: string) => {
    const path = writeCrashReport(err, { origin });
    try {
      options.onCrash?.();
    } catch {
      /* never let flush failure mask the crash */
    }
    const e = err instanceof Error ? err : new Error(String(err));
    writeStderr(`[MUX] [fatal] ${origin}: ${e.stack || e.message}\n`);
    if (path) writeStderr(`[MUX] crash report written to ${path}\n`);
    exit(mapErrorToExitCode(err));
  };

  process.on('uncaughtException', (err) => handle(err, 'uncaughtException'));
  process.on('unhandledRejection', (reason) => handle(reason, 'unhandledRejection'));
}

/** Test seam: reset the idempotency latch. */
export function __resetCrashHandlersForTest(): void {
  installed = false;
}
