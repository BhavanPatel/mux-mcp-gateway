/**
 * Auth facade — the ONLY entry point for OAuth in Mux.
 *
 * Both the runtime HTTP transport (transport/http.ts) and the TUI auth action
 * (tui/actions/auth.ts) go through this module. There is exactly one token
 * store, one path resolution, and one on-disk token shape.
 *
 * On-disk shape (canonical, 2.x): tokens are keyed by server name as
 *   { accessToken, refreshToken?, expiresAt (absolute Unix ms), tokenType, scopes? }
 * The relative `expires_in` the SDK speaks is converted to/from an absolute
 * `expiresAt` deadline here, so a token read from disk after a restart is
 * correctly seen as expired instead of perpetually fresh.
 */
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import type { OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { readSecureJson, writeSecureJson } from './crypto.js';
import { logger } from '../logger.js';
import { MuxOAuthProvider } from './mcp-oauth-provider.js';

/** Slack before real expiry at which we treat a token as stale. */
export const EXPIRY_BUFFER_MS = 60_000;

/** Canonical on-disk token entry. `expiresAt` is absolute Unix ms. */
export interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  scopes?: string[];
}

type TokenStore = Record<string, StoredToken>;

const DEFAULT_TOKEN_PATH = resolve(homedir(), '.mux', 'tokens.json');

/**
 * The single token store path. Honours MUX_TOKEN_STORE_PATH everywhere —
 * the CLI (TUI auth) and the runtime read and write the same file.
 * Read fresh each call so tests can flip the env var between cases.
 */
export function getTokenStorePath(): string {
  return process.env.MUX_TOKEN_STORE_PATH || DEFAULT_TOKEN_PATH;
}

function readStore(): TokenStore {
  return readSecureJson(getTokenStorePath()) as TokenStore;
}

function writeStore(store: TokenStore): void {
  writeSecureJson(getTokenStorePath(), store);
}

/** Raw stored entry for a server, or undefined. No expiry interpretation. */
export function readStoredToken(serverName: string): StoredToken | undefined {
  const entry = readStore()[serverName];
  return entry && typeof entry === 'object' ? entry : undefined;
}

/** True if the token is absent or within EXPIRY_BUFFER_MS of its deadline. */
export function isTokenExpired(entry: StoredToken | undefined): boolean {
  if (!entry || !entry.accessToken) return true;
  if (entry.expiresAt == null) return false; // no known deadline → assume valid
  return Date.now() > entry.expiresAt - EXPIRY_BUFFER_MS;
}

/**
 * Persist a token for a server. Accepts the SDK's relative `expires_in` and
 * converts it to an absolute deadline. Atomic via writeSecureJson.
 */
export function saveToken(serverName: string, tokens: OAuthTokens): void {
  const store = readStore();
  const expiresAt =
    typeof tokens.expires_in === 'number' ? Date.now() + tokens.expires_in * 1000 : store[serverName]?.expiresAt;
  const entry: StoredToken = {
    accessToken: tokens.access_token,
    // Preserve an existing refresh token when the provider doesn't rotate it.
    refreshToken: tokens.refresh_token ?? store[serverName]?.refreshToken,
    expiresAt,
    tokenType: tokens.token_type || 'Bearer',
    scopes: typeof tokens.scope === 'string' ? tokens.scope.split(' ').filter(Boolean) : store[serverName]?.scopes,
  };
  store[serverName] = entry;
  writeStore(store);
  logger.debug(`Token saved for "${serverName}"`);
}

/**
 * Load a token for a server in the SDK's shape, converting the absolute
 * `expiresAt` back to a relative `expires_in` the SDK understands. Returns
 * undefined when there is no usable access token.
 */
export function loadToken(serverName: string): OAuthTokens | undefined {
  const entry = readStoredToken(serverName);
  if (!entry || !entry.accessToken) return undefined;
  const expiresIn =
    entry.expiresAt != null ? Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000)) : undefined;
  const tokens: OAuthTokens = {
    access_token: entry.accessToken,
    token_type: entry.tokenType || 'Bearer',
  };
  if (entry.refreshToken) tokens.refresh_token = entry.refreshToken;
  if (expiresIn != null) tokens.expires_in = expiresIn;
  if (entry.scopes && entry.scopes.length) tokens.scope = entry.scopes.join(' ');
  return tokens;
}

export function deleteToken(serverName: string): void {
  const store = readStore();
  delete store[serverName];
  writeStore(store);
}

export interface AuthProviderOptions {
  clientId?: string;
  scopes?: string[];
}

/** Construct the one OAuth provider implementation. */
export function createAuthProvider(serverName: string, options: AuthProviderOptions = {}): MuxOAuthProvider {
  return new MuxOAuthProvider(serverName, options);
}

export interface AuthenticateResult {
  success: boolean;
  error?: string;
}

/**
 * Drive the full interactive OAuth flow for a server and persist the token.
 * Used by the TUI auth action. Delegates connection/handshake to the runtime
 * HTTP transport path (connectHttp), which already routes through this facade's
 * provider — so there is exactly one auth code path. Any real failure
 * (port busy, browser, denied, timeout) propagates as its actual message.
 */
export async function authenticate(serverName: string, url: string): Promise<AuthenticateResult> {
  // Imported lazily to avoid a cycle (transport/http imports this facade).
  const { connectHttp } = await import('../transport/http.js');
  try {
    const conn = await connectHttp(serverName, { transport: 'http', url });
    try {
      await conn.transport.close();
    } catch {
      /* ignore close error */
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'OAuth failed' };
  }
}

export { MuxOAuthProvider };
