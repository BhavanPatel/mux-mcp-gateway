import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { URL, URLSearchParams } from 'node:url';
import { randomBytes } from 'node:crypto';
import { exec } from 'node:child_process';
import { logger } from '../logger.js';
import { saveToken, TokenEntry } from './token-store.js';

interface OAuthConfig {
  tokenEndpoint: string;
  clientId: string;
  scopes?: string[];
  authorizationEndpoint?: string; // If not provided, derive from tokenEndpoint
}

const CALLBACK_PORT = 48912;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;

function openBrowser(url: string): void {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${cmd} "${url}"`);
}

function deriveAuthEndpoint(tokenEndpoint: string): string {
  // Common patterns: /oauth/token -> /oauth/authorize, /token -> /authorize
  return tokenEndpoint.replace(/\/token\/?$/, '/authorize');
}

export async function performOAuthFlow(serverName: string, config: OAuthConfig): Promise<TokenEntry> {
  const state = randomBytes(16).toString('hex');
  const authEndpoint = config.authorizationEndpoint || deriveAuthEndpoint(config.tokenEndpoint);

  const authUrl = new URL(authEndpoint);
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);
  if (config.scopes?.length) authUrl.searchParams.set('scope', config.scopes.join(' '));

  return new Promise<TokenEntry>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('OAuth flow timed out (120s)'));
    }, 120_000);

    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const reqUrl = new URL(req.url || '/', `http://localhost:${CALLBACK_PORT}`);

      if (reqUrl.pathname !== '/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = reqUrl.searchParams.get('code');
      const returnedState = reqUrl.searchParams.get('state');

      if (returnedState !== state) {
        res.writeHead(400);
        res.end('State mismatch');
        return;
      }

      if (!code) {
        res.writeHead(400);
        res.end('No authorization code received');
        return;
      }

      // Exchange code for tokens
      try {
        const tokenRes = await fetch(config.tokenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: config.clientId,
            code,
            redirect_uri: REDIRECT_URI,
          }).toString(),
        });

        if (!tokenRes.ok) {
          throw new Error(`Token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
        }

        const data = (await tokenRes.json()) as any;
        const token: TokenEntry = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
          scopes: config.scopes,
        };

        saveToken(serverName, token);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>Mux: Authentication successful!</h2><p>You can close this tab.</p></body></html>');

        clearTimeout(timeout);
        server.close();
        resolve(token);
      } catch (err: any) {
        res.writeHead(500);
        res.end(`Token exchange error: ${err.message}`);
        clearTimeout(timeout);
        server.close();
        reject(err);
      }
    });

    server.listen(CALLBACK_PORT, () => {
      logger.info(`OAuth: opening browser for "${serverName}"...`);
      openBrowser(authUrl.toString());
    });

    server.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`OAuth callback server failed: ${err.message}`));
    });
  });
}

export async function refreshAccessToken(
  serverName: string,
  config: OAuthConfig,
  refreshToken: string,
): Promise<TokenEntry> {
  logger.info(`Refreshing token for "${serverName}"...`);

  const res = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as any;
  const token: TokenEntry = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // Some providers don't rotate refresh tokens
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    scopes: config.scopes,
  };

  saveToken(serverName, token);
  logger.info(`Token refreshed for "${serverName}"`);
  return token;
}
