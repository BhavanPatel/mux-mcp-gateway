/**
 * E2E tests for connection pool behavior.
 * Tests lazy spawn, error handling, concurrent calls.
 * Usage: node test/e2e/test-pool.mjs
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const MUX_BIN = resolve(ROOT, 'dist/index.js');
const TEST_DIR = '/tmp/mux-pool-test';
const REGISTRY = resolve(TEST_DIR, 'servers.json');

// Setup
if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
mkdirSync(TEST_DIR, { recursive: true });

writeFileSync(
  REGISTRY,
  JSON.stringify(
    {
      servers: {
        'pool-echo': {
          transport: 'stdio',
          command: 'node',
          args: [
            '-e',
            `
        const{McpServer}=require('@modelcontextprotocol/sdk/server/mcp.js');
        const{StdioServerTransport}=require('@modelcontextprotocol/sdk/server/stdio.js');
        const s=new McpServer({name:'pool-echo',version:'1.0'});
        s.tool('ping',{},async()=>({content:[{type:'text',text:'pong'}]}));
        s.tool('slow',{},async()=>{await new Promise(r=>setTimeout(r,100));return{content:[{type:'text',text:'done'}]};});
        s.connect(new StdioServerTransport());
      `,
          ],
          keywords: ['pool', 'test', 'echo'],
          idleTimeoutMs: 5000,
        },
        'pool-fail': {
          transport: 'stdio',
          command: 'node',
          args: ['-e', 'process.exit(1)'],
          keywords: ['fail'],
          idleTimeoutMs: 5000,
        },
      },
    },
    null,
    2,
  ),
);

writeFileSync(resolve(TEST_DIR, 'tokens.json'), '{}');

// Test framework
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

async function connectMux() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [MUX_BIN],
    env: {
      ...process.env,
      MUX_REGISTRY_PATH: REGISTRY,
      MUX_TOKEN_STORE_PATH: resolve(TEST_DIR, 'tokens.json'),
      MUX_LOG_LEVEL: 'error',
    },
  });
  const client = new Client({ name: 'pool-test', version: '1.0' });
  await client.connect(transport);
  return { client, transport };
}

// ====== TESTS ======
console.log('\n  \x1b[1m\x1b[38;5;87mPOOL E2E TESTS\x1b[0m\n');

let client, transport;

try {
  ({ client, transport } = await connectMux());

  // 1. Lazy connection
  console.log('  \x1b[38;5;39m━━━\x1b[0m \x1b[1m1. Lazy connection\x1b[0m');
  const status1 = await client.callTool({ name: 'mux_status', arguments: {} });
  const s1 = JSON.parse(status1.content[0].text);
  assert('Pool empty before any call', s1.activeConnections === 0);

  const ping1 = await client.callTool({
    name: 'mux_call_tool',
    arguments: { server: 'pool-echo', tool: 'ping', arguments: {} },
  });
  assert('First call spawns connection', ping1.content[0].text === 'pong');

  const status2 = await client.callTool({ name: 'mux_status', arguments: {} });
  const s2 = JSON.parse(status2.content[0].text);
  assert('Active connections is 1 after spawn', s2.activeConnections === 1);

  // 2. Connection reuse
  console.log('  \x1b[38;5;39m━━━\x1b[0m \x1b[1m2. Connection reuse\x1b[0m');
  const ping2 = await client.callTool({
    name: 'mux_call_tool',
    arguments: { server: 'pool-echo', tool: 'ping', arguments: {} },
  });
  assert('Subsequent call reuses connection', ping2.content[0].text === 'pong');

  const status3 = await client.callTool({ name: 'mux_status', arguments: {} });
  const s3 = JSON.parse(status3.content[0].text);
  assert('Still only 1 connection', s3.activeConnections === 1);

  // 3. Error handling
  console.log('  \x1b[38;5;39m━━━\x1b[0m \x1b[1m3. Error handling\x1b[0m');
  const errResult = await client.callTool({
    name: 'mux_call_tool',
    arguments: { server: 'pool-fail', tool: 'anything', arguments: {} },
  });
  assert('Crash server returns error', errResult.isError === true);

  const ping3 = await client.callTool({
    name: 'mux_call_tool',
    arguments: { server: 'pool-echo', tool: 'ping', arguments: {} },
  });
  assert('Gateway survives after error', ping3.content[0].text === 'pong');

  const unknownResult = await client.callTool({
    name: 'mux_call_tool',
    arguments: { server: 'nonexistent-xyz', tool: 'foo', arguments: {} },
  });
  assert('Unknown server returns error', unknownResult.isError === true);
  assert('Error mentions not found', unknownResult.content[0].text.includes('not found'));

  // 4. Concurrent calls
  console.log('  \x1b[38;5;39m━━━\x1b[0m \x1b[1m4. Concurrent calls\x1b[0m');
  const concurrent = await Promise.all([
    client.callTool({ name: 'mux_call_tool', arguments: { server: 'pool-echo', tool: 'ping', arguments: {} } }),
    client.callTool({ name: 'mux_call_tool', arguments: { server: 'pool-echo', tool: 'ping', arguments: {} } }),
    client.callTool({ name: 'mux_call_tool', arguments: { server: 'pool-echo', tool: 'ping', arguments: {} } }),
  ]);
  assert(
    'All concurrent calls succeed',
    concurrent.every((r) => r.content[0].text === 'pong'),
  );

  const [slow, fast] = await Promise.all([
    client.callTool({ name: 'mux_call_tool', arguments: { server: 'pool-echo', tool: 'slow', arguments: {} } }),
    client.callTool({ name: 'mux_call_tool', arguments: { server: 'pool-echo', tool: 'ping', arguments: {} } }),
  ]);
  assert('Slow call completes', slow.content[0].text === 'done');
  assert('Fast call not blocked by slow', fast.content[0].text === 'pong');

  // 5. Server list
  console.log('  \x1b[38;5;39m━━━\x1b[0m \x1b[1m5. Server list reflects pool\x1b[0m');
  const listResult = await client.callTool({ name: 'mux_list_servers', arguments: {} });
  const servers = JSON.parse(listResult.content[0].text);
  const echo = servers.find((s) => s.name === 'pool-echo');
  assert('Active server shows tool count', echo.status === 'active' && echo.tools === 2);
  const failSrv = servers.find((s) => s.name === 'pool-fail');
  assert('Failed server shows idle', failSrv.status === 'idle');
} catch (err) {
  console.error(`  \x1b[38;5;196m✖ Fatal: ${err.message}\x1b[0m`);
  fail++;
  results.push({ name: `Fatal: ${err.message}`, status: 'fail' });
} finally {
  try {
    await transport.close();
  } catch {}
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

// Cleanup
rmSync(TEST_DIR, { recursive: true, force: true });
process.exit(fail > 0 ? 1 : 0);
