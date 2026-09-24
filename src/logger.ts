/**
 * Logger (WS-C1).
 *
 * Dual sink:
 *  - HUMAN line -> stderr (stdout stays sacred for the MCP protocol on the
 *    gateway path).
 *  - STRUCTURED NDJSON -> ~/.mux/mux.log, one JSON object per line, parseable.
 *
 * File logging is ON by default (a crashed user must have something on disk).
 * Opt out with MUX_LOG_TO_FILE=false. The file is size-capped with a single
 * rotation (mux.log -> mux.log.1) so it can never grow unbounded.
 *
 * All meta is passed through redactValue before either sink — defence in depth
 * on top of call-site redaction.
 */
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { redactValue } from './redact.js';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const;
type Level = keyof typeof LEVELS;

const currentLevel: Level = (process.env.MUX_LOG_LEVEL as Level) || 'info';
const logFilePath = resolve(homedir(), '.mux', 'mux.log');
const rotatedPath = `${logFilePath}.1`;

// On by default; opt out with MUX_LOG_TO_FILE=false.
const logToFile = process.env.MUX_LOG_TO_FILE !== 'false';

// 5 MB cap, single rotated file (<=10 MB total). Overridable but not required.
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const maxBytes = Number(process.env.MUX_LOG_MAX_BYTES) || DEFAULT_MAX_BYTES;

let logDirReady = false;

function ensureLogDir(): void {
  const dir = dirname(logFilePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
}

/** Rotate when the live file has reached the cap. Keeps exactly one old file. */
function rotateIfNeeded(): void {
  try {
    if (!existsSync(logFilePath)) return;
    if (statSync(logFilePath).size < maxBytes) return;
    renameSync(logFilePath, rotatedPath); // overwrites any prior .1
  } catch {
    // Rotation failure must never break logging.
  }
}

function writeFileLine(line: string): void {
  if (!logDirReady) {
    ensureLogDir();
    logDirReady = true;
  }
  rotateIfNeeded();
  try {
    appendFileSync(logFilePath, line, { mode: 0o600 });
    // appendFileSync's mode only applies on create; enforce 0600 if it existed.
    try {
      chmodSync(logFilePath, 0o600);
    } catch {
      /* best effort */
    }
  } catch {
    // Don't fail on log write errors.
  }
}

interface LogMeta {
  [key: string]: unknown;
}

function emit(level: Level, msg: string, meta: LogMeta | undefined, cid: string | undefined): void {
  if (LEVELS[level] > LEVELS[currentLevel]) return;

  const ts = new Date().toISOString();
  const safeMeta = meta ? (redactValue(meta) as LogMeta) : undefined;

  // Human sink -> stderr (never stdout).
  const cidTag = cid ? ` [${cid}]` : '';
  const suffix = safeMeta ? ' ' + JSON.stringify(safeMeta) : '';
  process.stderr.write(`[MUX] [${level}]${cidTag} [${ts}] ${msg}${suffix}\n`);

  // Structured sink -> NDJSON file.
  if (logToFile) {
    const record: Record<string, unknown> = { ts, level, msg };
    if (cid) record.cid = cid;
    if (safeMeta) Object.assign(record, safeMeta);
    writeFileLine(JSON.stringify(record) + '\n');
  }
}

interface LogMetaArg {
  [key: string]: unknown;
}

export interface Logger {
  error: (msg: string, meta?: LogMetaArg) => void;
  warn: (msg: string, meta?: LogMetaArg) => void;
  info: (msg: string, meta?: LogMetaArg) => void;
  debug: (msg: string, meta?: LogMetaArg) => void;
  /** Return a logger whose every line carries this correlation id. */
  child: (cid: string) => Logger;
}

function makeLogger(cid?: string): Logger {
  return {
    error: (msg, meta) => emit('error', msg, meta, cid),
    warn: (msg, meta) => emit('warn', msg, meta, cid),
    info: (msg, meta) => emit('info', msg, meta, cid),
    debug: (msg, meta) => emit('debug', msg, meta, cid),
    child: (childCid: string) => makeLogger(childCid),
  };
}

/** A short, collision-resistant correlation id for a single gateway request. */
export function newCorrelationId(): string {
  return randomBytes(4).toString('hex');
}

export const logger: Logger = makeLogger();
