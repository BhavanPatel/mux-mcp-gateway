/**
 * Unit tests for TUI environment flags (WS-B3, Testing Group 18: CLI contract).
 *
 * Covers the NO_COLOR / FORCE_COLOR / --no-color / --plain / TTY matrix that
 * gates colour, box-drawing, braille, and the Ink launch.
 *
 * Run: node --test test/unit/test-env-flags.mjs   (requires `npm run build` first)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { computeEnvFlags } = await import(resolve(ROOT, 'dist/tui/env-flags.js'));

test('defaults: colour on, not plain', () => {
  const f = computeEnvFlags([], {}, true);
  assert.equal(f.noColor, false);
  assert.equal(f.plain, false);
  assert.equal(f.isTTY, true);
});

test('NO_COLOR set strips colour', () => {
  assert.equal(computeEnvFlags([], { NO_COLOR: '1' }, true).noColor, true);
});

test('NO_COLOR="0" and "" are treated as unset', () => {
  assert.equal(computeEnvFlags([], { NO_COLOR: '0' }, true).noColor, false);
  assert.equal(computeEnvFlags([], { NO_COLOR: '' }, true).noColor, false);
});

test('--no-color flag strips colour', () => {
  assert.equal(computeEnvFlags(['--no-color'], {}, true).noColor, true);
});

test('--plain implies noColor and plain', () => {
  const f = computeEnvFlags(['--plain'], {}, true);
  assert.equal(f.plain, true);
  assert.equal(f.noColor, true);
});

test('FORCE_COLOR overrides NO_COLOR and --no-color', () => {
  assert.equal(computeEnvFlags(['--no-color'], { NO_COLOR: '1', FORCE_COLOR: '1' }, true).noColor, false);
});

test('FORCE_COLOR does not un-set plain (only colour)', () => {
  const f = computeEnvFlags(['--plain'], { FORCE_COLOR: '1' }, true);
  assert.equal(f.plain, true);
  assert.equal(f.noColor, false, 'FORCE_COLOR wins over --plain for colour');
});

test('isTTY reflects the passed stdout state', () => {
  assert.equal(computeEnvFlags([], {}, false).isTTY, false);
  assert.equal(computeEnvFlags([], {}, true).isTTY, true);
});
