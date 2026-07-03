/**
 * Extracts keywords from tool names and descriptions for auto-tagging servers.
 * Used after first connection to populate keyword metadata in the registry.
 */
import { updateServerKeywords } from './registry.js';
import { logger } from './logger.js';

const MAX_KEYWORDS_PER_SERVER = 20;
const MIN_WORD_LENGTH = 3;
const MAX_WORD_LENGTH = 14;
const DESCRIPTION_SAMPLE_LENGTH = 100;
const MIN_NAME_PART_LENGTH = 3;
const MIN_DESCRIPTION_WORD_LENGTH = 4;

const STOP_WORDS = new Set([
  'the', 'this', 'that', 'with', 'from', 'will', 'have', 'been',
  'are', 'was', 'were', 'for', 'not', 'all', 'can', 'had', 'but',
  'one', 'our', 'out', 'get', 'set', 'use', 'her', 'him', 'how',
  'its', 'may', 'new', 'now', 'old', 'see', 'way', 'who', 'did',
  'has', 'let', 'say', 'she', 'too', 'any', 'each', 'make', 'like',
  'long', 'look', 'many', 'some', 'them', 'then', 'than', 'more',
  'very', 'when', 'come', 'could', 'into', 'just', 'only', 'other',
  'also', 'back', 'call', 'first', 'your', 'after', 'give', 'most',
  'find', 'here', 'know', 'take', 'want', 'does', 'using', 'given',
  'return', 'returns', 'based', 'specific', 'list', 'create', 'update',
  'delete', 'name', 'type', 'value', 'data', 'result', 'request',
  'response', 'information', 'provides', 'allows', 'available',
  'args', 'optional', 'required', 'default', 'uses', 'used', 'about',
  'omitted', 'specify', 'specified', 'option', 'options', 'param',
  'parameter', 'parameters', 'string', 'number', 'boolean', 'array',
  'object', 'null', 'true', 'false', 'none', 'path', 'body', 'method',
  'current', 'existing', 'details', 'filtering', 'fastmcp', 'context',
  'single', 'simple', 'basic', 'high', 'level', 'overview', 'embedded',
  'item', 'items', 'file', 'files', 'note', 'notes', 'add', 'remove',
  'get', 'post', 'upload', 'download', 'retrieve', 'fetch',
]);

interface ToolInfo {
  name: string;
  description?: string;
}

function isValidKeyword(word: string): boolean {
  return word.length > MIN_WORD_LENGTH
    && word.length < MAX_WORD_LENGTH
    && !/[./:@{}]/.test(word)
    && !/^\d+(\.\d+)?$/.test(word)
    && !STOP_WORDS.has(word);
}

function extractWordsFromTool(tool: ToolInfo): string[] {
  const words: string[] = [];

  for (const part of tool.name.split(/[_\-]/)) {
    if (part.length >= MIN_NAME_PART_LENGTH && !STOP_WORDS.has(part.toLowerCase())) {
      words.push(part.toLowerCase());
    }
  }

  if (tool.description) {
    const descriptionSample = tool.description.slice(0, DESCRIPTION_SAMPLE_LENGTH).toLowerCase();
    for (const word of descriptionSample.split(/\W+/)) {
      if (word.length >= MIN_DESCRIPTION_WORD_LENGTH && !STOP_WORDS.has(word)) {
        words.push(word);
      }
    }
  }

  return words;
}

function buildFrequencyMap(tools: ToolInfo[]): Map<string, number> {
  const frequency = new Map<string, number>();

  for (const tool of tools) {
    const uniqueWords = new Set(extractWordsFromTool(tool));
    for (const word of uniqueWords) {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    }
  }

  return frequency;
}

/**
 * Extract keywords from tool names and descriptions, then update the registry.
 * Only updates if the extracted set is larger than the existing keywords.
 */
export function generateAndStoreKeywords(serverName: string, tools: ToolInfo[]): void {
  const frequency = buildFrequencyMap(tools);

  const keywords = [...frequency.entries()]
    .filter(([word]) => isValidKeyword(word))
    .sort((first, second) => second[1] - first[1])
    .slice(0, MAX_KEYWORDS_PER_SERVER)
    .map(([word]) => word);

  if (keywords.length > 0) {
    updateServerKeywords(serverName, keywords);
    logger.debug(`Auto-keywords for "${serverName}": ${keywords.join(', ')}`);
  }
}
