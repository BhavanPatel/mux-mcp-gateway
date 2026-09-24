/**
 * Group 13 — token store facade (src/auth/index.ts).
 * Regression tests for the single token path, absolute-expiry storage, and the
 * MUX_TOKEN_STORE_PATH split-brain. Runs against the compiled dist output.
 *
 * Run: node --test test/auth/test-token-store.mjs
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync, rmSync, readdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const TEST_DIR = '/tmp/mux-facade-token-test';
const STORE_PATH = resolve(TEST_DIR, 'tokens.json');

// Point every token operation at an isolated store before importing the module.
process.env.MUX_TOKEN_STORE_PATH = STORE_PATH;

const { saveToken, loadToken, readStoredToken, isTokenExpired, deleteToken, getTokenStorePath } = await import(
  resolve(ROOT, 'dist/auth/index.js')
);

before(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  mkdirSync(TEST_DIR, { recursive: true });
});
after(() => rmSync(TEST_DIR, { recursive: true, force: true }));
beforeEach(() => {
  if (existsSync(STORE_PATH)) rmSync(STORE_PATH);
});

describe('facade token store: single path', () => {
  it('honours MUX_TOKEN_STORE_PATH', () => {
    assert.equal(getTokenStorePath(), STORE_PATH);
  });

  it('a token written by one call is read back by another (one store)', () => {
    saveToken('srv', { access_token: 'tok', token_type: 'Bearer', expires_in: 3600 });
    const loaded = loadToken('srv');
    assert.equal(loaded.access_token, 'tok');
    assert.equal(loaded.token_type, 'Bearer');
  });

  it('deletes a token', () => {
    saveToken('gone', { access_token: 'x', expires_in: 3600 });
    assert.ok(loadToken('gone'));
    deleteToken('gone');
    assert.equal(loadToken('gone'), undefined);
  });
});

describe('facade token store: absolute expiry', () => {
  it('converts relative expires_in to an absolute deadline on save', () => {
    const before = Date.now();
    saveToken('exp', { access_token: 'tok', expires_in: 3600 });
    const entry = readStoredToken('exp');
    assert.ok(entry.expiresAt >= before + 3600_000 - 2000);
    assert.ok(entry.expiresAt <= Date.now() + 3600_000 + 2000);
  });

  it('isTokenExpired treats a past deadline as expired (not perpetually fresh)', () => {
    assert.equal(isTokenExpired({ accessToken: 'tok', expiresAt: Date.now() - 1000 }), true);
  });

  it('isTokenExpired respects the 60s buffer', () => {
    assert.equal(isTokenExpired({ accessToken: 't', expiresAt: Date.now() + 30_000 }), true); // within buffer
    assert.equal(isTokenExpired({ accessToken: 't', expiresAt: Date.now() + 120_000 }), false);
  });

  it('loadToken re-derives a relative expires_in from the absolute deadline', () => {
    saveToken('rel', { access_token: 'tok', expires_in: 3600 });
    const loaded = loadToken('rel');
    assert.ok(loaded.expires_in <= 3600 && loaded.expires_in > 3500);
  });

  it('preserves an existing refresh token when the provider omits it', () => {
    saveToken('ref', { access_token: 'a1', refresh_token: 'r1', expires_in: 3600 });
    saveToken('ref', { access_token: 'a2', expires_in: 3600 }); // no refresh_token
    assert.equal(readStoredToken('ref').refreshToken, 'r1');
  });
});

describe('facade token store: two servers, no cross-talk', () => {
  it('writing server B does not affect server A', () => {
    saveToken('A', { access_token: 'aaa', expires_in: 3600 });
    saveToken('B', { access_token: 'bbb', expires_in: 3600 });
    assert.equal(loadToken('A').access_token, 'aaa');
    assert.equal(loadToken('B').access_token, 'bbb');
  });
});

describe('facade token store: atomic writes', () => {
  it('leaves no .tmp file behind after a normal write', () => {
    saveToken('atomic', { access_token: 'x', expires_in: 3600 });
    const leftovers = readdirSync(TEST_DIR).filter((f) => f.endsWith('.tmp'));
    assert.deepEqual(leftovers, []);
  });

  it('rapid sequential saves keep the store parseable and complete', () => {
    for (let i = 0; i < 25; i++) {
      saveToken(`rapid-${i}`, { access_token: `tok-${i}`, expires_in: 3600 });
    }
    for (let i = 0; i < 25; i++) {
      assert.equal(loadToken(`rapid-${i}`).access_token, `tok-${i}`);
    }
  });
});
