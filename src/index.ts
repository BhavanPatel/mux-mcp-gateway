import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { loadRegistry, watchRegistry } from './registry.js';
import { disconnectAll } from './pool.js';
import { logger } from './logger.js';
import { loadEnvFiles } from './env.js';
import { loadMetrics, flushMetrics, pruneOldEvents } from './metrics.js';

async function main() {
  // Load env vars from shell profiles and .env files
  loadEnvFiles();

  // Load metrics history
  loadMetrics();
  pruneOldEvents();

  logger.info('Mux starting...');

  // Load registry
  loadRegistry();
  watchRegistry();

  // Create MCP server
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('Mux MCP server running on stdio');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    flushMetrics();
    await disconnectAll();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Exit if parent closes stdin (prevents orphan processes)
  process.stdin.on('end', shutdown);
  process.stdin.on('close', shutdown);
}

main().catch((err) => {
  logger.error(`Fatal: ${err.message}`);
  process.exit(1);
});
