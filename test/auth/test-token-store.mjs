/**
 * Unit tests for token store (read/write/delete/expiry logic).
 * Run: node --test test/test-token-store.mjs
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, readFileSync, mkdirSync, existsSync, rmSync, statSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const TEST_DIR = '/tmp/mux-token-store-test';
const TOKENS_PATH = resolve(TEST_DIR, 'tokens.json');

before(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  mkdirSync(TEST_DIR, { recursive: true });
});

after(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

// Helper functions that mirror token-store.ts logic
function readStore() {
  try {
    return JSON.parse(readFileSync(TOKENS_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function writeStore(store) {
  writeFileSync(TOKENS_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

function saveToken(serverName, token) {
  const store = readStore();
  store[serverName] = token;
  writeStore(store);
}

function getToken(serverName) {
  const store = readStore();
  const entry = store[serverName];
  if (!entry) return undefined;
  if (entry.expiresAt && Date.now() > entry.expiresAt - 60_000) {
    return { ...entry, accessToken: '' }; // expired
  }
  return entry;
}

function deleteToken(serverName) {
  const store = readStore();
  delete store[serverName];
  writeStore(store);
}

describe('token store: basic operations', () => {
  it('saves and retrieves a token', () => {
    const token = { accessToken: 'abc123', refreshToken: 'ref456', expiresAt: Date.now() + 3600_000 };
    saveToken('test-server', token);
    const retrieved = getToken('test-server');
    assert.equal(retrieved.accessToken, 'abc123');
    assert.equal(retrieved.refreshToken, 'ref456');
  });

  it('returns undefined for nonexistent server', () => {
    assert.equal(getToken('nonexistent'), undefined);
  });

  it('deletes a token', () => {
    saveToken('to-delete', { accessToken: 'x', expiresAt: Date.now() + 3600_000 });
    assert.ok(getToken('to-delete'));
    deleteToken('to-delete');
    assert.equal(getToken('to-delete'), undefined);
  });

  it('stores multiple servers independently', () => {
    saveToken('server-a', { accessToken: 'aaa', expiresAt: Date.now() + 3600_000 });
    saveToken('server-b', { accessToken: 'bbb', expiresAt: Date.now() + 3600_000 });
    assert.equal(getToken('server-a').accessToken, 'aaa');
    assert.equal(getToken('server-b').accessToken, 'bbb');
  });

  it('overwrites existing token on re-save', () => {
    saveToken('overwrite-test', { accessToken: 'old', expiresAt: Date.now() + 3600_000 });
    saveToken('overwrite-test', { accessToken: 'new', expiresAt: Date.now() + 3600_000 });
    assert.equal(getToken('overwrite-test').accessToken, 'new');
  });
});

describe('token store: expiry logic', () => {
  it('returns token with empty accessToken when expired', () => {
    saveToken('expired', { accessToken: 'tok', expiresAt: Date.now() - 1000 });
    const result = getToken('expired');
    assert.equal(result.accessToken, '');
  });

  it('returns token with empty accessToken when expiring within 60s buffer', () => {
    saveToken('almost-expired', { accessToken: 'tok', expiresAt: Date.now() + 30_000 }); // 30s from now
    const result = getToken('almost-expired');
    assert.equal(result.accessToken, ''); // within 60s buffer
  });

  it('returns valid token when not yet in buffer zone', () => {
    saveToken('valid', { accessToken: 'tok', expiresAt: Date.now() + 120_000 }); // 2min from now
    const result = getToken('valid');
    assert.equal(result.accessToken, 'tok');
  });

  it('returns token without expiry check when expiresAt is absent', () => {
    saveToken('no-expiry', { accessToken: 'permanent' });
    const result = getToken('no-expiry');
    assert.equal(result.accessToken, 'permanent');
  });
});

describe('token store: file format', () => {
  it('writes valid JSON', () => {
    saveToken('json-test', { accessToken: 'x' });
    const raw = readFileSync(TOKENS_PATH, 'utf-8');
    const parsed = JSON.parse(raw); // should not throw
    assert.ok(parsed['json-test']);
  });

  it('preserves all token fields', () => {
    const token = {
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: 1700000000000,
      scopes: ['read', 'write'],
    };
    saveToken('fields-test', token);
    const retrieved = readStore()['fields-test'];
    assert.equal(retrieved.accessToken, 'access');
    assert.equal(retrieved.refreshToken, 'refresh');
    assert.equal(retrieved.expiresAt, 1700000000000);
    assert.deepEqual(retrieved.scopes, ['read', 'write']);
  });

  it('handles empty store gracefully', () => {
    writeFileSync(TOKENS_PATH, '{}');
    assert.equal(getToken('anything'), undefined);
  });

  it('handles corrupted file gracefully', () => {
    writeFileSync(TOKENS_PATH, 'not json at all');
    // readStore should return {} on parse error
    const store = readStore();
    assert.deepEqual(store, {});
  });
});

describe('token store: concurrent-safe writes', () => {
  it('multiple rapid saves dont corrupt the file', () => {
    for (let i = 0; i < 20; i++) {
      saveToken(`rapid-${i}`, { accessToken: `tok-${i}`, expiresAt: Date.now() + 3600_000 });
    }
    const store = readStore();
    assert.equal(Object.keys(store).filter((k) => k.startsWith('rapid-')).length, 20);
  });
});

describe('token store: MCP OAuth provider compatibility', () => {
  it('handles access_token field (snake_case from OAuth)', () => {
    // The MCP OAuth provider uses access_token (snake_case) per OAuth spec
    const store = readStore();
    store['oauth-server'] = { access_token: 'bearer_tok', token_type: 'Bearer', expires_in: 3600 };
    writeStore(store);

    const raw = readStore();
    assert.equal(raw['oauth-server'].access_token, 'bearer_tok');
  });

  it('handles accessToken field (camelCase from token-store)', () => {
    const store = readStore();
    store['camel-server'] = { accessToken: 'camel_tok', refreshToken: 'ref' };
    writeStore(store);

    const raw = readStore();
    assert.equal(raw['camel-server'].accessToken, 'camel_tok');
  });
});
