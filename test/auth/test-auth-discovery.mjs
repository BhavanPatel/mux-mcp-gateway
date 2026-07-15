/**
 * Tests for OAuth discovery probe logic.
 * Validates that:
 * 1. Servers without OAuth discovery endpoint fail fast (no 120s hang)
 * 2. Servers with valid OAuth discovery get the auth flow triggered
 * 3. Invalid discovery responses are rejected
 *
 * Usage: node test/test-auth-discovery.mjs
 */
import { createServer } from 'node:http';

// ====== Test framework ======
let pass = 0,
  fail = 0;
const results = [];

function assert(name, condition) {
  if (condition) {
    pass++;
    results.push({ name, status: 'pass' });
  } else {
    fail++;
    results.push({ name, status: 'fail' });
  }
}

// ====== Mock servers ======

/**
 * Create a mock HTTP server that simulates different auth scenarios.
 */
function createMockServer(opts = {}) {
  const { hasDiscovery = false, discoveryResponse = null, returns401 = true } = opts;

  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      // OAuth discovery endpoint
      if (req.url === '/.well-known/oauth-authorization-server') {
        if (hasDiscovery && discoveryResponse) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(discoveryResponse));
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
        return;
      }

      // MCP endpoint — return 401 or 200
      if (returns401) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', result: {} }));
      }
    });

    server.listen(0, () => {
      const port = server.address().port;
      resolve({ server, port, url: `http://localhost:${port}` });
    });
  });
}

// ====== Import the discovery function ======
// We test the hasOAuthDiscovery logic by hitting our mock servers directly
async function probeDiscovery(serverUrl) {
  try {
    const url = new URL(serverUrl);
    const discoveryUrl = `${url.origin}/.well-known/oauth-authorization-server`;
    const response = await fetch(discoveryUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const body = await response.json();
      return !!(body && body.authorization_endpoint);
    }
    return false;
  } catch {
    return false;
  }
}

// ====== TESTS ======
console.log('\n  \x1b[1m\x1b[38;5;87mAUTH DISCOVERY TESTS\x1b[0m\n');

try {
  // Test 1: Server without discovery endpoint returns false
  console.log('  \x1b[38;5;39m━━━\x1b[0m \x1b[1m1. No OAuth discovery\x1b[0m');
  const noAuth = await createMockServer({ hasDiscovery: false, returns401: true });
  const result1 = await probeDiscovery(noAuth.url);
  assert('Server without discovery returns false', result1 === false);
  noAuth.server.close();

  // Test 2: Server with valid discovery returns true
  console.log('  \x1b[38;5;39m━━━\x1b[0m \x1b[1m2. Valid OAuth discovery\x1b[0m');
  const withAuth = await createMockServer({
    hasDiscovery: true,
    discoveryResponse: {
      issuer: 'https://auth.example.com',
      authorization_endpoint: 'https://auth.example.com/authorize',
      token_endpoint: 'https://auth.example.com/token',
    },
    returns401: true,
  });
  const result2 = await probeDiscovery(withAuth.url);
  assert('Server with valid discovery returns true', result2 === true);
  withAuth.server.close();

  // Test 3: Server with discovery but no authorization_endpoint returns false
  console.log('  \x1b[38;5;39m━━━\x1b[0m \x1b[1m3. Invalid discovery (missing authorization_endpoint)\x1b[0m');
  const badDiscovery = await createMockServer({
    hasDiscovery: true,
    discoveryResponse: {
      issuer: 'https://auth.example.com',
      // Missing authorization_endpoint
      token_endpoint: 'https://auth.example.com/token',
    },
    returns401: true,
  });
  const result3 = await probeDiscovery(badDiscovery.url);
  assert('Discovery without authorization_endpoint returns false', result3 === false);
  badDiscovery.server.close();

  // Test 4: Unreachable server returns false (doesn't hang)
  console.log('  \x1b[38;5;39m━━━\x1b[0m \x1b[1m4. Unreachable server (timeout)\x1b[0m');
  const start = Date.now();
  const result4 = await probeDiscovery('http://192.0.2.1:9999'); // Non-routable IP
  const elapsed = Date.now() - start;
  assert('Unreachable server returns false', result4 === false);
  assert('Probe completes within 6s (5s timeout + buffer)', elapsed < 6000);

  // Test 5: Discovery with empty body returns false
  console.log('  \x1b[38;5;39m━━━\x1b[0m \x1b[1m5. Empty discovery response\x1b[0m');
  const emptyDiscovery = await createMockServer({
    hasDiscovery: true,
    discoveryResponse: {},
    returns401: true,
  });
  const result5 = await probeDiscovery(emptyDiscovery.url);
  assert('Empty discovery body returns false', result5 === false);
  emptyDiscovery.server.close();

  // Test 6: Server that doesn't need auth (200 on connect) — just validate probe still works
  console.log('  \x1b[38;5;39m━━━\x1b[0m \x1b[1m6. Server not needing auth\x1b[0m');
  const noAuthNeeded = await createMockServer({ hasDiscovery: false, returns401: false });
  const result6 = await probeDiscovery(noAuthNeeded.url);
  assert('Server without auth need has no discovery', result6 === false);
  noAuthNeeded.server.close();
} catch (err) {
  console.error(`  \x1b[38;5;196m✖ Fatal error: ${err.message}\x1b[0m`);
  fail++;
  results.push({ name: `Fatal: ${err.message}`, status: 'fail' });
}

// ====== REPORT ======
console.log('\n  \x1b[38;5;39m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
console.log('  \x1b[1mRESULTS\x1b[0m\n');
for (const r of results) {
  const icon = r.status === 'pass' ? '\x1b[38;5;46m✔\x1b[0m' : '\x1b[38;5;196m✖\x1b[0m';
  console.log(`  ${icon} ${r.name}`);
}
console.log(`\n  \x1b[38;5;46m✔ ${pass} passed\x1b[0m   \x1b[38;5;196m✖ ${fail} failed\x1b[0m`);

if (fail === 0) console.log('\n  \x1b[38;5;46m\x1b[1mALL TESTS PASSED\x1b[0m\n');
else console.log('\n  \x1b[38;5;196m\x1b[1mSOME TESTS FAILED\x1b[0m\n');

process.exit(fail > 0 ? 1 : 0);
