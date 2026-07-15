/**
 * Tool discovery — search and resolution across cached tool schemas.
 * Finds tools by name/description and resolves which server owns a given tool.
 */
import { getAllEntries, ToolSchema } from './tool-catalog.js';

export interface ToolSearchResult {
  server: string;
  tool: string;
  description: string | undefined;
}

// --- Search scoring constants ---
const SCORE_EXACT_NAME = 100;
const SCORE_NAME_CONTAINS_QUERY = 80;
const SCORE_QUERY_CONTAINS_NAME = 60;
const SCORE_WORD_PART_BASE = 40;
const SCORE_WORD_PART_INCREMENT = 5;
const SCORE_DESCRIPTION_MATCH = 30;
const EXACT_PART_WEIGHT = 2;
const PREFIX_PART_WEIGHT = 1;
const MIN_QUERY_PART_LENGTH = 2;

interface ScoredResult extends ToolSearchResult {
  score: number;
}

/**
 * Search across all cached tools by name and description.
 * Returns matches sorted by relevance (exact name match first, then substring).
 */
export function findToolsAcrossServers(query: string): ToolSearchResult[] {
  const normalizedQuery = query.toLowerCase();
  const queryParts = normalizedQuery.split(/[\s_\-./]+/).filter((part) => part.length >= MIN_QUERY_PART_LENGTH);

  const results: ScoredResult[] = [];

  for (const { serverName, tools } of getAllEntries()) {
    for (const tool of tools) {
      const score = scoreToolMatch(tool, normalizedQuery, queryParts);
      if (score > 0) {
        results.push({ server: serverName, tool: tool.name, description: tool.description, score });
      }
    }
  }

  results.sort((first, second) => second.score - first.score);
  return results.map(({ score: _score, ...rest }) => rest);
}

/**
 * Resolve which server owns a specific tool name.
 * Returns the server name if found in catalog, undefined otherwise.
 */
export function resolveServerByToolName(toolName: string): string | undefined {
  const normalizedToolName = toolName.toLowerCase();

  for (const { serverName, tools } of getAllEntries()) {
    const match = tools.find((tool) => tool.name.toLowerCase() === normalizedToolName);
    if (match) return serverName;
  }

  return undefined;
}

function scoreToolMatch(tool: ToolSchema, normalizedQuery: string, queryParts: string[]): number {
  const normalizedToolName = tool.name.toLowerCase();
  const normalizedDescription = (tool.description || '').toLowerCase();

  if (normalizedToolName === normalizedQuery) {
    return SCORE_EXACT_NAME;
  }

  if (normalizedToolName.includes(normalizedQuery)) {
    return SCORE_NAME_CONTAINS_QUERY;
  }

  if (normalizedQuery.includes(normalizedToolName)) {
    return SCORE_QUERY_CONTAINS_NAME;
  }

  const wordPartScore = scoreWordParts(queryParts, normalizedToolName);
  if (wordPartScore > 0) {
    return wordPartScore;
  }

  if (normalizedDescription.includes(normalizedQuery)) {
    return SCORE_DESCRIPTION_MATCH;
  }

  return 0;
}

function scoreWordParts(queryParts: string[], normalizedToolName: string): number {
  const toolParts = normalizedToolName.split(/[_\-./]+/);
  let partMatches = 0;

  for (const queryPart of queryParts) {
    for (const toolPart of toolParts) {
      if (toolPart === queryPart) {
        partMatches += EXACT_PART_WEIGHT;
      } else if (toolPart.startsWith(queryPart) || queryPart.startsWith(toolPart)) {
        partMatches += PREFIX_PART_WEIGHT;
      }
    }
  }

  return partMatches > 0 ? SCORE_WORD_PART_BASE + partMatches * SCORE_WORD_PART_INCREMENT : 0;
}
