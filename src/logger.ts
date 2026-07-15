import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const;
type Level = keyof typeof LEVELS;

const currentLevel: Level = (process.env.MUX_LOG_LEVEL as Level) || 'info';
const logFilePath = resolve(homedir(), '.mux', 'mux.log');
const logToFile = process.env.MUX_LOG_TO_FILE === 'true';

let logDirReady = false;

function ensureLogDir() {
  const dir = dirname(logFilePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function log(level: Level, msg: string, meta?: Record<string, unknown>) {
  if (LEVELS[level] > LEVELS[currentLevel]) return;
  const ts = new Date().toISOString();
  const suffix = meta ? ' ' + JSON.stringify(meta) : '';
  const line = `[MUX] [${level}] [${ts}] ${msg}${suffix}\n`;

  // Always write to stderr
  process.stderr.write(line);

  // Also write to log file if enabled
  if (logToFile) {
    if (!logDirReady) {
      ensureLogDir();
      logDirReady = true;
    }
    try {
      appendFileSync(logFilePath, line);
    } catch {
      // Don't fail on log write errors
    }
  }
}

export const logger = {
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
};
