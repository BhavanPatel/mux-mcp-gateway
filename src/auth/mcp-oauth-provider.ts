import { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type {
  OAuthClientMetadata,
  OAuthClientInformation,
  OAuthTokens,
  OAuthClientInformationFull,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { exec } from 'node:child_process';
import { existsSync, mkdirSync, chmodSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { logger } from '../logger.js';
import { readSecureJson, writeSecureJson } from './crypto.js';

const MUX_DIR = resolve(homedir(), '.mux');
const TOKEN_PATH = resolve(MUX_DIR, 'tokens.json');
const CLIENT_INFO_PATH = resolve(MUX_DIR, 'clients.json');
const CALLBACK_PORT = 48912;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/oauth/callback`;

interface MuxOAuthProviderOptions {
  clientId?: string;
  scopes?: string[];
}

function ensureDir() {
  if (!existsSync(MUX_DIR)) {
    mkdirSync(MUX_DIR, { recursive: true });
    chmodSync(MUX_DIR, 0o700);
  }
}

function readJson(path: string): Record<string, any> {
  return readSecureJson(path) as Record<string, any>;
}

function writeJson(path: string, data: any) {
  ensureDir();
  writeSecureJson(path, data);
}

function openBrowser(url: string): void {
  // Sanitize URL to prevent command injection via exec
  const sanitized = url.replace(/["`$\\!]/g, '');
  const cmd =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'start'
        : 'xdg-open';
  exec(`${cmd} "${sanitized}"`);
}

/**
 * OAuth provider that handles the browser-based auth flow for MCP HTTP servers.
 * Supports both:
 * - Dynamic client registration (SDK auto-registers with /register endpoint)
 * - Pre-registered clients (clientId from registry config, skips registration)
 */
export class MuxOAuthProvider implements OAuthClientProvider {
  private serverName: string;
  private options: MuxOAuthProviderOptions;
  private _codeVerifier: string = '';
  private _authResolve: ((code: string) => void) | null = null;
  private _authCodePromise: Promise<string> | null = null;
  private _callbackServer: ReturnType<typeof createServer> | null = null;

  constructor(serverName: string, options: MuxOAuthProviderOptions = {}) {
    this.serverName = serverName;
    this.options = options;
  }

  /**
   * Wait for the auth code from the browser callback OR token file update.
   * Polls tokens.json every 1s so externally-completed auth (redirects that
   * write tokens directly) resolves immediately without waiting full timeout.
   * Also prints a countdown timer to stderr.
   */
  async waitForAuthCode(): Promise<string | null> {
    if (!this._authCodePromise) return null;

    // Race: callback server vs token-file polling
    const tokenPollingPromise = this._pollForTokenCompletion();

    try {
      const result = await Promise.race([this._authCodePromise, tokenPollingPromise]);
      // Stop the polling if callback won
      this._stopPolling();
      this._stopCountdown();
      return result;
    } catch {
      this._stopPolling();
      this._stopCountdown();
      return null;
    }
  }

  private _pollingInterval: ReturnType<typeof setInterval> | null = null;
  private _countdownInterval: ReturnType<typeof setInterval> | null = null;

  private _stopPolling(): void {
    if (this._pollingInterval) {
      clearInterval(this._pollingInterval);
      this._pollingInterval = null;
    }
  }

  private _stopCountdown(): void {
    if (this._countdownInterval) {
      clearInterval(this._countdownInterval);
      this._countdownInterval = null;
      // Clear the timer line
      process.stderr.write('\r\x1b[K');
    }
  }

  /**
   * Poll tokens.json every 1s. If a valid token appears for this server,
   * resolve with a sentinel value indicating auth completed externally.
   * Also drives the countdown timer output.
   */
  private _pollForTokenCompletion(): Promise<string> {
    return new Promise((resolve, reject) => {
      const AUTH_TIMEOUT_S = 120;
      let remaining = AUTH_TIMEOUT_S;

      // Print initial countdown
      process.stderr.write(
        `\r\x1b[K[MUX] ⏳ Waiting for "${this.serverName}" authorization... ${remaining}s remaining`,
      );

      this._countdownInterval = setInterval(() => {
        remaining--;
        if (remaining >= 0) {
          process.stderr.write(
            `\r\x1b[K[MUX] ⏳ Waiting for "${this.serverName}" authorization... ${remaining}s remaining`,
          );
        }
      }, 1000);

      // Record file mtime at auth start — if it changes, tokens were written
      // No decryption needed — just detect the file was modified
      let startMtime = 0;
      try { startMtime = statSync(TOKEN_PATH).mtimeMs; } catch { /* file may not exist yet */ }

      this._pollingInterval = setInterval(() => {
        try {
          if (!existsSync(TOKEN_PATH)) return;
          const currentMtime = statSync(TOKEN_PATH).mtimeMs;
          if (currentMtime > startMtime) {
            // Token file was modified — auth completed externally
            this._stopPolling();
            this._stopCountdown();
            process.stderr.write(`\r\x1b[K[MUX] ✔ Authorization for "${this.serverName}" detected (token received)\n`);
            resolve('__TOKEN_ALREADY_SAVED__');
          }
        } catch {
          // Ignore stat errors, keep polling
        }
      }, 1000);

      // Timeout fallback — reject after AUTH_TIMEOUT_S
      setTimeout(() => {
        this._stopPolling();
        this._stopCountdown();
        reject(new Error(`Token polling timed out (${AUTH_TIMEOUT_S}s)`));
      }, AUTH_TIMEOUT_S * 1000);
    });
  }

  get redirectUrl(): string {
    return REDIRECT_URI;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [REDIRECT_URI],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      client_name: `Mux Gateway (${this.serverName})`,
      client_uri: 'https://github.com/mux-mcp-gateway',
    };
  }

  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    // Check stored client info first (from dynamic registration)
    const store = readJson(CLIENT_INFO_PATH);
    if (store[this.serverName]) return store[this.serverName];

    // If we have a pre-registered clientId from the registry config,
    // return it directly — this skips dynamic client registration
    if (this.options.clientId) {
      logger.debug(`Using pre-registered client "${this.options.clientId}" for "${this.serverName}"`);
      return {
        client_id: this.options.clientId,
        redirect_uris: [REDIRECT_URI],
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        client_name: `Mux Gateway (${this.serverName})`,
      } as OAuthClientInformationFull;
    }

    return undefined;
  }

  async saveClientInformation(info: OAuthClientInformationFull): Promise<void> {
    const store = readJson(CLIENT_INFO_PATH);
    store[this.serverName] = info;
    writeJson(CLIENT_INFO_PATH, store);
    logger.debug(`Client info saved for "${this.serverName}"`);
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    const store = readJson(TOKEN_PATH);
    const entry = store[this.serverName];
    if (!entry) return undefined;
    return {
      access_token: entry.access_token || entry.accessToken,
      refresh_token: entry.refresh_token || entry.refreshToken,
      token_type: entry.token_type || 'Bearer',
      expires_in: entry.expires_in,
    };
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    const store = readJson(TOKEN_PATH);
    store[this.serverName] = tokens;
    writeJson(TOKEN_PATH, store);
    logger.info(`Tokens saved for "${this.serverName}"`);
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    logger.info(`Opening browser for "${this.serverName}" authorization...`);

    // Start callback server — store promise so waitForAuthCode() can await it
    this._authCodePromise = this._startCallbackServer();

    // Open browser
    openBrowser(authorizationUrl.toString());

    // Print to stderr so user sees it in terminal
    process.stderr.write(`\n[MUX] Authorization required for "${this.serverName}"\n`);
    process.stderr.write(`[MUX] If browser doesn't open, visit:\n`);
    process.stderr.write(`[MUX] ${authorizationUrl.toString()}\n\n`);

    // NOTE: We intentionally do NOT await the promise here.
    // The SDK will throw UnauthorizedError, and http.ts will call waitForAuthCode()
    // which awaits the promise, then calls transport.finishAuth(code).
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    this._codeVerifier = codeVerifier;
  }

  async codeVerifier(): Promise<string> {
    return this._codeVerifier;
  }

  private _startCallbackServer(): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._callbackServer?.close();
        reject(new Error('OAuth callback timed out (120s)'));
      }, 120_000);

      this._callbackServer = createServer((req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url || '/', `http://localhost:${CALLBACK_PORT}`);

        if (url.pathname !== '/oauth/callback' && url.pathname !== '/callback') {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<html><body><h2>Mux: Authorization failed</h2><p>${error}</p></body></html>`);
          clearTimeout(timeout);
          this._callbackServer?.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (!code) {
          res.writeHead(400);
          res.end('No code received');
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>Mux: Authorization successful!</h2><p>You can close this tab.</p></body></html>');

        clearTimeout(timeout);
        this._callbackServer?.close();
        this._stopPolling();
        this._stopCountdown();
        process.stderr.write(`\r\x1b[K[MUX] ✔ Authorization callback received for "${this.serverName}"\n`);
        resolve(code);
      });

      this._callbackServer.listen(CALLBACK_PORT, '127.0.0.1', () => {
        logger.debug(`OAuth callback server listening on 127.0.0.1:${CALLBACK_PORT}`);
      });

      this._callbackServer.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Callback server error: ${err.message}`));
      });
    });
  }
}
