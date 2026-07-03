import { readFileSync, watchFile } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { logger } from './logger.js';

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
  auth?: { type: 'oauth'; tokenEndpoint: string; clientId: string; scopes?: string[] };
  keywords?: string[];
  idleTimeoutMs?: number;
}

export interface Registry {
  servers: Record<string, ServerConfig>;
}

const DEFAULT_REGISTRY_PATH = resolve(homedir(), '.mux', 'servers.json');

function interpolateEnv(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, key) => process.env[key] || '');
}

function interpolateConfig(config: ServerConfig): ServerConfig {
  const result = { ...config };
  if (result.command) result.command = interpolateEnv(result.command);
  if (result.args) result.args = result.args.map(a => interpolateEnv(a));
  if (result.env) {
    result.env = Object.fromEntries(
      Object.entries(result.env).map(([k, v]) => [k, interpolateEnv(v)])
    );
  }
  if (result.headers) {
    result.headers = Object.fromEntries(
      Object.entries(result.headers).map(([k, v]) => [k, interpolateEnv(v)])
    );
  }
  if (result.url) result.url = interpolateEnv(result.url);
  return result;
}

function loadFromDisk(path: string): Registry {
  const raw = readFileSync(path, 'utf-8');
  const parsed = JSON.parse(raw) as Registry;
  const servers: Record<string, ServerConfig> = {};
  for (const [name, config] of Object.entries(parsed.servers)) {
    servers[name] = interpolateConfig(config);
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
  const needleParts = normalizedNeedle.split(/[\s_\-./]+/).filter(part => part.length >= MIN_WORD_PART_LENGTH);
  const keywordParts = normalizedKeyword.split(/[\s_\-./]+/).filter(part => part.length >= MIN_WORD_PART_LENGTH);
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
  if (normalizedNeedle.length >= MIN_LEVENSHTEIN_LENGTH
    && normalizedKeyword.length >= MIN_LEVENSHTEIN_LENGTH
    && lengthDifference <= MAX_LEVENSHTEIN_LENGTH_DIFF) {
    const distance = levenshteinDistance(normalizedNeedle, normalizedKeyword);
    const longerLength = Math.max(normalizedNeedle.length, normalizedKeyword.length);
    if (distance <= MAX_SINGLE_EDIT_DISTANCE) return SCORE_TYPO_SINGLE_EDIT;
    if (distance <= MAX_DOUBLE_EDIT_DISTANCE && longerLength >= MIN_LENGTH_FOR_DOUBLE_EDIT) return SCORE_TYPO_DOUBLE_EDIT;
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
        const existing = candidates.find(candidate => candidate.name === serverName);
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
  try {
    registry = loadFromDisk(registryPath);
    logger.info(`Registry loaded: ${Object.keys(registry.servers).length} servers`, { path: registryPath });
  } catch (err: any) {
    logger.error(`Failed to load registry: ${err.message}`, { path: registryPath });
    registry = { servers: {} };
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


import { writeFileSync } from 'node:fs';

export function updateServerKeywords(name: string, keywords: string[]): void {
  try {
    const raw = readFileSync(registryPath, 'utf-8');
    const parsed = JSON.parse(raw) as Registry;
    if (parsed.servers[name]) {
      // Only update if current keywords are empty or fewer
      const existing = parsed.servers[name].keywords || [];
      if (existing.length < keywords.length) {
        parsed.servers[name].keywords = keywords;
        writeFileSync(registryPath, JSON.stringify(parsed, null, 2), 'utf-8');
        // Update in-memory registry too
        if (registry.servers[name]) {
          registry.servers[name].keywords = keywords;
        }
      }
    }
  } catch {
    // Non-critical — don't fail on keyword update
  }
}
