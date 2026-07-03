/**
 * Persistent catalog of tool schemas discovered from downstream servers.
 * Written on first connection, read for discovery and pre-connect tool listing.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { logger } from './logger.js';

export interface ToolSchema {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

interface CatalogEntry {
  tools: ToolSchema[];
  discoveredAt: number;
}

type Catalog = Record<string, CatalogEntry>;

const CATALOG_PATH = resolve(homedir(), '.mux', 'tool-catalog.json');
const CATALOG_TTL_MS = 3_600_000; // 1 hour

function ensureDir(): void {
  const dir = dirname(CATALOG_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readCatalog(): Catalog {
  try {
    return JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function writeCatalog(catalog: Catalog): void {
  ensureDir();
  writeFileSync(CATALOG_PATH, JSON.stringify(catalog), 'utf-8');
}

export function isEntryExpired(entry: CatalogEntry): boolean {
  return Date.now() - entry.discoveredAt > CATALOG_TTL_MS;
}

export function getToolsForServer(serverName: string): ToolSchema[] | undefined {
  const catalog = readCatalog();
  const entry = catalog[serverName];
  if (!entry) return undefined;
  if (isEntryExpired(entry)) return undefined;
  return entry.tools;
}

export function storeToolsForServer(serverName: string, tools: ToolSchema[]): void {
  const catalog = readCatalog();
  catalog[serverName] = { tools, discoveredAt: Date.now() };
  writeCatalog(catalog);
  logger.debug(`Stored ${tools.length} tools for "${serverName}" in catalog`);
}

export function getCatalogStats(): { servers: number; totalTools: number; path: string } {
  const catalog = readCatalog();
  const servers = Object.keys(catalog).length;
  const totalTools = Object.values(catalog).reduce((sum, entry) => sum + entry.tools.length, 0);
  return { servers, totalTools, path: CATALOG_PATH };
}

export function invalidateServer(serverName: string): void {
  const catalog = readCatalog();
  delete catalog[serverName];
  writeCatalog(catalog);
}

/**
 * Returns all non-expired entries. Used by discovery module for searching.
 */
export function getAllEntries(): Array<{ serverName: string; tools: ToolSchema[] }> {
  const catalog = readCatalog();
  const entries: Array<{ serverName: string; tools: ToolSchema[] }> = [];

  for (const [serverName, entry] of Object.entries(catalog)) {
    if (!isEntryExpired(entry)) {
      entries.push({ serverName, tools: entry.tools });
    }
  }

  return entries;
}
