/**
 * Import servers from an existing mcp.json file into the Mux registry.
 * Used by the Onboarding "Quick Setup" flow.
 *
 * All registry writes go through the guarded writer (config-writer.ts): a
 * timestamped backup is taken before any mutation, writes are atomic + 0600,
 * and a corrupt existing registry is NEVER silently reset to `{}` and
 * overwritten — it fails closed with the backup preserved.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { mutateRegistry } from '../../config-writer.js';
import { ConfigError, RegistryInput, ServerConfigInput } from '../../config-schema.js';
import { errorMessage } from '../../errors.js';

const REGISTRY_PATH = resolve(homedir(), '.mux', 'servers.json');

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

function toServerEntry(config: McpServerConfig): ServerConfigInput {
  const isHttp = !!config.url || config.transport === 'http';
  return isHttp
    ? { transport: 'http', url: config.url, headers: config.headers || {}, keywords: [] }
    : { transport: 'stdio', command: config.command, args: config.args || [], env: config.env || {}, keywords: [] };
}

/**
 * Import servers from a given mcp.json path into the Mux registry.
 */
export async function importFromMcpJson(mcpJsonPath: string): Promise<ImportResult> {
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

  const imported: string[] = [];
  const skipped: string[] = [];

  try {
    const outcome = await mutateRegistry(REGISTRY_PATH, (current: RegistryInput) => {
      for (const [name, config] of Object.entries(servers)) {
        if (current.servers[name]) {
          skipped.push(name);
          continue;
        }
        current.servers[name] = toServerEntry(config);
        imported.push(name);
      }
      return current;
    });
    if (!outcome.ok) {
      return { imported: [], skipped: [], error: `Registry write failed: ${outcome.message}` };
    }
  } catch (err: unknown) {
    // Fail closed on a corrupt existing registry — the writer preserved a backup.
    const msg = err instanceof ConfigError ? err.message : errorMessage(err) || 'unknown error';
    return { imported: [], skipped: [], error: `Existing registry is invalid, refusing to overwrite: ${msg}` };
  }

  return { imported, skipped };
}

/**
 * Add a single server to the registry.
 *
 * Ports the collection behaviour the old `add.sh` had (env vars, headers,
 * discovery keywords) into the API surface: these are optional and default to
 * empty when omitted. Keyword auto-generation is NOT done here — it requires
 * tool metadata and runs post-discovery on first connection
 * (see keyword-extractor.generateAndStoreKeywords).
 *
 * Fails closed on a name collision rather than silently overwriting an existing
 * server (the bulk import path skips collisions; this single-add path used to
 * clobber). Callers that intend to replace should remove first.
 */
export async function addServerToRegistry(
  name: string,
  config: {
    transport: 'http' | 'stdio';
    url?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    headers?: Record<string, string>;
    keywords?: string[];
  },
): Promise<void> {
  const entry: ServerConfigInput =
    config.transport === 'http'
      ? { transport: 'http', url: config.url, headers: config.headers || {}, keywords: config.keywords || [] }
      : {
          transport: 'stdio',
          command: config.command,
          args: config.args || [],
          env: config.env || {},
          keywords: config.keywords || [],
        };

  const outcome = await mutateRegistry(REGISTRY_PATH, (current: RegistryInput) => {
    if (current.servers[name]) {
      throw new ConfigError(`A server named "${name}" already exists. Remove it first or choose another name.`);
    }
    current.servers[name] = entry;
    return current;
  });
  if (!outcome.ok) {
    throw new Error(`Failed to add server "${name}": ${outcome.message}`);
  }
}
