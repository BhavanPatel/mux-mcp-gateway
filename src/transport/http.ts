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

export async function connectHttp(name: string, config: ServerConfig): Promise<HttpDownstreamConnection> {
  if (!config.url) throw new Error(`Server "${name}" missing url`);

  logger.info(`Connecting HTTP downstream: ${name}`, { url: config.url });

  const authProvider = new MuxOAuthProvider(name, {
    clientId: config.auth?.clientId,
    scopes: config.auth?.scopes,
  });

  const transport = new StreamableHTTPClientTransport(
    new URL(config.url),
    {
      authProvider,
      requestInit: { headers: config.headers || {} },
    }
  );

  const client = new Client({ name: `mux->${name}`, version: '0.1.0' });

  try {
    await client.connect(transport);
  } catch (err: any) {
    if (err instanceof UnauthorizedError || err.constructor?.name === 'UnauthorizedError' || err.message?.includes('Unauthorized')) {
      logger.info(`OAuth flow triggered for "${name}", waiting for browser authorization...`);

      // The authProvider.redirectToAuthorization() was called by the SDK,
      // which started the callback server and opened the browser.
      // Wait for the user to authorize — the callback server will resolve with the code.
      const code = await authProvider.waitForAuthCode();

      if (code) {
        logger.info(`Auth code received for "${name}", exchanging for token...`);
        // Tell the transport about the auth code so it can exchange for tokens
        await transport.finishAuth(code);

        // Retry connection with the new token
        const client2 = new Client({ name: `mux->${name}`, version: '0.1.0' });
        const transport2 = new StreamableHTTPClientTransport(
          new URL(config.url),
          {
            authProvider,
            requestInit: { headers: config.headers || {} },
          }
        );
        await client2.connect(transport2);

        const { tools } = await client2.listTools();
        logger.info(`Connected to ${name} (HTTP): ${tools.length} tools available`);
        return { client: client2, transport: transport2, tools };
      }

      throw new Error(`Authorization for "${name}" was not completed.`);
    }
    throw err;
  }

  const { tools } = await client.listTools();
  logger.info(`Connected to ${name} (HTTP): ${tools.length} tools available`);

  return { client, transport, tools };
}

export async function disconnectHttp(conn: HttpDownstreamConnection): Promise<void> {
  try {
    await conn.transport.close();
  } catch {
    // ignore close errors
  }
}
