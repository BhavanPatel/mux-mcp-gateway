/**
 * Single source of truth for the Mux version.
 *
 * The version lives in package.json. Every other surface — the CLI `--version`,
 * the TUI header, and the MCP client/server identity handshakes — imports VERSION
 * from here rather than hardcoding a string. This prevents the "three different
 * versions in one product" drift (WS-B2).
 *
 * Resolution walks up from this module to the nearest package.json, so it works
 * both when running from the bundled `dist/` output and from source under tooling.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

function resolveVersion(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  // Walk up until we find the mux package.json, or hit the filesystem root.
  for (let i = 0; i < 10; i++) {
    try {
      const raw = readFileSync(join(dir, 'package.json'), 'utf8');
      const parsed = JSON.parse(raw) as { name?: string; version?: string };
      // Guard against picking up a nested dependency's package.json.
      if (parsed.version && parsed.name === 'mux-mcp-gateway') {
        return parsed.version;
      }
    } catch {
      // no package.json here (or unreadable) — keep walking up
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return '0.0.0-unknown';
}

export const VERSION: string = resolveVersion();
