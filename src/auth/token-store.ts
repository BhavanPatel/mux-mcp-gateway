import { existsSync, mkdirSync, chmodSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { logger } from '../logger.js';
import { readSecureJson, writeSecureJson } from './crypto.js';

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

function ensureStoreDir(): void {
  const path = getStorePath();
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    chmodSync(dir, 0o700);
  }
}

function readStore(): TokenStore {
  ensureStoreDir();
  return readSecureJson(getStorePath()) as TokenStore;
}

function writeStore(store: TokenStore): void {
  ensureStoreDir();
  writeSecureJson(getStorePath(), store);
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
