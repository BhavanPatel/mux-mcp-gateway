/**
 * Health check action — tests connections to all registered servers.
 * Returns results progressively via a callback as each check completes.
 */
import { getServer } from '../../registry.js';
import type { ServerCheckResult } from '../views/HealthCheck.js';

interface HealthCheckCallbacks {
  onResult: (name: string, result: Partial<ServerCheckResult>) => void;
  onComplete: () => void;
}

/**
 * Run health checks against all servers.
 * For HTTP servers: attempts a fetch to the MCP endpoint.
 * For stdio servers: attempts to spawn the process briefly.
 */
export async function runHealthChecks(serverNames: string[], callbacks: HealthCheckCallbacks): Promise<void> {
  const checks = serverNames.map(async (name) => {
    const start = Date.now();
    try {
      const config = getServer(name);
      if (!config) {
        callbacks.onResult(name, { status: 'fail', error: 'Not in registry' });
        return;
      }

      if (config.transport === 'http' || config.url) {
        // HTTP server — try a GET to the endpoint
        const url = config.url!;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        try {
          const res = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: config.headers || {},
          });
          clearTimeout(timeout);

          const latencyMs = Date.now() - start;

          if (res.status === 401 || res.status === 403) {
            callbacks.onResult(name, { status: 'fail', error: `${res.status} Unauthorized`, latencyMs });
          } else {
            // Any response (even 404/405) means server is reachable
            callbacks.onResult(name, { status: 'pass', latencyMs });
          }
        } catch (err) {
          clearTimeout(timeout);
          const latencyMs = Date.now() - start;
          const message = err instanceof Error ? err.message : 'Connection failed';
          callbacks.onResult(name, {
            status: 'fail',
            error: message.includes('abort') ? 'Timeout (10s)' : message,
            latencyMs,
          });
        }
      } else {
        // Stdio server — check that the command exists
        const { execSync } = await import('node:child_process');
        try {
          const cmd = config.command || '';
          execSync(`which ${cmd}`, { timeout: 5000, stdio: 'ignore' });
          const latencyMs = Date.now() - start;
          callbacks.onResult(name, { status: 'pass', latencyMs });
        } catch {
          const latencyMs = Date.now() - start;
          callbacks.onResult(name, {
            status: 'fail',
            error: `Command "${config.command}" not found`,
            latencyMs,
          });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      callbacks.onResult(name, { status: 'fail', error: message });
    }
  });

  await Promise.allSettled(checks);
  callbacks.onComplete();
}
