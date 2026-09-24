/**
 * Single guarded writer for the server registry (WS-A4).
 *
 * All registry mutations funnel through here so they cannot race each other or
 * the 2s watchFile poll. Guarantees:
 *  - serialized: an in-process async mutex chains every write.
 *  - never destructive: a timestamped backup is written before any mutation.
 *  - atomic: write to a temp file (0600, created with 'wx'), then rename over
 *    the target — a crash or concurrent read never sees a truncated file.
 *  - private: the target is chmod 0600.
 *
 * The registry is stored as plaintext JSON (unlike auth/crypto.ts which
 * encrypts), so this deliberately does not reuse writeSecureJson.
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  unlinkSync,
  chmodSync,
  copyFileSync,
  readdirSync,
} from 'node:fs';
import { dirname, basename, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { parseRegistry, RegistryInput, CURRENT_REGISTRY_VERSION } from './config-schema.js';

const MAX_BACKUPS = parseInt(process.env.MUX_MAX_CONFIG_BACKUPS || '10', 10);

// --- In-process async mutex (promise chain) ---
let writeChain: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T> | T): Promise<T> {
  const run = writeChain.then(fn, fn);
  // Keep the chain alive regardless of this task's outcome.
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    chmodSync(dir, 0o700);
  }
}

/** Write a timestamped backup of an existing registry file. No-op if absent. */
export function backupRegistry(path: string): string | null {
  if (!existsSync(path)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${path}.bak-${stamp}`;
  copyFileSync(path, backupPath);
  chmodSync(backupPath, 0o600);
  pruneBackups(path);
  return backupPath;
}

function pruneBackups(path: string): void {
  try {
    const dir = dirname(path);
    const prefix = `${basename(path)}.bak-`;
    const backups = readdirSync(dir)
      .filter((f) => f.startsWith(prefix))
      .sort(); // ISO timestamps sort lexicographically = chronologically
    while (backups.length > MAX_BACKUPS) {
      const oldest = backups.shift();
      if (oldest) unlinkSync(resolve(dir, oldest));
    }
  } catch {
    // Pruning is best-effort; never fail a write over it.
  }
}

/** Atomic 0600 plaintext write (temp + rename). */
function writeAtomic(path: string, contents: string): void {
  ensureDir(path);
  const tmp = `${path}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    writeFileSync(tmp, contents, { encoding: 'utf-8', mode: 0o600, flag: 'wx' });
    chmodSync(tmp, 0o600);
    renameSync(tmp, path);
    chmodSync(path, 0o600);
  } catch (err) {
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      /* best-effort cleanup */
    }
    throw err;
  }
}

/** Serialize a registry to canonical JSON with a trailing newline. */
function serialize(registry: RegistryInput): string {
  const withVersion = { version: CURRENT_REGISTRY_VERSION, ...registry };
  return JSON.stringify(withVersion, null, 2) + '\n';
}

/**
 * Write a full registry object: backup first, then atomic write. Locked.
 */
export function writeRegistry(path: string, registry: RegistryInput): Promise<void> {
  return withLock(() => {
    backupRegistry(path);
    writeAtomic(path, serialize(registry));
  });
}

export type MutateOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: 'not-found' | 'write-failed'; message: string };

/**
 * Read -> validate -> mutate -> backup -> atomic-write, all under the lock.
 *
 * `fn` receives the current validated registry and returns either the mutated
 * registry to persist, or the sentinel NOT_FOUND to abort without writing
 * (so callers can distinguish "target absent" from "write failed").
 */
export const NOT_FOUND = Symbol('NOT_FOUND');

export function mutateRegistry(
  path: string,
  fn: (current: RegistryInput) => RegistryInput | typeof NOT_FOUND,
): Promise<MutateOutcome<void>> {
  return withLock<MutateOutcome<void>>(() => {
    let current: RegistryInput;
    if (existsSync(path)) {
      // Reuse the fail-closed parser: a corrupt file must not be silently reset.
      current = parseRegistry(readFileSync(path, 'utf-8'));
    } else {
      current = { version: CURRENT_REGISTRY_VERSION, servers: {} };
    }

    const next = fn(current);
    if (next === NOT_FOUND) {
      return { ok: false, error: 'not-found', message: 'target not found in registry' };
    }

    try {
      backupRegistry(path);
      writeAtomic(path, serialize(next));
      return { ok: true, value: undefined };
    } catch (err: any) {
      return { ok: false, error: 'write-failed', message: err?.message || 'write failed' };
    }
  });
}

/** Restore the most recent backup over the live file. Used by `mux config restore`. */
export function restoreLatestBackup(path: string): Promise<MutateOutcome<string>> {
  return withLock<MutateOutcome<string>>(() => {
    const dir = dirname(path);
    const prefix = `${basename(path)}.bak-`;
    let backups: string[] = [];
    try {
      backups = readdirSync(dir)
        .filter((f) => f.startsWith(prefix))
        .sort();
    } catch {
      backups = [];
    }
    const latest = backups[backups.length - 1];
    if (!latest) return { ok: false, error: 'not-found', message: 'no backup found' };
    try {
      const src = resolve(dir, latest);
      writeAtomic(path, readFileSync(src, 'utf-8'));
      return { ok: true, value: src };
    } catch (err: any) {
      return { ok: false, error: 'write-failed', message: err?.message || 'restore failed' };
    }
  });
}
