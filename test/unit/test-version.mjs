/**
 * Unit tests for version single-sourcing (WS-B2, Testing Group 18: CLI contract).
 *
 * Regression guard for the "three different versions in one product" defect:
 * package.json was 1.10.0, App.tsx hardcoded '1.4.2', and server/stdio/http
 * hardcoded '0.1.0'. Everything now derives from src/version.ts -> package.json.
 *
 * Run: node --test test/unit/test-version.mjs   (requires `npm run build` first)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const { VERSION } = await import(resolve(ROOT, 'dist/version.js'));

test('VERSION is single-sourced from package.json', () => {
  assert.equal(VERSION, pkg.version);
});

test('VERSION resolved a real version, not the fallback', () => {
  assert.notEqual(VERSION, '0.0.0-unknown');
  assert.match(VERSION, /^\d+\.\d+\.\d+/);
});

test('no stale hardcoded version literals survive in built output', () => {
  const distDir = resolve(ROOT, 'dist');
  const stale = ["'1.4.2'", "'0.1.0'", '"1.4.2"', '"0.1.0"'];
  const offenders = [];
  for (const file of readdirSync(distDir, { recursive: true })) {
    if (typeof file !== 'string' || !file.endsWith('.js')) continue;
    const contents = readFileSync(join(distDir, file), 'utf8');
    for (const lit of stale) {
      if (contents.includes(lit)) offenders.push(`${file}: ${lit}`);
    }
  }
  assert.deepEqual(offenders, [], `stale version literals in dist: ${offenders.join(', ')}`);
});
