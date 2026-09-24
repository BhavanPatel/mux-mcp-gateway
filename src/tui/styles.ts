/**
 * Color tokens, symbols, and constants for the TUI.
 * Implements the color system from the CLI redesign spec.
 */
import chalk from 'chalk';
import { envFlags } from './env-flags.js';

// WS-B3: honour NO_COLOR / --no-color / --plain (FORCE_COLOR wins). Setting the
// chalk level to 0 turns every colour token below into an identity function, so
// no call site needs to change. Must run before the palette is constructed.
if (envFlags.noColor) {
  chalk.level = 0;
}

// Terminal capability detection
const SUPPORTS_256 =
  process.env.TERM?.includes('256color') || process.env.COLORTERM === 'truecolor' || process.env.COLORTERM === '24bit';

// Color palette — 256-color with 16-color fallback
export const colors = SUPPORTS_256
  ? {
      brandDark: chalk.ansi256(33),
      brandMid: chalk.ansi256(39),
      brandLight: chalk.ansi256(45),
      accent: chalk.ansi256(87),
      accentDim: chalk.ansi256(80),
      textPrimary: chalk.white,
      textBold: chalk.bold.white,
      textSecondary: chalk.ansi256(243),
      textDim: chalk.ansi256(240),
      success: chalk.ansi256(46),
      error: chalk.ansi256(196),
      warning: chalk.ansi256(220),
      barFill: chalk.ansi256(39),
      barEmpty: chalk.ansi256(238),
      chartActive: chalk.ansi256(39),
      chartLow: chalk.ansi256(24),
    }
  : {
      brandDark: chalk.blue,
      brandMid: chalk.blue,
      brandLight: chalk.cyan,
      accent: chalk.cyan,
      accentDim: chalk.cyan.dim,
      textPrimary: chalk.white,
      textBold: chalk.bold.white,
      textSecondary: chalk.gray,
      textDim: chalk.gray.dim,
      success: chalk.green,
      error: chalk.red,
      warning: chalk.yellow,
      barFill: chalk.blue,
      barEmpty: chalk.gray,
      chartActive: chalk.blue,
      chartLow: chalk.gray.dim,
    };

// Status symbols — ASCII fallbacks under --plain (no Unicode glyphs).
export const symbols: Record<string, string> = envFlags.plain
  ? {
      connected: '*',
      disconnected: 'o',
      connecting: '.',
      selected: '>',
      success: '+',
      error: 'x',
      pending: '.',
      attention: '!',
      actions: '-',
      system: 'o',
      scrollMore: 'v',
    }
  : {
      connected: '●',
      disconnected: '○',
      connecting: '◌',
      selected: '▸',
      success: '✓',
      error: '✗',
      pending: '·',
      attention: '◆',
      actions: '◇',
      system: '○',
      scrollMore: '▼',
    };

// Box drawing characters — ASCII fallbacks under --plain.
export const box: Record<string, string> = envFlags.plain
  ? {
      topLeft: '+',
      topRight: '+',
      bottomLeft: '+',
      bottomRight: '+',
      horizontal: '-',
      vertical: '|',
    }
  : {
      topLeft: '╭',
      topRight: '╮',
      bottomLeft: '╰',
      bottomRight: '╯',
      horizontal: '─',
      vertical: '│',
    };

// ASCII banner lines (no color — color applied by Banner component via ink-gradient)
export const BANNER_LINES = [
  '███╗   ███╗██╗   ██╗██╗  ██╗',
  '████╗ ████║██║   ██║╚██╗██╔╝',
  '██╔████╔██║██║   ██║ ╚███╔╝ ',
  '██║╚██╔╝██║██║   ██║ ██╔██╗ ',
  '██║ ╚═╝ ██║╚██████╔╝██╔╝ ██╗',
  '╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═╝',
] as const;
