/**
 * AES-256-GCM encryption for sensitive files (tokens, client registrations).
 *
 * Key derivation: PBKDF2 from machine-specific data (hostname + uid + salt).
 * This prevents casual reads (cat, accidental git commits, backups) but does NOT
 * protect against a targeted attacker with the same user session.
 *
 * File format: JSON wrapper with base64-encoded ciphertext + IV + auth tag.
 * { "v": 1, "enc": "<base64>", "iv": "<base64>", "tag": "<base64>" }
 */
import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, chmodSync, mkdirSync } from 'node:fs';
import { hostname, userInfo } from 'node:os';
import { resolve, dirname } from 'node:path';
import { homedir } from 'node:os';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const SALT_FILE = resolve(homedir(), '.mux', '.salt');
const PBKDF2_ITERATIONS = 100_000;

interface EncryptedPayload {
  v: number; // version
  enc: string; // base64 ciphertext
  iv: string; // base64 IV
  tag: string; // base64 auth tag
}

/**
 * Get or create a persistent random salt.
 * Stored in ~/.mux/.salt (0600 permissions).
 */
function getSalt(): Buffer {
  if (existsSync(SALT_FILE)) {
    return Buffer.from(readFileSync(SALT_FILE, 'utf-8'), 'hex');
  }
  const dir = dirname(SALT_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    chmodSync(dir, 0o700);
  }
  const salt = randomBytes(32);
  writeFileSync(SALT_FILE, salt.toString('hex'), 'utf-8');
  chmodSync(SALT_FILE, 0o600);
  return salt;
}

/**
 * Derive encryption key from machine identity + salt.
 * Uses hostname + uid as the "passphrase" — unique per user per machine.
 */
function deriveKey(): Buffer {
  const salt = getSalt();
  const identity = `${hostname()}:${userInfo().uid}:mux-secrets`;
  return pbkdf2Sync(identity, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (!cachedKey) cachedKey = deriveKey();
  return cachedKey;
}

/**
 * Encrypt a JSON-serializable object.
 */
export function encrypt(data: unknown): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload: EncryptedPayload = {
    v: 1,
    enc: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };

  return JSON.stringify(payload);
}

/**
 * Decrypt an encrypted payload back to a parsed object.
 * Returns null if decryption fails (corrupted/wrong key).
 */
export function decrypt(encryptedStr: string): unknown | null {
  try {
    const payload: EncryptedPayload = JSON.parse(encryptedStr);
    if (payload.v !== 1 || !payload.enc || !payload.iv || !payload.tag) return null;

    const key = getKey();
    const iv = Buffer.from(payload.iv, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');
    const ciphertext = Buffer.from(payload.enc, 'base64');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString('utf-8'));
  } catch {
    return null;
  }
}

/**
 * Check if a string looks like our encrypted format.
 */
export function isEncrypted(content: string): boolean {
  try {
    const parsed = JSON.parse(content);
    return parsed.v === 1 && typeof parsed.enc === 'string' && typeof parsed.iv === 'string';
  } catch {
    return false;
  }
}

/**
 * Read a file, auto-detect if encrypted or plain JSON, return parsed data.
 * If plain JSON is found, automatically encrypts and rewrites it (migration).
 */
export function readSecureJson(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) return {};

  const raw = readFileSync(filePath, 'utf-8').trim();
  if (!raw) return {};

  if (isEncrypted(raw)) {
    const data = decrypt(raw);
    if (data && typeof data === 'object') return data as Record<string, unknown>;
    // Decryption failed — file corrupted or key changed
    return {};
  }

  // Plain JSON detected — migrate to encrypted
  try {
    const data = JSON.parse(raw);
    writeSecureJson(filePath, data);
    return data;
  } catch {
    return {};
  }
}

/**
 * Write data as encrypted JSON to a file with 0600 permissions.
 */
export function writeSecureJson(filePath: string, data: unknown): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    chmodSync(dir, 0o700);
  }
  const encrypted = encrypt(data);
  writeFileSync(filePath, encrypted, 'utf-8');
  chmodSync(filePath, 0o600);
}
