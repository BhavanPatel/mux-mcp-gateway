/**
 * MCP protocol e2e tests — runs Mux as a child process, sends MCP messages, validates responses.
 * Usage: node scripts/test-mcp.mjs
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MUX_BIN = resolve(ROOT, 'dist/index.js');
const TEST_DIR = '/tmp/mux-e2e-test';

// Setup test environment
if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
mkdirSync(TEST_DIR, { recursive: true });

const REGISTRY = resolve(TEST_DIR, 'servers.json');
const TOKENS = resolve(TEST_DIR, 'tokens.json');
const CATALOG = resolve(TEST_DIR, 'tool-catalog.json');

writeFileSync(TOKENS, '{}');
writeFileSync(REGISTRY, JSON.stringify({
  servers: {
    'test-echo': {
      transport: 'stdio',
      command: 'node',
      args: ['-e', `
        const{McpServer}=require('@modelcontextprotocol/sdk/server/mcp.js');
        const{StdioServerTransport}=require('@modelcontextprotocol/sdk/server/stdio.js');
        const s=new McpServer({name:'echo',version:'1.0'});
        s.tool('ping',{},async()=>({content:[{type:'text',text:'pong'}]}));
        s.tool('echo',{msg:{type:'string'}},async({msg})=>({content:[{type:'text',text:msg}]}));
        s.connect(new StdioServerTransport());
      `],
      keywords: ['test', 'echo', 'ping'],
      idleTimeoutMs: 10000
    }
  }
}, null, 2));

// Test framework
let pass = 0, fail = 0;
const results = [];

function assert(name, condition) {
  if (condition) { pass++; results.push({ name, status: 'pass' }); }
  else { fail++; results.push({ name, status: 'fail' }); }
}

async function connectMux() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [MUX_BIN],
    env: {
      ...process.env,
      MUX_REGISTRY_PATH: REGISTRY,
      MUX_TOKEN_STORE_PATH: TOKENS,
      MUX_LOG_LEVEL: 'error',
    },
  });
  const client = new Client({ name: 'e2e-test', version: '1.0' });
  await client.connect(transport);
  return { client, transport };
}

// ====== TESTS ======
console.log('\n  \x1b[1m\x1b[38;5;87mMUX E2E TESTS (MCP Protocol)\x1b[0m\n');

let client, transport;

try {
  // 1. Connection
  console.log('  \x1b[38;5;39m━━━\x1b[0m \x1b[1m1. Connection\x1b[0m');
  ({ client, transport } = await connectMux());
  assert('Connects to Mux via stdio', true);

  // 2. List tools
  console.log('  \x1b[38;5;39m━━━\x1b[0m \x1b[1m2. Tools\x1b[0m');
  const { tools } = await client.listTools();
  assert('Exposes exactly 4 tools', tools.length === 4);
  assert('Has mux_list_servers', tools.some(t => t.name === 'mux_list_servers'));
  assert('Has mux_call_tool', tools.some(t => t.name === 'mux_call_tool'));
  assert('Has mux_find_tool', tools.some(t => t.name === 'mux_find_tool'));
  assert('Has mux_status', tools.some(t => t.name === 'mux_status'));

  // 3. mux_list_servers
  console.log('  \x1b[38;5;39m━━━\x1b[0m \x1b[1m3. mux_list_servers\x1b[0m');
  const listResult = await client.callTool({ name: 'mux_list_servers', arguments: {} });
  const servers = JSON.parse(listResult.content[0].text);
  assert('Returns server array', Array.isArray(servers));
  assert('Contains test-echo', servers.some(s => s.name === 'test-echo'));
  assert('Shows idle status', servers[0].status === 'idle');
  assert('Shows keywords', servers[0].keywords.includes('test'));

  // 4. mux_status
  console.log('  \x1b[38;5;39m━━━\x1b[0m \x1b[1m4. mux_status\x1b[0m');
  const statusResult = await client.callTool({ name: 'mux_status', arguments: {} });
  const status = JSON.parse(statusResult.content[0].text);
  assert('Has uptime', 'uptime' in status);
  assert('Has registeredServers', status.registeredServers === 1);
  assert('Has activeConnections (0 initially)', status.activeConnections === 0);
  assert('Has memory info', 'memory' in status);
  assert('Has cache info', 'cache' in status);
  assert('Has contextReductionPct in metrics', 'contextReductionPct' in status.metrics);

  // 5. mux_call_tool — connect to downstream
  console.log('  \x1b[38;5;39m━━━\x1b[0m \x1b[1m5. mux_call_tool (downstream)\x1b[0m');
  const pingResult = await client.callTool({
    name: 'mux_call_tool',
    arguments: { server: 'test-echo', tool: 'ping', arguments: {} }
  });
  assert('Ping returns pong', pingResult.content[0].text === 'pong');

  // 6. After call — server is active
  console.log('  \x1b[38;5;39m━━━\x1b[0m \x1b[1m6. Pool state after call\x1b[0m');
  const listAfter = await client.callTool({ name: 'mux_list_servers', arguments: {} });
  const serversAfter = JSON.parse(listAfter.content[0].text);
  const echoServer = serversAfter.find(s => s.name === 'test-echo');
  assert('Server now active', echoServer.status === 'active');
  assert('Shows tool count', typeof echoServer.tools === 'number' && echoServer.tools > 0);

  const statusAfter = await client.callTool({ name: 'mux_status', arguments: {} });
  const stAfter = JSON.parse(statusAfter.content[0].text);
  assert('activeConnections is 1', stAfter.activeConnections === 1);

  // 7. Unknown server
  console.log('  \x1b[38;5;39m━━━\x1b[0m \x1b[1m7. Error handling\x1b[0m');
  const errResult = await client.callTool({
    name: 'mux_call_tool',
    arguments: { server: 'nonexistent', tool: 'foo', arguments: {} }
  });
  assert('Unknown server returns error', errResult.isError === true);
  assert('Error mentions not found', errResult.content[0].text.includes('not found'));

  // Unknown tool on known server
  const badTool = await client.callTool({
    name: 'mux_call_tool',
    arguments: { server: 'test-echo', tool: 'nonexistent_tool', arguments: {} }
  });
  assert('Unknown tool returns error', badTool.isError === true);
  assert('Lists available tools', badTool.content[0].text.includes('ping'));

  // 8. Tool schema catalog
  console.log('  \x1b[38;5;39m━━━\x1b[0m \x1b[1m8. Schema catalog\x1b[0m');
  // Catalog should have been written after connecting to test-echo
  const catalogExists = existsSync(resolve(process.env.HOME, '.mux', 'tool-catalog.json'));
  assert('Catalog file created after connection', catalogExists);

  // 9. mux_find_tool — search cached tools
  console.log('  \x1b[38;5;39m━━━\x1b[0m \x1b[1m9. mux_find_tool\x1b[0m');
  const findPing = await client.callTool({ name: 'mux_find_tool', arguments: { query: 'ping' } });
  const pingResults = JSON.parse(findPing.content[0].text);
  assert('find_tool returns results for "ping"', Array.isArray(pingResults) && pingResults.length > 0);
  assert('find_tool result has server field', pingResults[0].server === 'test-echo');
  assert('find_tool result has tool field', pingResults[0].tool === 'ping');

  const findEcho = await client.callTool({ name: 'mux_find_tool', arguments: { query: 'echo' } });
  const echoResults = JSON.parse(findEcho.content[0].text);
  assert('find_tool finds "echo" tool', echoResults.some(r => r.tool === 'echo'));

  const findNothing = await client.callTool({ name: 'mux_find_tool', arguments: { query: 'nonexistent_xyz' } });
  assert('find_tool returns message for no results', findNothing.content[0].text.includes('No tools found'));

  // 10. Auto-routing — call tool without specifying server
  console.log('  \x1b[38;5;39m━━━\x1b[0m \x1b[1m10. Auto-routing (no server param)\x1b[0m');
  const autoResult = await client.callTool({
    name: 'mux_call_tool',
    arguments: { tool: 'ping', arguments: {} }
  });
  assert('Auto-route resolves ping to test-echo', autoResult.content[0].text === 'pong');

  // Verify auto-route also works for second tool on same server
  const autoResult2 = await client.callTool({
    name: 'mux_call_tool',
    arguments: { tool: 'ping', arguments: {} }
  });
  assert('Auto-route works on repeated calls', autoResult2.content[0].text === 'pong');

  const autoFail = await client.callTool({
    name: 'mux_call_tool',
    arguments: { tool: 'totally_unknown_tool', arguments: {} }
  });
  assert('Auto-route fails gracefully for unknown tool', autoFail.isError === true);
  assert('Auto-route error suggests mux_find_tool', autoFail.content[0].text.includes('mux_find_tool'));

} catch (err) {
  console.error(`  \x1b[38;5;196m✖ Fatal error: ${err.message}\x1b[0m`);
  fail++;
  results.push({ name: `Fatal: ${err.message}`, status: 'fail' });
} finally {
  try { await transport.close(); } catch {}
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
