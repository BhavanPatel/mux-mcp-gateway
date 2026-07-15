#!/usr/bin/env node
/**
 * CLI helper: reads encrypted tokens.json and outputs token status.
 * Used by auth.sh and other CLI scripts that need to check token status.
 *
 * Usage:
 *   node scripts/lib/read-tokens.mjs                  # outputs full JSON
 *   node scripts/lib/read-tokens.mjs <server>         # outputs "yes" or "no"
 *   node scripts/lib/read-tokens.mjs --list-authed    # outputs server names with tokens
 */
import { createDecipheriv, pbkdf2Sync } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { hostname, userInfo, homedir } from 'node:os';

const MUX_DIR = resolve(homedir(), '.mux');
const SALT_FILE = resolve(MUX_DIR, '.salt');
const TOKENS_PATH = process.env.MUX_TOKEN_STORE_PATH || resolve(MUX_DIR, 'tokens.json');

function getSalt() {
  if (existsSync(SALT_FILE)) return Buffer.from(readFileSync(SALT_FILE, 'utf-8'), 'hex');
  return null;
}

function deriveKey(salt) {
  const identity = `${hostname()}:${userInfo().uid}:mux-secrets`;
  return pbkdf2Sync(identity, salt, 100_000, 32, 'sha512');
}

function readTokens() {
  if (!existsSync(TOKENS_PATH)) return {};
  const raw = readFileSync(TOKENS_PATH, 'utf-8').trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    // Encrypted format
    if (parsed.v === 1 && parsed.enc && parsed.iv && parsed.tag) {
      const salt = getSalt();
      if (!salt) return {};
      const key = deriveKey(salt);
      const iv = Buffer.from(parsed.iv, 'base64');
      const tag = Buffer.from(parsed.tag, 'base64');
      const ciphertext = Buffer.from(parsed.enc, 'base64');
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return JSON.parse(decrypted.toString('utf-8'));
    }
    // Plain JSON (legacy/not yet migrated)
    return parsed;
  } catch {
    return {};
  }
}

const args = process.argv.slice(2);
const tokens = readTokens();

if (args[0] === '--list-authed') {
  // Output server names that have tokens
  for (const [name, entry] of Object.entries(tokens)) {
    if (entry.access_token || entry.accessToken) {
      console.log(name);
    }
  }
} else if (args[0]) {
  // Check specific server
  const entry = tokens[args[0]] || {};
  const has = !!(entry.access_token || entry.accessToken);
  process.stdout.write(has ? 'yes' : 'no');
} else {
  // Output server names with auth status (never outputs actual token values)
  for (const [name, entry] of Object.entries(tokens)) {
    const has = !!(entry.access_token || entry.accessToken);
    console.log(`${name}: ${has ? 'authorized' : 'no token'}`);
  }
  if (Object.keys(tokens).length === 0) {
    console.log('(no tokens stored)');
  }
}
