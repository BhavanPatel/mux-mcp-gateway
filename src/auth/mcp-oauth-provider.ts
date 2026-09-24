import { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type {
  OAuthClientMetadata,
  OAuthClientInformation,
  OAuthTokens,
  OAuthClientInformationFull,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import { createServer, IncomingMessage, ServerResponse, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { logger } from '../logger.js';
import { readSecureJson, writeSecureJson } from './crypto.js';
import { loadToken, saveToken } from './index.js';

const MUX_DIR = resolve(homedir(), '.mux');
const CLIENT_INFO_PATH = resolve(MUX_DIR, 'clients.json');
const CALLBACK_PATH = '/oauth/callback';
const DEFAULT_CALLBACK_TIMEOUT_MS = 120_000;

/** Raised when the callback port is already bound. */
export class CallbackPortInUseError extends Error {
  constructor(port: number, cause?: unknown) {
    super(`OAuth callback port ${port} is already in use`);
    this.name = 'CallbackPortInUseError';
    if (cause) (this as { cause?: unknown }).cause = cause;
  }
}

/** Raised when the provider denies access (OAuth `error` param). */
export class AuthorizationDeniedError extends Error {
  constructor(
    public readonly oauthError: string,
    description?: string,
  ) {
    super(description ? `OAuth error: ${oauthError} — ${description}` : `OAuth error: ${oauthError}`);
    this.name = 'AuthorizationDeniedError';
  }
}

/** Raised when the browser could not be launched. */
export class BrowserOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrowserOpenError';
  }
}

/** Raised when the state parameter does not match what we sent. */
export class StateMismatchError extends Error {
  constructor() {
    super('OAuth state parameter mismatch — possible CSRF, aborting');
    this.name = 'StateMismatchError';
  }
}

interface MuxOAuthProviderOptions {
  clientId?: string;
  scopes?: string[];
  /** Override the callback wait timeout (ms). Primarily for tests. */
  callbackTimeoutMs?: number;
  /**
   * Launch the browser for a URL. Resolves on success, rejects on failure.
   * Injectable for tests. Defaults to the platform opener.
   */
  openBrowser?: (url: string) => Promise<void>;
}

function ensureDir() {
  if (!existsSync(MUX_DIR)) {
    mkdirSync(MUX_DIR, { recursive: true });
    chmodSync(MUX_DIR, 0o700);
  }
}

function readJson(path: string): Record<string, unknown> {
  return readSecureJson(path);
}

function writeJson(path: string, data: unknown) {
  ensureDir();
  writeSecureJson(path, data);
}

/**
 * Open the URL via execFile (argument array, NO shell), so the URL is passed
 * verbatim — `$`, `\`, `&`, etc. are preserved and cannot be shell-interpreted.
 * Rejects on a non-zero exit code or spawn failure so the caller surfaces
 * "no browser" instead of hanging.
 */
function defaultOpenBrowser(url: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    let cmd: string;
    let args: string[];
    if (process.platform === 'darwin') {
      cmd = 'open';
      args = [url];
    } else if (process.platform === 'win32') {
      cmd = 'cmd';
      args = ['/c', 'start', '', url];
    } else {
      cmd = 'xdg-open';
      args = [url];
    }
    execFile(cmd, args, (err) => {
      if (err) {
        reject(new BrowserOpenError(`Failed to open browser (${cmd}): ${err.message}`));
        return;
      }
      resolvePromise();
    });
  });
}

/**
 * OAuth provider for MCP HTTP servers. Token I/O goes through the auth facade
 * (./index.js) — one store, one path, absolute expiry. No mtime polling, no
 * fixed port, no swallowed errors.
 */
export class MuxOAuthProvider implements OAuthClientProvider {
  private serverName: string;
  private options: MuxOAuthProviderOptions;
  private _codeVerifier: string | null = null;
  private _state: string | null = null;
  private _callbackServer: Server | null = null;
  private _boundPort = 0;
  private _authCodePromise: Promise<string> | null = null;
  private readonly _openBrowser: (url: string) => Promise<void>;
  private readonly _callbackTimeoutMs: number;

  constructor(serverName: string, options: MuxOAuthProviderOptions = {}) {
    this.serverName = serverName;
    this.options = options;
    this._openBrowser = options.openBrowser ?? defaultOpenBrowser;
    this._callbackTimeoutMs = options.callbackTimeoutMs ?? DEFAULT_CALLBACK_TIMEOUT_MS;
  }

  /**
   * Wait for the authorization code from the browser callback. Rejects (never
   * hangs, never silently returns null) if the callback errors, times out, or
   * the provider denies access — the real cause propagates to the caller.
   */
  async waitForAuthCode(): Promise<string> {
    if (!this._authCodePromise) {
      throw new Error('waitForAuthCode called before redirectToAuthorization started the callback server');
    }
    return this._authCodePromise;
  }

  get redirectUrl(): string {
    // Valid only after the callback server has bound (see _startCallbackServer).
    return `http://127.0.0.1:${this._boundPort}${CALLBACK_PATH}`;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [this.redirectUrl],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      client_name: `Mux Gateway (${this.serverName})`,
      client_uri: 'https://github.com/mux-mcp-gateway',
    };
  }

  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    const store = readJson(CLIENT_INFO_PATH);
    const stored = store[this.serverName];
    if (stored && typeof stored === 'object') {
      return stored as OAuthClientInformation;
    }
    if (this.options.clientId) {
      logger.debug(`Using pre-registered client "${this.options.clientId}" for "${this.serverName}"`);
      const info: OAuthClientInformationFull = {
        client_id: this.options.clientId,
        redirect_uris: [this.redirectUrl],
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        client_name: `Mux Gateway (${this.serverName})`,
      };
      return info;
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
    return loadToken(this.serverName);
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    saveToken(this.serverName, tokens);
    logger.info(`Tokens saved for "${this.serverName}"`);
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    logger.info(`Starting authorization for "${this.serverName}"...`);

    // 1. Bind the callback server FIRST and await the listen callback, so the
    //    port is open before the browser can redirect back to it.
    const { codePromise } = await this._startCallbackServer();
    this._authCodePromise = codePromise;

    // Ensure the state we validate against is on the outgoing URL.
    if (this._state && !authorizationUrl.searchParams.get('state')) {
      authorizationUrl.searchParams.set('state', this._state);
    }
    const sentState = authorizationUrl.searchParams.get('state');
    if (sentState) this._state = sentState;

    // 2. Now open the browser. If it fails, tear down and surface the cause.
    try {
      await this._openBrowser(authorizationUrl.toString());
    } catch (err) {
      this._closeCallbackServer();
      throw err;
    }

    process.stderr.write(`\n[MUX] Authorization required for "${this.serverName}"\n`);
    process.stderr.write(`[MUX] If your browser didn't open, visit:\n`);
    process.stderr.write(`[MUX] ${authorizationUrl.toString()}\n\n`);
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    this._codeVerifier = codeVerifier;
  }

  async codeVerifier(): Promise<string> {
    if (!this._codeVerifier) {
      // Never send an empty verifier — that silently breaks PKCE. Fail loud.
      throw new Error(
        `PKCE code verifier missing for "${this.serverName}" — saveCodeVerifier was never called before the token exchange`,
      );
    }
    return this._codeVerifier;
  }

  /** SDK hook: generate a fresh, unguessable state value. */
  async state(): Promise<string> {
    if (!this._state) {
      this._state = randomBytes(32).toString('base64url');
    }
    return this._state;
  }

  /**
   * Bind an ephemeral callback server and return a promise for the auth code.
   * The outer promise resolves only once the socket is listening, so callers
   * can safely open the browser afterwards. Always cleans up: on success,
   * error, timeout, denial, or a callback with no code, the server is closed
   * and the timer cleared.
   */
  private _startCallbackServer(): Promise<{ codePromise: Promise<string> }> {
    return new Promise<{ codePromise: Promise<string> }>((resolveOuter, rejectOuter) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let listening = false;

      const codePromise = new Promise<string>((resolveCode, rejectCode) => {
        const cleanup = () => {
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
          this._closeCallbackServer();
        };
        const succeed = (code: string) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolveCode(code);
        };
        const fail = (err: Error) => {
          if (settled) return;
          settled = true;
          cleanup();
          rejectCode(err);
        };

        const server = createServer((req: IncomingMessage, res: ServerResponse) => {
          let url: URL;
          try {
            url = new URL(req.url || '/', `http://127.0.0.1:${this._boundPort}`);
          } catch {
            res.writeHead(400);
            res.end('Bad request');
            return;
          }

          if (url.pathname !== CALLBACK_PATH && url.pathname !== '/callback') {
            res.writeHead(404);
            res.end('Not found');
            return;
          }

          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');
          const returnedState = url.searchParams.get('state');

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`<html><body><h2>Mux: Authorization failed</h2><p>${error}</p></body></html>`);
            fail(new AuthorizationDeniedError(error, url.searchParams.get('error_description') ?? undefined));
            return;
          }

          // Validate state before trusting the code.
          if (this._state && returnedState !== this._state) {
            res.writeHead(400);
            res.end('State mismatch');
            fail(new StateMismatchError());
            return;
          }

          if (!code) {
            res.writeHead(400);
            res.end('No authorization code received');
            fail(new Error(`OAuth callback for "${this.serverName}" arrived without an authorization code`));
            return;
          }

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body><h2>Mux: Authorization successful!</h2><p>You can close this tab.</p></body></html>');
          process.stderr.write(`\r\x1b[K[MUX] ✔ Authorization callback received for "${this.serverName}"\n`);
          succeed(code);
        });

        this._callbackServer = server;

        server.on('error', (err: NodeJS.ErrnoException) => {
          const e =
            err.code === 'EADDRINUSE'
              ? new CallbackPortInUseError(this._boundPort, err)
              : new Error(`Callback server error: ${err.message}`);
          // If the failure happened before listen resolved, surface it to the
          // caller awaiting the outer promise too.
          if (!listening) rejectOuter(e);
          fail(e);
        });

        // Ephemeral port: listen on 0, read the assigned port, THEN resolve.
        server.listen(0, '127.0.0.1', () => {
          listening = true;
          const addr = server.address() as AddressInfo | null;
          this._boundPort = addr ? addr.port : 0;
          logger.debug(`OAuth callback server listening on 127.0.0.1:${this._boundPort}`);

          timer = setTimeout(() => {
            fail(new Error(`OAuth callback timed out after ${this._callbackTimeoutMs}ms`));
          }, this._callbackTimeoutMs);
          if (typeof timer.unref === 'function') timer.unref();

          resolveOuter({ codePromise });
        });
      });

      // Prevent an unhandledRejection if the caller hasn't attached yet.
      codePromise.catch(() => {
        /* handled by caller */
      });
    });
  }

  /** Idempotent teardown: close the server and drop the reference. */
  private _closeCallbackServer(): void {
    if (this._callbackServer) {
      try {
        this._callbackServer.close();
      } catch {
        /* already closing */
      }
      this._callbackServer = null;
    }
  }
}
