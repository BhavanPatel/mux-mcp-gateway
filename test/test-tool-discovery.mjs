/**
 * Unit tests for tool-level discovery (cache search and auto-routing).
 * Run: node --test test/test-tool-discovery.mjs
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CACHE_DIR = resolve(homedir(), '.mux');
const CATALOG_PATH = resolve(CACHE_DIR, 'tool-catalog.json');

let originalCatalog;
let findToolsAcrossServers, resolveServerByToolName;

before(async () => {
  // Backup existing catalog
  if (existsSync(CATALOG_PATH)) {
    originalCatalog = (await import('node:fs')).readFileSync(CATALOG_PATH, 'utf-8');
  }

  // Write test catalog with realistic tool data
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

  const testCatalog = {
    'gitlab': {
      tools: [
        { name: 'list_merge_requests', description: 'List merge requests for a project' },
        { name: 'create_merge_request', description: 'Create a new merge request' },
        { name: 'get_pipeline_status', description: 'Get the status of a CI/CD pipeline' },
        { name: 'list_branches', description: 'List branches in a repository' },
        { name: 'get_commit', description: 'Get details of a specific commit' },
      ],
      discoveredAt: Date.now(),
    },
    'jira-cloud': {
      tools: [
        { name: 'search_issues', description: 'Search Jira issues using JQL' },
        { name: 'create_issue', description: 'Create a new Jira issue' },
        { name: 'get_issue', description: 'Get details of a specific issue' },
        { name: 'transition_issue', description: 'Transition an issue to a new status' },
        { name: 'add_comment', description: 'Add a comment to an issue' },
      ],
      discoveredAt: Date.now(),
    },
    'elasticsearch-prod': {
      tools: [
        { name: 'search_logs', description: 'Search application logs in Elasticsearch' },
        { name: 'get_index_stats', description: 'Get statistics for an Elasticsearch index' },
        { name: 'query_metrics', description: 'Query time-series metrics data' },
      ],
      discoveredAt: Date.now(),
    },
    'expired-server': {
      tools: [
        { name: 'expired_tool', description: 'This should not be returned' },
      ],
      discoveredAt: Date.now() - 7_200_000, // 2 hours ago (beyond 1hr TTL)
    },
  };

  writeFileSync(CATALOG_PATH, JSON.stringify(testCatalog), 'utf-8');

  process.env.MUX_LOG_LEVEL = 'error';
  const discovery = await import(resolve(ROOT, 'dist/tool-discovery.js'));
  findToolsAcrossServers = discovery.findToolsAcrossServers;
  resolveServerByToolName = discovery.resolveServerByToolName;
});

after(() => {
  // Restore original catalog
  if (originalCatalog) {
    writeFileSync(CATALOG_PATH, originalCatalog, 'utf-8');
  }
});

describe('findToolsAcrossServers', () => {
  describe('exact tool name match', () => {
    it('finds tool by exact name', () => {
      const results = findToolsAcrossServers('list_merge_requests');
      assert.ok(results.length > 0);
      assert.equal(results[0].server, 'gitlab');
      assert.equal(results[0].tool, 'list_merge_requests');
    });

    it('finds tool from another server by exact name', () => {
      const results = findToolsAcrossServers('search_issues');
      assert.ok(results.length > 0);
      assert.equal(results[0].server, 'jira-cloud');
      assert.equal(results[0].tool, 'search_issues');
    });
  });

  describe('partial name match', () => {
    it('finds tools containing query substring', () => {
      const results = findToolsAcrossServers('merge');
      assert.ok(results.length >= 2);
      assert.ok(results.some(r => r.tool === 'list_merge_requests'));
      assert.ok(results.some(r => r.tool === 'create_merge_request'));
    });

    it('finds tools by word part', () => {
      const results = findToolsAcrossServers('issue');
      assert.ok(results.length >= 3);
      assert.ok(results.some(r => r.tool === 'search_issues'));
      assert.ok(results.some(r => r.tool === 'create_issue'));
      assert.ok(results.some(r => r.tool === 'get_issue'));
    });

    it('finds tools by prefix', () => {
      const results = findToolsAcrossServers('list');
      assert.ok(results.length >= 2);
      assert.ok(results.some(r => r.tool === 'list_merge_requests'));
      assert.ok(results.some(r => r.tool === 'list_branches'));
    });
  });

  describe('description-based match', () => {
    it('matches against tool description when name does not match', () => {
      const results = findToolsAcrossServers('CI/CD');
      assert.ok(results.length > 0);
      assert.ok(results.some(r => r.tool === 'get_pipeline_status'));
    });

    it('finds tools by description keyword', () => {
      const results = findToolsAcrossServers('JQL');
      assert.ok(results.length > 0);
      assert.equal(results[0].tool, 'search_issues');
    });
  });

  describe('cross-server results', () => {
    it('returns results from multiple servers', () => {
      const results = findToolsAcrossServers('search');
      const servers = [...new Set(results.map(r => r.server))];
      assert.ok(servers.length >= 2, `Expected results from multiple servers, got: ${servers}`);
    });

    it('includes server name in results', () => {
      const results = findToolsAcrossServers('search_logs');
      assert.ok(results.length > 0);
      assert.equal(results[0].server, 'elasticsearch-prod');
    });

    it('includes description in results', () => {
      const results = findToolsAcrossServers('get_commit');
      assert.ok(results.length > 0);
      assert.equal(results[0].description, 'Get details of a specific commit');
    });
  });

  describe('no match', () => {
    it('returns empty array for completely unknown query', () => {
      const results = findToolsAcrossServers('kubernetes_deploy_pod');
      assert.deepEqual(results, []);
    });
  });

  describe('expired cache entries', () => {
    it('does not return tools from expired cache entries', () => {
      const results = findToolsAcrossServers('expired_tool');
      assert.deepEqual(results, []);
    });
  });

  describe('result ordering', () => {
    it('ranks exact name match above substring match', () => {
      const results = findToolsAcrossServers('get_issue');
      assert.equal(results[0].tool, 'get_issue');
    });
  });
});

describe('resolveServerByToolName', () => {
  describe('known tools', () => {
    it('resolves gitlab tool to gitlab server', () => {
      assert.equal(resolveServerByToolName('list_merge_requests'), 'gitlab');
    });

    it('resolves jira tool to jira-cloud server', () => {
      assert.equal(resolveServerByToolName('search_issues'), 'jira-cloud');
    });

    it('resolves elasticsearch tool to elasticsearch-prod server', () => {
      assert.equal(resolveServerByToolName('search_logs'), 'elasticsearch-prod');
    });

    it('is case insensitive', () => {
      assert.equal(resolveServerByToolName('List_Merge_Requests'), 'gitlab');
    });
  });

  describe('unknown tools', () => {
    it('returns undefined for unknown tool', () => {
      assert.equal(resolveServerByToolName('deploy_to_kubernetes'), undefined);
    });

    it('returns undefined for empty string', () => {
      assert.equal(resolveServerByToolName(''), undefined);
    });
  });

  describe('expired cache entries', () => {
    it('does not resolve tools from expired cache', () => {
      assert.equal(resolveServerByToolName('expired_tool'), undefined);
    });
  });
});
