import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getRegistry } from './registry.js';
import { callTool, getPoolStatus, getOrConnect } from './pool.js';
import { getToolsForServer, getCatalogStats } from './tool-catalog.js';
import { findToolsAcrossServers, resolveServerByToolName } from './tool-discovery.js';
import { getQuickStats, getInsights } from './metrics.js';
import { logger } from './logger.js';

const startTime = Date.now();
const MAX_KEYWORDS_IN_DESCRIPTION = 5;
const BYTES_PER_MB = 1024 * 1024;
const MS_PER_SECOND = 1000;

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'mux',
    version: '0.1.0',
  });

  // Build dynamic description with registered server names + keywords for discoverability
  const registry = getRegistry();
  const serverSummaries = Object.entries(registry.servers).map(([name, config]) => {
    const keywords = config.keywords?.slice(0, MAX_KEYWORDS_IN_DESCRIPTION).join(', ') || '';
    return keywords ? `${name} (${keywords})` : name;
  });
  const serverList = serverSummaries.join(', ');

  // Tool 1: List servers with cached tools + keyword matching
  server.tool(
    'mux_list_servers',
    `List all registered downstream MCP servers with their status (idle/active) and available tools. Call this to discover what servers are available before routing calls. Currently registered: ${serverList || 'none yet'}.`,
    {},
    async () => {
      const currentRegistry = getRegistry();
      const activeStatus = getPoolStatus();
      const activeMap = new Map(activeStatus.map(entry => [entry.name, entry]));

      const servers = Object.entries(currentRegistry.servers).map(([name, config]) => {
        const activeEntry = activeMap.get(name);
        const cachedTools = !activeEntry ? getToolsForServer(name) : undefined;
        return {
          name,
          transport: config.transport,
          keywords: config.keywords || [],
          status: activeEntry ? 'active' : 'idle',
          tools: activeEntry
            ? activeEntry.tools
            : cachedTools
              ? cachedTools.map(tool => tool.name)
              : undefined,
          idleMs: activeEntry ? activeEntry.idleMs : undefined,
        };
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(servers, null, 2) }],
      };
    }
  );

  // Tool 2: Route a tool call
  server.tool(
    'mux_call_tool',
    `Route a tool call to a downstream MCP server. The server will be started automatically if not already running. If "server" is omitted, Mux will attempt to auto-resolve which server owns the tool from cached tool metadata. Available servers: ${serverList || 'none yet'}.`,
    {
      server: z.string().optional().describe('Name of the downstream server. Optional — if omitted, Mux auto-resolves from cached tool names.'),
      tool: z.string().describe('Name of the tool to call on that server'),
      arguments: z.record(z.unknown()).optional().default({}).describe('Arguments to pass to the tool'),
    },
    async ({ server: serverName, tool: toolName, arguments: toolArgs }) => {
      try {
        const resolvedServer = serverName || resolveServerByToolName(toolName);
        if (!resolvedServer) {
          return {
            content: [{ type: 'text' as const, text: `Cannot resolve server for tool "${toolName}". No server specified and tool not found in cache. Use mux_find_tool to search available tools, or specify the server explicitly.` }],
            isError: true,
          };
        }

        const entry = await getOrConnect(resolvedServer);
        const toolExists = entry.tools.some(tool => tool.name === toolName);
        if (!toolExists) {
          const available = entry.tools.map(tool => tool.name).join(', ');
          return {
            content: [{ type: 'text' as const, text: `Tool "${toolName}" not found on server "${resolvedServer}". Available tools: ${available}` }],
            isError: true,
          };
        }

        const result = await callTool(resolvedServer, toolName, toolArgs);
        return result as any;
      } catch (err: any) {
        logger.error(`mux_call_tool failed: ${err.message}`, { server: serverName, tool: toolName });
        return {
          content: [{ type: 'text' as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 3: Search for tools across all cached servers
  server.tool(
    'mux_find_tool',
    'Search for a tool across all registered downstream servers by name or description. Uses cached tool metadata — does not require connecting to servers. Returns matching tools with their server name and description.',
    {
      query: z.string().describe('Search query — tool name, partial name, or keyword to find relevant tools'),
    },
    async ({ query }) => {
      const results = findToolsAcrossServers(query);

      if (results.length === 0) {
        return {
          content: [{ type: 'text' as const, text: `No tools found matching "${query}". Note: only previously-connected servers have cached tools. Use mux_list_servers to see all servers, then call any tool on a server to populate its cache.` }],
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }],
      };
    }
  );

  // Tool 4: Diagnostics
  server.tool(
    'mux_status',
    'Show Mux gateway diagnostics: uptime, active connections, memory usage, cache stats, and registered server count.',
    {},
    async () => {
      const currentRegistry = getRegistry();
      const activeConnections = getPoolStatus();
      const cacheStats = getCatalogStats();
      const memoryUsage = process.memoryUsage();
      const quickStats = getQuickStats();
      const insights = getInsights();

      const status = {
        uptime: `${Math.floor((Date.now() - startTime) / MS_PER_SECOND)}s`,
        registeredServers: Object.keys(currentRegistry.servers).length,
        activeConnections: activeConnections.length,
        activeServers: activeConnections.map(connection => ({
          name: connection.name,
          tools: connection.tools,
          idleFor: `${Math.floor(connection.idleMs / MS_PER_SECOND)}s`,
        })),
        cache: {
          cachedServers: cacheStats.servers,
          cachedTools: cacheStats.totalTools,
        },
        memory: {
          rss: `${Math.round(memoryUsage.rss / BYTES_PER_MB)}MB`,
          heap: `${Math.round(memoryUsage.heapUsed / BYTES_PER_MB)}MB`,
        },
        metrics: {
          trackingSince: quickStats.upSince,
          totalCalls: quickStats.totalCalls,
          contextReductionPct: `${quickStats.contextReductionPct}%`,
          estimatedTokensSaved: quickStats.estimatedTokensSaved,
          topServer: quickStats.topServer,
          insights,
        },
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(status, null, 2) }],
      };
    }
  );

  return server;
}
