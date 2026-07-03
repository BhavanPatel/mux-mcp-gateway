const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const;
type Level = keyof typeof LEVELS;

const currentLevel: Level = (process.env.MUX_LOG_LEVEL as Level) || 'info';

function log(level: Level, msg: string, meta?: Record<string, unknown>) {
  if (LEVELS[level] > LEVELS[currentLevel]) return;
  const ts = new Date().toISOString();
  const suffix = meta ? ' ' + JSON.stringify(meta) : '';
  process.stderr.write(`[MUX] [${level}] [${ts}] ${msg}${suffix}\n`);
}

export const logger = {
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
};
