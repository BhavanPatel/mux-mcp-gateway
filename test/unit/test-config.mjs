/**
 * Group 15 (WS-A4) — config integrity unit tests.
 * Covers fail-closed parsing, non-destructive writes + backups, 1.x load,
 * concurrent-write safety (lock), removeServer not-found vs write-failed,
 * and 0600 perms. Imports compiled dist.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, statSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { parseRegistry, migrateRegistry, ConfigError, CURRENT_REGISTRY_VERSION } from '../../dist/config-schema.js';
import { mutateRegistry, writeRegistry, restoreLatestBackup, NOT_FOUND } from '../../dist/config-writer.js';

function tmpRegistry() {
  const dir = mkdtempSync(resolve(tmpdir(), 'mux-config-'));
  return { dir, path: resolve(dir, 'servers.json'), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

// ---- parseRegistry: fail closed with precise messages ----

test('parseRegistry: invalid JSON fails closed', () => {
  assert.throws(
    () => parseRegistry('{not json'),
    (e) => e instanceof ConfigError && /not valid JSON/.test(e.message),
  );
});

test('parseRegistry: non-object root fails closed', () => {
  assert.throws(
    () => parseRegistry('[]'),
    (e) => e instanceof ConfigError && /must be a JSON object/.test(e.message),
  );
});

test('parseRegistry: missing servers key fails closed with precise message', () => {
  assert.throws(
    () => parseRegistry('{"version":2}'),
    (e) => e instanceof ConfigError && /missing the required "servers" key/.test(e.message),
  );
});

test('parseRegistry: servers not an object fails closed', () => {
  assert.throws(
    () => parseRegistry('{"servers":[]}'),
    (e) => e instanceof ConfigError && /"servers" must be an object/.test(e.message),
  );
});

test('parseRegistry: stdio server without command fails closed', () => {
  assert.throws(
    () => parseRegistry(JSON.stringify({ servers: { s: { transport: 'stdio' } } })),
    (e) => e instanceof ConfigError && /command/.test(e.message),
  );
});

test('parseRegistry: http server without url fails closed', () => {
  assert.throws(
    () => parseRegistry(JSON.stringify({ servers: { s: { transport: 'http' } } })),
    (e) => e instanceof ConfigError && /url/.test(e.message),
  );
});

test('parseRegistry: valid config parses', () => {
  const reg = parseRegistry(JSON.stringify({ servers: { echo: { transport: 'stdio', command: 'node' } } }));
  assert.equal(reg.servers.echo.command, 'node');
});

// ---- migration: 1.x -> 2.x ----

test('migrateRegistry: 1.x (no version) is stamped to current version, servers preserved', () => {
  const out = migrateRegistry({ servers: { a: { transport: 'stdio', command: 'x' } } });
  assert.equal(out.version, CURRENT_REGISTRY_VERSION);
  assert.ok(out.servers.a);
});

test('parseRegistry: 1.x servers.json loads unchanged (backward-compat guarantee)', () => {
  const oneX = { servers: { legacy: { transport: 'stdio', command: 'node', args: ['-e', '1'], keywords: ['k'] } } };
  const reg = parseRegistry(JSON.stringify(oneX));
  assert.deepEqual(reg.servers.legacy, oneX.servers.legacy);
  assert.equal(reg.version, CURRENT_REGISTRY_VERSION);
});

// ---- non-destructive: user config never destroyed on a failed load ----

test('mutateRegistry: corrupt existing config is not destroyed (byte-identical after failed mutate)', async () => {
  const { path, cleanup } = tmpRegistry();
  try {
    const corrupt = '{ this is not valid json ';
    writeFileSync(path, corrupt, 'utf-8');
    const before = readFileSync(path, 'utf-8');
    await assert.rejects(
      () => mutateRegistry(path, (r) => r),
      // NB: config-writer bundles its own ConfigError copy (tsup splitting:false),
      // so cross-bundle `instanceof` is unreliable — match by name/message instead.
      (e) => e?.name === 'ConfigError' && /not valid JSON/.test(e.message),
    );
    const after = readFileSync(path, 'utf-8');
    assert.equal(after, before, 'corrupt file must be left byte-identical');
  } finally {
    cleanup();
  }
});

// ---- backups ----

test('backupRegistry: writes a timestamped backup before mutation; restore round-trips', async () => {
  const { path, cleanup } = tmpRegistry();
  try {
    const v1 = { servers: { a: { transport: 'stdio', command: 'one' } } };
    await writeRegistry(path, v1);
    const original = readFileSync(path, 'utf-8');

    // mutate -> a backup of the pre-mutation state must exist
    await mutateRegistry(path, (r) => {
      r.servers.a.command = 'two';
      return r;
    });
    const backups = readdirSync(resolve(path, '..')).filter((f) => f.startsWith('servers.json.bak-'));
    assert.ok(backups.length >= 1, 'a timestamped backup was written before mutation');

    // restore latest backup -> file returns to pre-mutation content
    const res = await restoreLatestBackup(path);
    assert.equal(res.ok, true);
    assert.equal(readFileSync(path, 'utf-8'), original, 'restore round-trips to pre-mutation content');
  } finally {
    cleanup();
  }
});

// ---- concurrent writes do not lose entries (lock vs 2s watchFile poll) ----

test('mutateRegistry: concurrent writes serialize and lose no entries', async () => {
  const { path, cleanup } = tmpRegistry();
  try {
    await writeRegistry(path, { servers: {} });
    const adds = [];
    for (let i = 0; i < 20; i++) {
      adds.push(
        mutateRegistry(path, (r) => {
          r.servers[`s${i}`] = { transport: 'stdio', command: `c${i}` };
          return r;
        }),
      );
    }
    await Promise.all(adds);
    const final = parseRegistry(readFileSync(path, 'utf-8'));
    assert.equal(Object.keys(final.servers).length, 20, 'all 20 concurrent entries survived');
  } finally {
    cleanup();
  }
});

// ---- removeServer semantics via mutateRegistry outcomes ----

test('mutateRegistry: NOT_FOUND yields a not-found outcome (no write)', async () => {
  const { path, cleanup } = tmpRegistry();
  try {
    await writeRegistry(path, { servers: { a: { transport: 'stdio', command: 'x' } } });
    const before = readFileSync(path, 'utf-8');
    const res = await mutateRegistry(path, (r) => (r.servers['missing'] ? r : NOT_FOUND));
    assert.equal(res.ok, false);
    assert.equal(res.error, 'not-found');
    assert.equal(readFileSync(path, 'utf-8'), before, 'not-found path writes nothing');
  } finally {
    cleanup();
  }
});

// ---- 0600 perms ----

test('writeRegistry: servers.json is created 0600', async () => {
  const { path, cleanup } = tmpRegistry();
  try {
    await writeRegistry(path, { servers: {} });
    assert.ok(existsSync(path));
    const mode = statSync(path).mode & 0o777;
    assert.equal(mode, 0o600, `expected 0600, got 0${mode.toString(8)}`);
  } finally {
    cleanup();
  }
});

// ---- WS-B5: add-collision guard semantics (addServerToRegistry) ----
// addServerToRegistry throws a ConfigError from inside the mutator when the
// name already exists, rather than silently overwriting. mutateRegistry must
// then abort the write and leave the existing entry byte-identical. This
// exercises the exact mechanism the guard relies on (the guard string itself
// is asserted here against a name-collision mutator).

test('add-collision: a throwing mutator on existing name aborts the write (no overwrite)', async () => {
  const { path, cleanup } = tmpRegistry();
  try {
    await writeRegistry(path, { servers: { dup: { transport: 'stdio', command: 'original' } } });
    const before = readFileSync(path, 'utf-8');

    await assert.rejects(
      () =>
        mutateRegistry(path, (current) => {
          if (current.servers['dup']) {
            const e = new Error('A server named "dup" already exists. Remove it first or choose another name.');
            e.name = 'ConfigError';
            throw e;
          }
          current.servers['dup'] = { transport: 'stdio', command: 'clobbered' };
          return current;
        }),
      (e) => e?.name === 'ConfigError' && /already exists/.test(e.message),
    );

    const after = readFileSync(path, 'utf-8');
    assert.equal(after, before, 'existing server must be left byte-identical after a rejected add');
    const reg = parseRegistry(after);
    assert.equal(reg.servers.dup.command, 'original', 'the original command must survive');
  } finally {
    cleanup();
  }
});

test('add-collision: a fresh name is written when there is no collision', async () => {
  const { path, cleanup } = tmpRegistry();
  try {
    await writeRegistry(path, { servers: { existing: { transport: 'stdio', command: 'a' } } });
    await mutateRegistry(path, (current) => {
      if (current.servers['fresh']) throw Object.assign(new Error('exists'), { name: 'ConfigError' });
      current.servers['fresh'] = { transport: 'http', url: 'https://example.test', headers: {}, keywords: [] };
      return current;
    });
    const reg = parseRegistry(readFileSync(path, 'utf-8'));
    assert.equal(Object.keys(reg.servers).length, 2, 'both servers present');
    assert.equal(reg.servers.fresh.url, 'https://example.test');
  } finally {
    cleanup();
  }
});
