import { readFileSync, existsSync, watchFile } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { logger } from './logger.js';
import { parseRegistry, ConfigError } from './config-schema.js';
import { errorMessage } from './errors.js';
import { mutateRegistry, NOT_FOUND } from './config-writer.js';

export interface ServerConfig {
  transport: 'stdio' | 'http';
  // stdio
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // http
  url?: string;
  headers?: Record<string, string>;
  // common
  auth?: { type: 'oauth'; clientId?: string; scopes?: string[] };
  keywords?: string[];
  idleTimeoutMs?: number;
}

export interface Registry {
  servers: Record<string, ServerConfig>;
}

const DEFAULT_REGISTRY_PATH = resolve(homedir(), '.mux', 'servers.json');

/** Names of env vars referenced by the config that had no value. Reported, not silently empty. */
const unresolvedEnvVars = new Set<string>();

function interpolateEnv(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, key) => {
    const resolved = process.env[key];
    if (resolved === undefined || resolved === '') {
      unresolvedEnvVars.add(key);
      return '';
    }
    return resolved;
  });
}

function interpolateConfig(config: ServerConfig): ServerConfig {
  const result = { ...config };
  if (result.command) result.command = interpolateEnv(result.command);
  if (result.args) result.args = result.args.map((a) => interpolateEnv(a));
  if (result.env) {
    result.env = Object.fromEntries(Object.entries(result.env).map(([k, v]) => [k, interpolateEnv(v)]));
  }
  if (result.headers) {
    result.headers = Object.fromEntries(Object.entries(result.headers).map(([k, v]) => [k, interpolateEnv(v)]));
  }
  if (result.url) result.url = interpolateEnv(result.url);
  return result;
}

function loadFromDisk(path: string): Registry {
  const raw = readFileSync(path, 'utf-8');
  const parsed = parseRegistry(raw); // validates + migrates; throws ConfigError on malformed
  const servers: Record<string, ServerConfig> = {};
  for (const [name, config] of Object.entries(parsed.servers)) {
    servers[name] = interpolateConfig(config as ServerConfig);
  }
  return { servers };
}

let registry: Registry = { servers: {} };
let registryPath = DEFAULT_REGISTRY_PATH;

export function getRegistry(): Registry {
  return registry;
}

export function getServer(name: string): ServerConfig | undefined {
  if (registry.servers[name]) return registry.servers[name];
  // Fallback: resolve by scored keyword match
  const resolved = resolveServerName(name);
  return resolved ? registry.servers[resolved] : undefined;
}

// --- Match scoring constants ---
const SCORE_EXACT = 100;
const SCORE_NEEDLE_IS_PREFIX = 80;
const SCORE_KEYWORD_IS_PREFIX = 75;
const SCORE_NEEDLE_IN_KEYWORD = 60;
const SCORE_KEYWORD_IN_NEEDLE = 55;
const SCORE_TYPO_SINGLE_EDIT = 40;
const SCORE_WORD_BOUNDARY_BASE = 30;
const SCORE_WORD_BOUNDARY_INCREMENT = 10;
const SCORE_TYPO_DOUBLE_EDIT = 25;
const MIN_RESOLUTION_THRESHOLD = 25;

const MIN_PREFIX_LENGTH = 2;
const MIN_SUBSTRING_LENGTH = 3;
const MIN_LEVENSHTEIN_LENGTH = 3;
const MAX_LEVENSHTEIN_LENGTH_DIFF = 2;
const MAX_SINGLE_EDIT_DISTANCE = 1;
const MAX_DOUBLE_EDIT_DISTANCE = 2;
const MIN_LENGTH_FOR_DOUBLE_EDIT = 5;
const MIN_WORD_PART_LENGTH = 2;
const EXACT_WORD_MATCH_WEIGHT = 2;
const PARTIAL_WORD_MATCH_WEIGHT = 1;

/** Score a match between a needle and a keyword (0 = no match, higher = better) */
export function scoreMatch(needle: string, keyword: string): number {
  const normalizedNeedle = needle.toLowerCase();
  const normalizedKeyword = keyword.toLowerCase();

  // Exact match — highest priority
  if (normalizedNeedle === normalizedKeyword) return SCORE_EXACT;

  // Prefix match: needle is prefix of keyword or vice versa
  if (normalizedKeyword.startsWith(normalizedNeedle) && normalizedNeedle.length >= MIN_PREFIX_LENGTH) {
    return SCORE_NEEDLE_IS_PREFIX;
  }
  if (normalizedNeedle.startsWith(normalizedKeyword) && normalizedKeyword.length >= MIN_PREFIX_LENGTH) {
    return SCORE_KEYWORD_IS_PREFIX;
  }

  // Substring: needle found inside keyword or keyword inside needle
  if (normalizedKeyword.includes(normalizedNeedle) && normalizedNeedle.length >= MIN_SUBSTRING_LENGTH) {
    return SCORE_NEEDLE_IN_KEYWORD;
  }
  if (normalizedNeedle.includes(normalizedKeyword) && normalizedKeyword.length >= MIN_SUBSTRING_LENGTH) {
    return SCORE_KEYWORD_IN_NEEDLE;
  }

  // Word boundary match: split by common separators and match parts
  const needleParts = normalizedNeedle.split(/[\s_\-./]+/).filter((part) => part.length >= MIN_WORD_PART_LENGTH);
  const keywordParts = normalizedKeyword.split(/[\s_\-./]+/).filter((part) => part.length >= MIN_WORD_PART_LENGTH);
  let wordMatchScore = 0;
  for (const needlePart of needleParts) {
    for (const keywordPart of keywordParts) {
      if (needlePart === keywordPart) {
        wordMatchScore += EXACT_WORD_MATCH_WEIGHT;
      } else if (keywordPart.startsWith(needlePart) || needlePart.startsWith(keywordPart)) {
        wordMatchScore += PARTIAL_WORD_MATCH_WEIGHT;
      }
    }
  }
  if (wordMatchScore > 0) {
    return SCORE_WORD_BOUNDARY_BASE + wordMatchScore * SCORE_WORD_BOUNDARY_INCREMENT;
  }

  // Levenshtein distance for short strings (typo tolerance)
  const lengthDifference = Math.abs(normalizedNeedle.length - normalizedKeyword.length);
  if (
    normalizedNeedle.length >= MIN_LEVENSHTEIN_LENGTH &&
    normalizedKeyword.length >= MIN_LEVENSHTEIN_LENGTH &&
    lengthDifference <= MAX_LEVENSHTEIN_LENGTH_DIFF
  ) {
    const distance = levenshteinDistance(normalizedNeedle, normalizedKeyword);
    const longerLength = Math.max(normalizedNeedle.length, normalizedKeyword.length);
    if (distance <= MAX_SINGLE_EDIT_DISTANCE) return SCORE_TYPO_SINGLE_EDIT;
    if (distance <= MAX_DOUBLE_EDIT_DISTANCE && longerLength >= MIN_LENGTH_FOR_DOUBLE_EDIT)
      return SCORE_TYPO_DOUBLE_EDIT;
  }

  return 0;
}

/** Calculate Levenshtein (edit) distance between two strings */
function levenshteinDistance(source: string, target: string): number {
  const sourceLen = source.length;
  const targetLen = target.length;
  const matrix: number[][] = Array.from({ length: sourceLen + 1 }, () => Array(targetLen + 1).fill(0));

  for (let row = 0; row <= sourceLen; row++) matrix[row][0] = row;
  for (let col = 0; col <= targetLen; col++) matrix[0][col] = col;

  for (let row = 1; row <= sourceLen; row++) {
    for (let col = 1; col <= targetLen; col++) {
      const isCharMatch = source[row - 1] === target[col - 1];
      matrix[row][col] = isCharMatch
        ? matrix[row - 1][col - 1]
        : 1 + Math.min(matrix[row - 1][col], matrix[row][col - 1], matrix[row - 1][col - 1]);
    }
  }

  return matrix[sourceLen][targetLen];
}

/** Resolve a server name with scored matching. Returns best match above threshold. */
export function resolveServerName(name: string): string | undefined {
  // 1. Exact registry name match
  if (registry.servers[name]) return name;

  // 2. Score all servers by keyword + name match
  const needle = name.toLowerCase();
  const candidates: Array<{ name: string; score: number }> = [];

  for (const [serverName, config] of Object.entries(registry.servers)) {
    // Score against server name itself
    const nameScore = scoreMatch(needle, serverName);
    if (nameScore > 0) candidates.push({ name: serverName, score: nameScore });

    // Score against each keyword
    for (const keyword of config.keywords || []) {
      const keywordScore = scoreMatch(needle, keyword);
      if (keywordScore > 0) {
        const existing = candidates.find((candidate) => candidate.name === serverName);
        if (existing) existing.score = Math.max(existing.score, keywordScore);
        else candidates.push({ name: serverName, score: keywordScore });
      }
    }
  }

  if (candidates.length === 0) return undefined;

  // Return best match above minimum threshold
  candidates.sort((first, second) => second.score - first.score);
  return candidates[0].score >= MIN_RESOLUTION_THRESHOLD ? candidates[0].name : undefined;
}

export function loadRegistry(path?: string): Registry {
  registryPath = path || process.env.MUX_REGISTRY_PATH || DEFAULT_REGISTRY_PATH;
  unresolvedEnvVars.clear();
  try {
    // A genuinely absent file is a legitimate empty registry (fresh install).
    if (!existsSync(registryPath)) {
      registry = { servers: {} };
      logger.info('Registry file not present; starting with an empty registry', { path: registryPath });
      return registry;
    }
    registry = loadFromDisk(registryPath);
    logger.info(`Registry loaded: ${Object.keys(registry.servers).length} servers`, { path: registryPath });
    if (unresolvedEnvVars.size > 0) {
      logger.warn(
        `Unresolved env vars in registry config: ${[...unresolvedEnvVars].join(', ')} (expanded to empty string)`,
      );
    }
  } catch (err: unknown) {
    // Fail CLOSED: a malformed/corrupt config must not masquerade as an empty
    // registry (which would silently report "success with zero servers"). Keep
    // the last-good in-memory registry and rethrow so startup can surface it.
    if (err instanceof ConfigError) {
      logger.error(`Registry config invalid, refusing to load: ${err.message}`, { path: registryPath });
    } else {
      logger.error(`Failed to load registry: ${errorMessage(err)}`, { path: registryPath });
    }
    throw err;
  }
  return registry;
}

export function watchRegistry(onChange?: () => void) {
  watchFile(registryPath, { interval: 2000 }, () => {
    logger.info('Registry file changed, reloading...');
    loadRegistry(registryPath);
    onChange?.();
  });
}

export function updateServerKeywords(name: string, keywords: string[]): void {
  // Only update if current keywords are empty or fewer (preserve richer sets).
  const existing = registry.servers[name]?.keywords || [];
  if (registry.servers[name] && existing.length >= keywords.length) return;

  // In-memory first for responsiveness; persist via the guarded writer.
  if (registry.servers[name]) registry.servers[name].keywords = keywords;
  void mutateRegistry(registryPath, (current) => {
    if (!current.servers[name]) return NOT_FOUND;
    const cur = current.servers[name].keywords || [];
    if (cur.length >= keywords.length) return NOT_FOUND;
    current.servers[name].keywords = keywords;
    return current;
  }).then((r) => {
    if (!r.ok && r.error === 'write-failed') {
      logger.warn(`Failed to persist keywords for "${name}": ${r.message}`);
    }
  });
}

/** Force-set keywords for a server (used by TUI edit view). */
export function setServerKeywords(name: string, keywords: string[]): void {
  if (registry.servers[name]) registry.servers[name].keywords = keywords;
  void mutateRegistry(registryPath, (current) => {
    if (!current.servers[name]) return NOT_FOUND;
    current.servers[name].keywords = keywords;
    return current;
  }).then((r) => {
    if (!r.ok && r.error === 'write-failed') {
      logger.warn(`Failed to persist keywords for "${name}": ${r.message}`);
    }
  });
}

export type RemoveServerResult = 'removed' | 'not-found' | 'write-failed';

/**
 * Remove a server from the registry file. Distinguishes "not found" from
 * "write failed" (both previously returned false).
 */
export async function removeServer(name: string): Promise<RemoveServerResult> {
  const outcome = await mutateRegistry(registryPath, (current) => {
    if (!current.servers[name]) return NOT_FOUND;
    delete current.servers[name];
    return current;
  });
  if (outcome.ok) {
    delete registry.servers[name];
    return 'removed';
  }
  return outcome.error === 'not-found' ? 'not-found' : 'write-failed';
}
