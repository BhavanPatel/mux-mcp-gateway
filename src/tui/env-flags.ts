/**
 * Runtime environment flags for the TUI render layer (WS-B3).
 *
 * Single source of truth for how output should be rendered, derived once from
 * argv + environment. Kept dependency-free and pure so it can be imported at
 * module-init time (styles.ts builds its palette from these) and unit-tested
 * without a terminal.
 *
 * - noColor: strip all ANSI colour. Honours the NO_COLOR convention
 *   (https://no-color.org), an explicit `--no-color`/`--plain` flag, and is
 *   overridden by FORCE_COLOR. When true, chalk.level is set to 0 so every
 *   colour token becomes an identity function with no call-site changes.
 * - plain: `--plain` — no box-drawing characters and no braille spinners; use
 *   ASCII fallbacks. Implies noColor.
 * - isTTY: whether stdout is an interactive terminal. Gates the Ink launch.
 */

export interface EnvFlags {
  noColor: boolean;
  plain: boolean;
  isTTY: boolean;
}

/** Truthy for any non-empty, non-"0" value (matches FORCE_COLOR/NO_COLOR conventions). */
function envSet(value: string | undefined): boolean {
  return value !== undefined && value !== '' && value !== '0';
}

export function computeEnvFlags(
  argv: readonly string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env,
  stdoutIsTTY: boolean = Boolean(process.stdout.isTTY),
): EnvFlags {
  const plain = argv.includes('--plain');
  const forceColor = envSet(env.FORCE_COLOR);
  const noColor = !forceColor && (plain || argv.includes('--no-color') || envSet(env.NO_COLOR));

  return { noColor, plain, isTTY: stdoutIsTTY };
}

/** Flags for the current process, evaluated once at import time. */
export const envFlags: EnvFlags = computeEnvFlags();
