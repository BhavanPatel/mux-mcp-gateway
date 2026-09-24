/**
 * CLI output + exit-code helpers.
 *
 * Contract (Group 18):
 * - `--json` emits parseable JSON with ZERO ANSI to stdout.
 * - Human output goes to stdout for readable commands, but NEVER interleaves
 *   with the `--json` payload (json mode suppresses human lines).
 * - Distinct exit codes per failure class so scripts can branch.
 *
 * Colour is owned by env-flags/styles (single source). This module does not
 * add ANSI itself, so `--json` output is inherently ANSI-free.
 */

/** Distinct exit codes per failure class. 0 = success. */
export const ExitCode = {
  OK: 0,
  /** Generic / unexpected failure. */
  GENERAL: 1,
  /** Bad usage: unknown command, missing/invalid args. */
  USAGE: 2,
  /** A confirmation was required but not given (no --yes, no TTY). */
  CONFIRMATION_REQUIRED: 3,
  /** The requested target (server, backup, file) was not found. */
  NOT_FOUND: 4,
  /** A write / filesystem mutation failed. */
  WRITE_FAILED: 5,
  /** A network / downstream operation failed. */
  NETWORK: 6,
  /** One or more diagnostic checks failed (doctor/health). */
  CHECK_FAILED: 7,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

export interface OutputMode {
  json: boolean;
}

/**
 * Emit a result. In JSON mode, prints `JSON.stringify(data)` to stdout and
 * nothing else. In human mode, prints `human` (a string or lines) to stdout.
 */
export function emit(mode: OutputMode, data: unknown, human: string | string[]): void {
  if (mode.json) {
    process.stdout.write(JSON.stringify(data) + '\n');
    return;
  }
  const text = Array.isArray(human) ? human.join('\n') : human;
  if (text.length > 0) process.stdout.write(text + '\n');
}

/**
 * Emit an error. In JSON mode, prints `{ error, code }` to stdout (so the
 * payload is still machine-parseable) AND a short line to stderr. In human
 * mode, prints to stderr only.
 */
export function emitError(mode: OutputMode, message: string, code: ExitCodeValue): void {
  if (mode.json) {
    process.stdout.write(JSON.stringify({ error: message, code }) + '\n');
  }
  process.stderr.write(`mux: ${message}\n`);
}

/** True when a mutating command may proceed without interactive confirmation. */
export function canProceedUnconfirmed(autoYes: boolean): boolean {
  return autoYes || Boolean(process.stdin.isTTY);
}
