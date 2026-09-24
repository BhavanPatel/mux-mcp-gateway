/**
 * Auth action — triggers OAuth for a server from the TUI.
 * Routes through the single auth facade (src/auth/index.ts), which owns
 * discovery, the browser flow, and token persistence. There is no separate
 * TUI-only OAuth path anymore.
 */
import { getServer } from '../../registry.js';
import { authenticate } from '../../auth/index.js';

export interface AuthResult {
  success: boolean;
  error?: string;
}

/**
 * Trigger the browser-based OAuth flow for an HTTP server via the facade.
 */
export async function authServer(serverName: string): Promise<AuthResult> {
  const config = getServer(serverName);
  if (!config) {
    return { success: false, error: 'Server not in registry' };
  }
  if (!config.url) {
    return { success: false, error: 'Not an HTTP server' };
  }

  const result = await authenticate(serverName, config.url);
  return { success: result.success, error: result.error };
}
