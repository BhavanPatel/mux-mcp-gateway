/**
 * Group 13 (integration) — connectHttp surfaces the *real* cause on the auth
 * path, end-to-end, against a live local HTTP server. Complements the provider
 * unit tests (which cover denied/no-browser/timeout/state at the provider
 * layer) by proving the transport wiring does not collapse errors into a
 * generic "authorization was not completed" message.
 *
 * Run: node --test test/e2e/test-auth-http.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
process.env.MUX_TOKEN_STORE_PATH = '/tmp/mux-e2e-auth-tokens.json';

const { connectHttp } = await import(resolve(ROOT, 'dist/transport/http.js'));

/** Start a mock server. `mode` decides how it responds. Returns {url, close}. */
function startServer(mode) {
  return new Promise((resolvePromise) => {
    const server = createServer((req, res) => {
      if (req.url.startsWith('/.well-known/oauth-authorization-server')) {
        // No OAuth discovery in these two negative-path cases.
        res.writeHead(404);
        res.end('no discovery');
        return;
      }
      if (mode === 'boom') {
        res.writeHead(500);
        res.end('kaboom internal error');
        return;
      }
      // Default: 401 unauthorized (triggers the auth branch).
      res.writeHead(401);
      res.end('Unauthorized');
    });
    server.listen(0, '127.0.0.1', () => {
      resolvePromise({ url: `http://127.0.0.1:${server.address().port}/mcp`, close: () => server.close() });
    });
  });
}

describe('connectHttp: real cause on the auth path', () => {
  it('401 with NO OAuth discovery → precise error, not generic', async () => {
    const srv = await startServer('no-oauth');
    try {
      await assert.rejects(connectHttp('no-oauth-srv', { transport: 'http', url: srv.url }), (e) => {
        assert.match(e.message, /does not have an OAuth discovery endpoint/);
        assert.doesNotMatch(e.message, /was not completed/);
        return true;
      });
    } finally {
      srv.close();
    }
  });

  it('non-auth failure (500) propagates the real error, no generic auth message', async () => {
    const srv = await startServer('boom');
    try {
      await assert.rejects(connectHttp('boom-srv', { transport: 'http', url: srv.url }), (e) => {
        assert.doesNotMatch(e.message, /was not completed/);
        assert.doesNotMatch(e.message, /OAuth discovery/);
        return true;
      });
    } finally {
      srv.close();
    }
  });
});
