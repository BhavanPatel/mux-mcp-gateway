/**
 * Hook to read registry data for the TUI dashboard.
 * Reads directly from ~/.mux/servers.json (same as core registry module).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

export interface TuiServerInfo {
  name: string;
  transport: 'stdio' | 'http';
  url?: string;
  keywords: string[];
  toolCount?: number;
  status: 'connected' | 'disconnected' | 'connecting' | 'needs-auth';
}

export interface RegistryData {
  servers: TuiServerInfo[];
  totalServers: number;
  connectedCount: number;
  needsAuthCount: number;
}

const REGISTRY_PATH = resolve(homedir(), '.mux', 'servers.json');
const TOKENS_PATH = resolve(homedir(), '.mux', 'tokens.json');
const CATALOG_PATH = resolve(homedir(), '.mux', 'tool-catalog.json');

export function useRegistry(): RegistryData {
  let servers: TuiServerInfo[] = [];

  try {
    if (!existsSync(REGISTRY_PATH)) {
      return { servers: [], totalServers: 0, connectedCount: 0, needsAuthCount: 0 };
    }

    const raw = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
    const tokens = loadTokens();
    const catalog = loadCatalog();

    const rawServers = (raw.servers || {}) as Record<string, { transport?: string; url?: string; keywords?: string[] }>;
    servers = Object.entries(rawServers).map(([name, config]) => {
      const isHttp = config.transport === 'http' || !!config.url;
      const hasToken = !!tokens[name];
      const toolCount = catalog[name]?.length;

      let status: TuiServerInfo['status'] = 'disconnected';
      if (isHttp && !hasToken) {
        status = 'needs-auth';
      } else if (toolCount && toolCount > 0) {
        status = 'connected';
      }

      return {
        name,
        transport: isHttp ? 'http' : 'stdio',
        url: config.url,
        keywords: config.keywords || [],
        toolCount,
        status,
      } as TuiServerInfo;
    });

    // Sort: connected first, then needs-auth, then disconnected
    const order = { connected: 0, 'needs-auth': 1, disconnected: 2, connecting: 3 };
    servers.sort((a, b) => order[a.status] - order[b.status]);
  } catch {
    // Silently return empty on read error
  }

  return {
    servers,
    totalServers: servers.length,
    connectedCount: servers.filter((s) => s.status === 'connected').length,
    needsAuthCount: servers.filter((s) => s.status === 'needs-auth').length,
  };
}

function loadTokens(): Record<string, unknown> {
  try {
    if (existsSync(TOKENS_PATH)) return JSON.parse(readFileSync(TOKENS_PATH, 'utf-8'));
  } catch {
    // ignore read errors
  }
  return {};
}

function loadCatalog(): Record<string, unknown[]> {
  try {
    if (existsSync(CATALOG_PATH)) {
      const raw = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'));
      const result: Record<string, unknown[]> = {};
      for (const entry of raw.entries || []) {
        if (entry.serverName && entry.tools) {
          result[entry.serverName] = entry.tools;
        }
      }
      return result;
    }
  } catch {
    // ignore read errors
  }
  return {};
}
