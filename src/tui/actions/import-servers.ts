/**
 * Import servers from an existing mcp.json file into the Mux registry.
 * Used by the Onboarding "Quick Setup" flow.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const REGISTRY_PATH = resolve(homedir(), '.mux', 'servers.json');
const MUX_DIR = resolve(homedir(), '.mux');

interface McpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  transport?: string;
  headers?: Record<string, string>;
  [key: string]: unknown;
}

interface McpJson {
  mcpServers?: Record<string, McpServerConfig>;
}

export interface ImportResult {
  imported: string[];
  skipped: string[];
  error?: string;
}

/**
 * Common mcp.json paths to search for.
 */
export function getDefaultMcpJsonPaths(): string[] {
  const home = homedir();
  return [
    resolve(home, '.kiro', 'settings', 'mcp.json'),
    resolve(home, '.cursor', 'mcp.json'),
    resolve(home, '.vscode', 'mcp.json'),
    resolve(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
  ];
}

/**
 * Find the first existing mcp.json from common locations.
 */
export function findMcpJson(): string | null {
  for (const p of getDefaultMcpJsonPaths()) {
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Import servers from a given mcp.json path into the Mux registry.
 */
export function importFromMcpJson(mcpJsonPath: string): ImportResult {
  if (!existsSync(mcpJsonPath)) {
    return { imported: [], skipped: [], error: `File not found: ${mcpJsonPath}` };
  }

  let mcpData: McpJson;
  try {
    mcpData = JSON.parse(readFileSync(mcpJsonPath, 'utf-8'));
  } catch {
    return { imported: [], skipped: [], error: 'Invalid JSON' };
  }

  const servers = mcpData.mcpServers;
  if (!servers || Object.keys(servers).length === 0) {
    return { imported: [], skipped: [], error: 'No mcpServers found in file' };
  }

  // Load existing registry (or create)
  if (!existsSync(MUX_DIR)) mkdirSync(MUX_DIR, { recursive: true });

  let registry: { servers: Record<string, unknown> } = { servers: {} };
  if (existsSync(REGISTRY_PATH)) {
    try {
      registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
    } catch {
      registry = { servers: {} };
    }
  }

  const imported: string[] = [];
  const skipped: string[] = [];

  for (const [name, config] of Object.entries(servers)) {
    if (registry.servers[name]) {
      skipped.push(name);
      continue;
    }

    // Determine transport
    const isHttp = !!config.url || config.transport === 'http';
    const serverEntry = isHttp
      ? { transport: 'http', url: config.url, headers: config.headers || {}, keywords: [] }
      : { transport: 'stdio', command: config.command, args: config.args || [], env: config.env || {}, keywords: [] };

    registry.servers[name] = serverEntry;
    imported.push(name);
  }

  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');

  return { imported, skipped };
}

/**
 * Add a single server to the registry.
 */
export function addServerToRegistry(
  name: string,
  config: { transport: 'http' | 'stdio'; url?: string; command?: string; args?: string[] },
): void {
  if (!existsSync(MUX_DIR)) mkdirSync(MUX_DIR, { recursive: true });

  let registry: { servers: Record<string, unknown> } = { servers: {} };
  if (existsSync(REGISTRY_PATH)) {
    try {
      registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
    } catch {
      registry = { servers: {} };
    }
  }

  const entry =
    config.transport === 'http'
      ? { transport: 'http', url: config.url, headers: {}, keywords: [] }
      : { transport: 'stdio', command: config.command, args: config.args || [], env: {}, keywords: [] };

  registry.servers[name] = entry;
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');
}
