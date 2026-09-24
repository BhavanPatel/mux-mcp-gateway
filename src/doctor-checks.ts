/**
 * Diagnostic checks for `mux doctor` (WS-C2).
 *
 * Kept separate from cli.ts so each check is independently unit-testable from
 * dist/. Nothing here writes to stdout. Every reported number is measured —
 * no fixed "callback port" is probed because the OAuth flow binds an EPHEMERAL
 * loopback port (mcp-oauth-provider.ts: `server.listen(0, '127.0.0.1')`), so
 * the meaningful, honest check is "can we bind a loopback port at all".
 */
import { createServer } from 'node:net';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir, platform } from 'node:os';

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
}

/**
 * Confirm the OAuth callback precondition: that Mux can bind an ephemeral
 * loopback port. This is what the auth flow actually does; a fixed port does
 * not exist. Returns the port the OS assigned (proof the bind worked).
 */
export function checkLoopbackBind(): Promise<DoctorCheck> {
  return new Promise((resolvePromise) => {
    const server = createServer();
    server.once('error', (err) => {
      resolvePromise({
        name: 'oauth-callback-bind',
        ok: false,
        detail: `cannot bind loopback port for OAuth callback: ${(err as Error).message}`,
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = addr && typeof addr === 'object' ? addr.port : 0;
      server.close(() => {
        resolvePromise({
          name: 'oauth-callback-bind',
          ok: true,
          detail: `can bind an ephemeral loopback port (got ${port})`,
        });
      });
    });
  });
}

/** Known MCP client config locations, per platform. */
interface ClientConfigTarget {
  client: string;
  path: string;
}

export function knownClientConfigs(home = homedir(), plat = platform()): ClientConfigTarget[] {
  const targets: ClientConfigTarget[] = [];
  const mac = plat === 'darwin';
  const appSupport = resolve(home, 'Library', 'Application Support');

  // Claude Desktop
  targets.push({
    client: 'Claude Desktop',
    path: mac
      ? resolve(appSupport, 'Claude', 'claude_desktop_config.json')
      : resolve(home, '.config', 'Claude', 'claude_desktop_config.json'),
  });
  // Cursor
  targets.push({ client: 'Cursor', path: resolve(home, '.cursor', 'mcp.json') });
  // Windsurf
  targets.push({ client: 'Windsurf', path: resolve(home, '.codeium', 'windsurf', 'mcp_config.json') });
  // VS Code (user settings; MCP servers live under a "mcp"/"servers" key)
  targets.push({
    client: 'VS Code',
    path: mac
      ? resolve(appSupport, 'Code', 'User', 'settings.json')
      : resolve(home, '.config', 'Code', 'User', 'settings.json'),
  });
  return targets;
}

/**
 * Detect which known MCP clients have a config on disk and whether each one
 * references mux. Reports `--serve` presence separately (bare `mux` also works
 * as the gateway, so its absence is a note, not a failure).
 */
export function detectClientConfigs(
  readFile: (p: string) => string,
  home = homedir(),
  plat = platform(),
): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  for (const { client, path } of knownClientConfigs(home, plat)) {
    if (!existsSync(path)) continue; // only report clients the user actually has
    let content = '';
    try {
      content = readFile(path);
    } catch (err) {
      checks.push({ name: `client:${client}`, ok: false, detail: `config unreadable: ${(err as Error).message}` });
      continue;
    }
    const mentionsMux = /\bmux\b/.test(content);
    const hasServe = /["']serve["']/.test(content) || /\bmux\s+serve\b/.test(content);
    if (!mentionsMux) {
      checks.push({ name: `client:${client}`, ok: true, detail: `config present, mux not configured` });
    } else {
      checks.push({
        name: `client:${client}`,
        ok: true,
        detail: hasServe ? 'mux configured (with serve)' : 'mux configured (bare mux — serve optional)',
      });
    }
  }
  return checks;
}

/** Size of the log file in bytes (0 if absent), plus a rotated sibling. */
export function logSizeCheck(home = homedir()): DoctorCheck {
  const logPath = resolve(home, '.mux', 'mux.log');
  const rotated = `${logPath}.1`;
  const size = existsSync(logPath) ? statSync(logPath).size : 0;
  const rotatedSize = existsSync(rotated) ? statSync(rotated).size : 0;
  const total = size + rotatedSize;
  const mb = (total / (1024 * 1024)).toFixed(2);
  // Purely informational — a large log is never a failure (rotation caps it).
  return { name: 'log-size', ok: true, detail: `${mb} MB across mux.log + mux.log.1` };
}
