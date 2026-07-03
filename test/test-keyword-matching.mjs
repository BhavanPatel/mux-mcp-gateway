/**
 * Unit tests for keyword matching and server name resolution.
 * Run: node --test test/test-keyword-matching.mjs
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TEST_DIR = '/tmp/mux-keyword-test';
const REGISTRY_PATH = resolve(TEST_DIR, 'servers.json');

let scoreMatch, resolveServerName, getServer, loadRegistry;

before(async () => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  mkdirSync(TEST_DIR, { recursive: true });

  writeFileSync(REGISTRY_PATH, JSON.stringify({
    servers: {
      'gitlab': {
        transport: 'stdio',
        command: 'echo',
        args: [],
        keywords: ['gitlab', 'merge request', 'MR', 'pipeline', 'branch', 'repository', 'commit']
      },
      'jira-cloud': {
        transport: 'stdio',
        command: 'echo',
        args: [],
        keywords: ['jira', 'issues', 'sprint', 'board', 'backlog', 'ticket', 'story']
      },
      'elasticsearch-prod': {
        transport: 'stdio',
        command: 'echo',
        args: [],
        keywords: ['elasticsearch', 'kibana', 'logs', 'search', 'index', 'query']
      },
      'datadog': {
        transport: 'stdio',
        command: 'echo',
        args: [],
        keywords: ['datadog', 'metrics', 'traces', 'APM', 'monitors', 'dashboards']
      },
      'slack-mcp': {
        transport: 'stdio',
        command: 'echo',
        args: [],
        keywords: ['slack', 'channels', 'messages', 'notifications']
      }
    }
  }, null, 2));

  process.env.MUX_REGISTRY_PATH = REGISTRY_PATH;
  process.env.MUX_LOG_LEVEL = 'error';

  const registry = await import(resolve(ROOT, 'dist/registry.js'));
  scoreMatch = registry.scoreMatch;
  resolveServerName = registry.resolveServerName;
  getServer = registry.getServer;
  loadRegistry = registry.loadRegistry;

  loadRegistry(REGISTRY_PATH);
});

after(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('scoreMatch', () => {
  describe('exact match', () => {
    it('matches identical strings', () => {
      assert.equal(scoreMatch('gitlab', 'gitlab'), 100);
    });

    it('is case insensitive', () => {
      assert.equal(scoreMatch('GitLab', 'gitlab'), 100);
    });

    it('matches another exact keyword', () => {
      assert.equal(scoreMatch('jira', 'jira'), 100);
    });
  });

  describe('prefix match', () => {
    it('needle is prefix of keyword', () => {
      assert.ok(scoreMatch('elastic', 'elasticsearch') > 70);
    });

    it('short prefix still matches', () => {
      assert.ok(scoreMatch('data', 'datadog') > 70);
    });

    it('matches keyword prefix', () => {
      assert.ok(scoreMatch('pipe', 'pipeline') > 70);
    });
  });

  describe('substring match', () => {
    it('needle found inside keyword', () => {
      assert.ok(scoreMatch('search', 'elasticsearch') > 50);
    });

    it('keyword found inside needle', () => {
      assert.ok(scoreMatch('board', 'dashboards') > 50);
    });

    it('near-exact still scores high', () => {
      assert.ok(scoreMatch('logs', 'logs') > 90);
    });
  });

  describe('word boundary match', () => {
    it('matches multi-word keyword exactly', () => {
      assert.ok(scoreMatch('merge request', 'merge request') > 90);
    });

    it('matches underscore-separated against space-separated', () => {
      assert.ok(scoreMatch('merge_request', 'merge request') > 30);
    });
  });

  describe('typo tolerance (Levenshtein)', () => {
    it('handles transposition', () => {
      assert.ok(scoreMatch('gtilab', 'gitlab') > 20);
    });

    it('handles extra character', () => {
      assert.ok(scoreMatch('jiira', 'jira') > 20);
    });

    it('handles missing character in long word', () => {
      assert.ok(scoreMatch('elasticsearh', 'elasticsearch') > 30);
    });
  });

  describe('no match', () => {
    it('unrelated strings return 0', () => {
      assert.equal(scoreMatch('kubernetes', 'gitlab'), 0);
    });

    it('completely different words return 0', () => {
      assert.equal(scoreMatch('docker', 'jira'), 0);
    });

    it('no partial overlap returns 0', () => {
      assert.equal(scoreMatch('terraform', 'slack'), 0);
    });
  });
});

describe('resolveServerName', () => {
  describe('exact name', () => {
    it('resolves gitlab', () => {
      assert.equal(resolveServerName('gitlab'), 'gitlab');
    });

    it('resolves jira-cloud', () => {
      assert.equal(resolveServerName('jira-cloud'), 'jira-cloud');
    });

    it('resolves elasticsearch-prod', () => {
      assert.equal(resolveServerName('elasticsearch-prod'), 'elasticsearch-prod');
    });

    it('resolves datadog', () => {
      assert.equal(resolveServerName('datadog'), 'datadog');
    });
  });

  describe('keyword match', () => {
    it('"pipeline" resolves to gitlab', () => {
      assert.equal(resolveServerName('pipeline'), 'gitlab');
    });

    it('"sprint" resolves to jira-cloud', () => {
      assert.equal(resolveServerName('sprint'), 'jira-cloud');
    });

    it('"kibana" resolves to elasticsearch-prod', () => {
      assert.equal(resolveServerName('kibana'), 'elasticsearch-prod');
    });

    it('"APM" resolves to datadog', () => {
      assert.equal(resolveServerName('APM'), 'datadog');
    });

    it('"channels" resolves to slack-mcp', () => {
      assert.equal(resolveServerName('channels'), 'slack-mcp');
    });
  });

  describe('fuzzy/prefix resolution', () => {
    it('"elastic" resolves to elasticsearch-prod', () => {
      assert.equal(resolveServerName('elastic'), 'elasticsearch-prod');
    });

    it('"jira" resolves to jira-cloud', () => {
      assert.equal(resolveServerName('jira'), 'jira-cloud');
    });

    it('"slack" resolves to slack-mcp', () => {
      assert.equal(resolveServerName('slack'), 'slack-mcp');
    });
  });

  describe('typo tolerance', () => {
    it('"gtilab" resolves to gitlab', () => {
      assert.equal(resolveServerName('gtilab'), 'gitlab');
    });

    it('"datadg" resolves to datadog', () => {
      assert.equal(resolveServerName('datadg'), 'datadog');
    });
  });

  describe('not found', () => {
    it('"kubernetes" returns undefined', () => {
      assert.equal(resolveServerName('kubernetes'), undefined);
    });

    it('"terraform" returns undefined', () => {
      assert.equal(resolveServerName('terraform'), undefined);
    });

    it('"aws" returns undefined', () => {
      assert.equal(resolveServerName('aws'), undefined);
    });
  });

  describe('ambiguity (best match wins)', () => {
    it('"search" resolves to elasticsearch-prod', () => {
      assert.equal(resolveServerName('search'), 'elasticsearch-prod');
    });

    it('"merge" resolves to gitlab', () => {
      assert.equal(resolveServerName('merge'), 'gitlab');
    });
  });
});

describe('getServer', () => {
  it('resolves by keyword and returns config', () => {
    const config = getServer('pipeline');
    assert.ok(config);
    assert.ok(config.keywords.includes('gitlab'));
  });

  it('returns undefined for unknown server', () => {
    assert.equal(getServer('kubernetes'), undefined);
  });
});
