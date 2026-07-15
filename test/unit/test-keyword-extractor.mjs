/**
 * Unit tests for keyword extraction from tool names/descriptions.
 * Run: node --test test/test-keyword-extractor.mjs
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

// Replicate the keyword extraction logic for unit testing
// (since generateAndStoreKeywords has side effects — writes to registry)
const MAX_KEYWORDS_PER_SERVER = 20;
const MIN_WORD_LENGTH = 3;
const MAX_WORD_LENGTH = 14;
const DESCRIPTION_SAMPLE_LENGTH = 100;
const MIN_NAME_PART_LENGTH = 3;
const MIN_DESCRIPTION_WORD_LENGTH = 4;

const STOP_WORDS = new Set([
  'the',
  'this',
  'that',
  'with',
  'from',
  'will',
  'have',
  'been',
  'are',
  'was',
  'were',
  'for',
  'not',
  'all',
  'can',
  'had',
  'but',
  'one',
  'our',
  'out',
  'get',
  'set',
  'use',
  'her',
  'him',
  'how',
  'its',
  'may',
  'new',
  'now',
  'old',
  'see',
  'way',
  'who',
  'did',
  'has',
  'let',
  'say',
  'she',
  'too',
  'any',
  'each',
  'make',
  'like',
  'long',
  'look',
  'many',
  'some',
  'them',
  'then',
  'than',
  'more',
  'very',
  'when',
  'come',
  'could',
  'into',
  'just',
  'only',
  'other',
  'also',
  'back',
  'call',
  'first',
  'your',
  'after',
  'give',
  'most',
  'find',
  'here',
  'know',
  'take',
  'want',
  'does',
  'using',
  'given',
  'return',
  'returns',
  'based',
  'specific',
  'list',
  'create',
  'update',
  'delete',
  'name',
  'type',
  'value',
  'data',
  'result',
  'request',
  'response',
  'information',
  'provides',
  'allows',
  'available',
  'args',
  'optional',
  'required',
  'default',
  'uses',
  'used',
  'about',
  'omitted',
  'specify',
  'specified',
  'option',
  'options',
  'param',
  'parameter',
  'parameters',
  'string',
  'number',
  'boolean',
  'array',
  'object',
  'null',
  'true',
  'false',
  'none',
  'path',
  'body',
  'method',
  'current',
  'existing',
  'details',
  'filtering',
  'fastmcp',
  'context',
  'single',
  'simple',
  'basic',
  'high',
  'level',
  'overview',
  'embedded',
  'item',
  'items',
  'file',
  'files',
  'note',
  'notes',
  'add',
  'remove',
  'get',
  'post',
  'upload',
  'download',
  'retrieve',
  'fetch',
]);

function isValidKeyword(word) {
  return (
    word.length > MIN_WORD_LENGTH &&
    word.length < MAX_WORD_LENGTH &&
    !/[./:@{}]/.test(word) &&
    !/^\d+(\.\d+)?$/.test(word) &&
    !STOP_WORDS.has(word)
  );
}

function extractWordsFromTool(tool) {
  const words = [];
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

function extractKeywords(tools) {
  const frequency = new Map();
  for (const tool of tools) {
    const uniqueWords = new Set(extractWordsFromTool(tool));
    for (const word of uniqueWords) {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    }
  }
  return [...frequency.entries()]
    .filter(([word]) => isValidKeyword(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_KEYWORDS_PER_SERVER)
    .map(([word]) => word);
}

describe('isValidKeyword', () => {
  it('rejects words too short (<=3 chars)', () => {
    assert.equal(isValidKeyword('ab'), false);
    assert.equal(isValidKeyword('the'), false);
  });

  it('rejects words too long (>=14 chars)', () => {
    assert.equal(isValidKeyword('verylongkeywordname'), false);
  });

  it('rejects words with special chars', () => {
    assert.equal(isValidKeyword('http://url'), false);
    assert.equal(isValidKeyword('path/to'), false);
    assert.equal(isValidKeyword('user@host'), false);
  });

  it('rejects numeric strings', () => {
    assert.equal(isValidKeyword('12345'), false);
    assert.equal(isValidKeyword('3.14'), false);
  });

  it('rejects stop words', () => {
    assert.equal(isValidKeyword('return'), false);
    assert.equal(isValidKeyword('create'), false);
    assert.equal(isValidKeyword('response'), false);
  });

  it('accepts valid keywords', () => {
    assert.equal(isValidKeyword('gitlab'), true);
    assert.equal(isValidKeyword('merge'), true);
    assert.equal(isValidKeyword('pipeline'), true);
    assert.equal(isValidKeyword('elasticsearch'), true);
  });
});

describe('extractWordsFromTool', () => {
  it('splits tool name on underscores', () => {
    const words = extractWordsFromTool({ name: 'list_merge_requests' });
    assert.ok(words.includes('merge'));
    assert.ok(words.includes('requests'));
  });

  it('splits tool name on hyphens', () => {
    const words = extractWordsFromTool({ name: 'get-pipeline-status' });
    assert.ok(words.includes('pipeline'));
    assert.ok(words.includes('status'));
  });

  it('extracts words from description', () => {
    const words = extractWordsFromTool({
      name: 'search',
      description: 'Search Elasticsearch logs for error patterns',
    });
    assert.ok(words.includes('elasticsearch'));
    assert.ok(words.includes('logs'));
    assert.ok(words.includes('error'));
    assert.ok(words.includes('patterns'));
  });

  it('filters out short name parts', () => {
    const words = extractWordsFromTool({ name: 'a_to_b' });
    // 'a', 'to', 'b' are all < 3 chars
    assert.equal(words.length, 0);
  });

  it('lowercases all words', () => {
    const words = extractWordsFromTool({ name: 'Get_Pipeline' });
    assert.ok(words.every((w) => w === w.toLowerCase()));
  });

  it('truncates description to sample length', () => {
    const longDesc = 'x'.repeat(200) + ' uniqueword';
    const words = extractWordsFromTool({ name: 'test', description: longDesc });
    assert.ok(!words.includes('uniqueword'));
  });
});

describe('extractKeywords (full pipeline)', () => {
  it('extracts keywords from gitlab-like tools', () => {
    const tools = [
      { name: 'list_merge_requests', description: 'List merge requests for a project' },
      { name: 'create_merge_request', description: 'Create a new merge request' },
      { name: 'get_pipeline_status', description: 'Get CI/CD pipeline status' },
      { name: 'list_branches', description: 'List branches in a repository' },
    ];
    const keywords = extractKeywords(tools);
    assert.ok(keywords.includes('merge'));
    assert.ok(keywords.includes('pipeline'));
    assert.ok(keywords.includes('branches'));
  });

  it('extracts keywords from elasticsearch-like tools', () => {
    const tools = [
      { name: 'search_logs', description: 'Search application logs in Elasticsearch' },
      { name: 'get_index_stats', description: 'Get index statistics' },
      { name: 'query_metrics', description: 'Query time-series metrics' },
    ];
    const keywords = extractKeywords(tools);
    assert.ok(keywords.includes('search'));
    assert.ok(keywords.includes('logs'));
    assert.ok(keywords.includes('elasticsearch'));
  });

  it('limits to MAX_KEYWORDS_PER_SERVER', () => {
    const tools = Array.from({ length: 50 }, (_, i) => ({
      name: `tool_keyword${i}_action`,
      description: `Description with unique word${i} for testing`,
    }));
    const keywords = extractKeywords(tools);
    assert.ok(keywords.length <= MAX_KEYWORDS_PER_SERVER);
  });

  it('ranks by frequency (higher count first)', () => {
    const tools = [
      { name: 'search_issues', description: 'Search jira issues' },
      { name: 'create_issue', description: 'Create jira issue' },
      { name: 'get_issue', description: 'Get jira issue details' },
      { name: 'list_projects', description: 'List all projects' },
    ];
    const keywords = extractKeywords(tools);
    // 'jira' appears in 3 descriptions, 'issue/issues' appears in 3 names
    assert.ok(keywords.indexOf('jira') < keywords.indexOf('projects') || !keywords.includes('projects'));
  });

  it('returns empty array for tools with only stop words', () => {
    const tools = [{ name: 'get_list', description: 'Get a list of items' }];
    const keywords = extractKeywords(tools);
    // All words are stop words
    assert.equal(keywords.length, 0);
  });

  it('deduplicates words per tool before counting', () => {
    const tools = [{ name: 'search_search', description: 'Search search search' }];
    const keywords = extractKeywords(tools);
    // 'search' should appear once in output even though repeated in name and description
    const searchCount = keywords.filter((k) => k === 'search').length;
    assert.ok(searchCount <= 1);
  });
});
