/**
 * Auth action — triggers OAuth for a server from the TUI.
 * Discovers OAuth endpoint, then runs the OAuth flow with browser redirect.
 */
import { getServer } from '../../registry.js';
import { performOAuthFlow } from '../../auth/oauth.js';

export interface AuthResult {
  success: boolean;
  error?: string;
}

/**
 * Discover OAuth config for an HTTP server and trigger the browser-based flow.
 */
export async function authServer(serverName: string): Promise<AuthResult> {
  try {
    const config = getServer(serverName);
    if (!config) {
      return { success: false, error: 'Server not in registry' };
    }
    if (!config.url) {
      return { success: false, error: 'Not an HTTP server' };
    }

    // Discover OAuth metadata from .well-known
    const oauthConfig = await discoverOAuthConfig(config.url);
    if (!oauthConfig) {
      return { success: false, error: 'No OAuth discovery endpoint found' };
    }

    // Run the OAuth flow (opens browser, waits for callback)
    await performOAuthFlow(serverName, oauthConfig);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth failed';
    return { success: false, error: message };
  }
}

/**
 * Probe .well-known/oauth-authorization-server to discover OAuth config.
 */
async function discoverOAuthConfig(
  serverUrl: string,
): Promise<{ tokenEndpoint: string; clientId: string; authorizationEndpoint?: string } | null> {
  const url = new URL(serverUrl);
  const pathSuffix = url.pathname !== '/' ? url.pathname : '';

  const discoveryUrls = [
    ...(pathSuffix ? [`${url.origin}/.well-known/oauth-authorization-server${pathSuffix}`] : []),
    `${url.origin}/.well-known/oauth-authorization-server`,
  ];

  for (const discoveryUrl of discoveryUrls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(discoveryUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const metadata = (await res.json()) as Record<string, unknown>;
        const tokenEndpoint = metadata.token_endpoint as string;
        const authorizationEndpoint = metadata.authorization_endpoint as string;
        const clientId = (metadata.client_id as string) || 'mux';

        if (tokenEndpoint) {
          return { tokenEndpoint, clientId, authorizationEndpoint };
        }
      }
    } catch {
      // Try next URL
    }
  }

  // Fallback: derive token endpoint from server URL pattern
  const tokenEndpoint = `${url.origin}/oauth/token`;
  return { tokenEndpoint, clientId: 'mux', authorizationEndpoint: `${url.origin}/oauth/authorize` };
}
