import { readFileSync, writeFileSync, mkdirSync, chmodSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { logger } from '../logger.js';

export interface TokenEntry {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // Unix ms
  scopes?: string[];
}

type TokenStore = Record<string, TokenEntry>;

const DEFAULT_STORE_PATH = resolve(homedir(), '.mux', 'tokens.json');

function getStorePath(): string {
  return process.env.MUX_TOKEN_STORE_PATH || DEFAULT_STORE_PATH;
}

function ensureStoreExists(): void {
  const path = getStorePath();
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(path)) {
    writeFileSync(path, '{}', 'utf-8');
    chmodSync(path, 0o600);
  }
}

function readStore(): TokenStore {
  ensureStoreExists();
  try {
    return JSON.parse(readFileSync(getStorePath(), 'utf-8'));
  } catch {
    return {};
  }
}

function writeStore(store: TokenStore): void {
  ensureStoreExists();
  const path = getStorePath();
  writeFileSync(path, JSON.stringify(store, null, 2), 'utf-8');
  chmodSync(path, 0o600);
}

export function getToken(serverName: string): TokenEntry | undefined {
  const store = readStore();
  const entry = store[serverName];
  if (!entry) return undefined;

  // Check expiry with 60s buffer
  if (entry.expiresAt && Date.now() > entry.expiresAt - 60_000) {
    logger.debug(`Token for "${serverName}" expired or expiring soon`);
    return { ...entry, accessToken: '' }; // Signal needs refresh
  }
  return entry;
}

export function saveToken(serverName: string, token: TokenEntry): void {
  const store = readStore();
  store[serverName] = token;
  writeStore(store);
  logger.debug(`Token saved for "${serverName}"`);
}

export function deleteToken(serverName: string): void {
  const store = readStore();
  delete store[serverName];
  writeStore(store);
}
