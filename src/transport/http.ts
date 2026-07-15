import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import { ServerConfig } from '../registry.js';
import { logger } from '../logger.js';
import { MuxOAuthProvider } from '../auth/mcp-oauth-provider.js';

export interface HttpDownstreamConnection {
  client: Client;
  transport: StreamableHTTPClientTransport;
  tools: Array<{ name: string; description?: string; inputSchema?: unknown }>;
}

/**
 * Probe the server's OAuth discovery endpoint.
 * Returns true if the server supports OAuth (has .well-known/oauth-authorization-server).
 */
async function hasOAuthDiscovery(serverUrl: string): Promise<boolean> {
  try {
    const url = new URL(serverUrl);
    const discoveryUrl = `${url.origin}/.well-known/oauth-authorization-server`;
    const response = await fetch(discoveryUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const body = await response.json();
      // Validate it's actual OAuth metadata (must have authorization_endpoint)
      return !!(body && body.authorization_endpoint);
    }
    return false;
  } catch {
    return false;
  }
}

export async function connectHttp(name: string, config: ServerConfig): Promise<HttpDownstreamConnection> {
  if (!config.url) throw new Error(`Server "${name}" missing url`);

  logger.info(`Connecting HTTP downstream: ${name}`, { url: config.url });

  // --- Phase 1: Try connecting WITHOUT auth provider first ---
  // This avoids false auth detection for servers that don't need OAuth
  const transportNoAuth = new StreamableHTTPClientTransport(new URL(config.url), {
    requestInit: { headers: config.headers || {} },
  });
  const clientNoAuth = new Client({ name: `mux->${name}`, version: '0.1.0' });

  try {
    await clientNoAuth.connect(transportNoAuth);
    const { tools } = await clientNoAuth.listTools();
    logger.info(`Connected to ${name} (HTTP, no auth): ${tools.length} tools available`);
    return { client: clientNoAuth, transport: transportNoAuth, tools };
  } catch (err: any) {
    // Clean up failed no-auth transport
    try {
      await transportNoAuth.close();
    } catch {
      /* ignore */
    }

    const isUnauthorized =
      err instanceof UnauthorizedError ||
      err.constructor?.name === 'UnauthorizedError' ||
      err.message?.includes('Unauthorized') ||
      err.message?.includes('HTTP 401') ||
      err.message?.includes('401');

    if (!isUnauthorized) {
      // Not an auth error — propagate the real error
      throw err;
    }

    // --- Phase 2: Got 401 — check if server actually supports OAuth ---
    logger.info(`Server "${name}" returned 401. Probing OAuth discovery...`);
    const supportsOAuth = await hasOAuthDiscovery(config.url);

    if (!supportsOAuth) {
      throw new Error(
        `Server "${name}" returned 401 but does not have an OAuth discovery endpoint. ` +
          `Check your headers/API keys in servers.json, or the server may require a different auth mechanism.`,
      );
    }

    // --- Phase 3: Server supports OAuth — do the full auth flow ---
    logger.info(`OAuth discovery confirmed for "${name}", starting authorization flow...`);

    const authProvider = new MuxOAuthProvider(name, {
      clientId: config.auth?.clientId,
      scopes: config.auth?.scopes,
    });

    const transport = new StreamableHTTPClientTransport(new URL(config.url), {
      authProvider,
      requestInit: { headers: config.headers || {} },
    });

    const client = new Client({ name: `mux->${name}`, version: '0.1.0' });

    try {
      await client.connect(transport);
    } catch (authErr: any) {
      const isAuthErr =
        authErr instanceof UnauthorizedError ||
        authErr.constructor?.name === 'UnauthorizedError' ||
        authErr.message?.includes('Unauthorized') ||
        authErr.message?.includes('HTTP 401') ||
        authErr.message?.includes('401');

      if (!isAuthErr) throw authErr;

      logger.info(`OAuth flow triggered for "${name}", waiting for browser authorization...`);

      // Wait for the user to authorize — callback server or token polling will resolve
      const code = await authProvider.waitForAuthCode();

      if (code) {
        // If token was saved externally (redirect flow), skip finishAuth
        if (code === '__TOKEN_ALREADY_SAVED__') {
          logger.info(`Token already saved for "${name}" (external auth flow), reconnecting...`);
        } else {
          logger.info(`Auth code received for "${name}", exchanging for token...`);
          await transport.finishAuth(code);
        }

        // Retry connection with the new token
        const client2 = new Client({ name: `mux->${name}`, version: '0.1.0' });
        const transport2 = new StreamableHTTPClientTransport(new URL(config.url), {
          authProvider,
          requestInit: { headers: config.headers || {} },
        });
        await client2.connect(transport2);

        const { tools } = await client2.listTools();
        logger.info(`Connected to ${name} (HTTP): ${tools.length} tools available`);
        return { client: client2, transport: transport2, tools };
      }

      throw new Error(`Authorization for "${name}" was not completed.`);
    }

    const { tools } = await client.listTools();
    logger.info(`Connected to ${name} (HTTP): ${tools.length} tools available`);
    return { client, transport, tools };
  }
}

export async function disconnectHttp(conn: HttpDownstreamConnection): Promise<void> {
  try {
    await conn.transport.close();
  } catch {
    // ignore close errors
  }
}
