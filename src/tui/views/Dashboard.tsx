/**
 * Dashboard view — the main returning-user screen.
 * Composes Banner + ServerList + ActionMenu with real data.
 */
import React from 'react';
import { Box } from 'ink';
import { Banner } from '../components/Banner.js';
import { ServerList } from '../components/ServerList.js';
import { ActionMenu } from '../components/ActionMenu.js';
import type { RegistryData } from '../hooks/useRegistry.js';
import type { MetricsData } from '../hooks/useMetrics.js';
import type { PoolStatus } from '../hooks/usePool.js';

interface DashboardProps {
  registry: RegistryData;
  metrics: MetricsData;
  version: string;
  uptime: string;
  selectedIndex: number;
  pool: PoolStatus;
}

export function Dashboard({ registry, metrics, version, uptime, selectedIndex, pool }: DashboardProps) {
  const totalTools = registry.servers.reduce((sum, s) => sum + (s.toolCount || 0), 0);
  const needsAuthServers = registry.servers.filter((s) => s.status === 'needs-auth').map((s) => s.name);

  // Override server status from live pool state
  const serversWithPool = registry.servers.map((s) => {
    if (pool.activeConnections.includes(s.name)) {
      return { ...s, status: 'connected' as const };
    }
    if (pool.connecting.includes(s.name)) {
      return { ...s, status: 'connecting' as const };
    }
    return s;
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Banner
        version={version}
        uptime={uptime}
        toolCount={totalTools}
        callsToday={metrics.callsToday}
        successRate={metrics.successRate}
      />

      <ServerList
        servers={serversWithPool}
        connectedCount={serversWithPool.filter((s) => s.status === 'connected').length}
        totalServers={registry.totalServers}
        callsPerServer={metrics.callsPerServer}
      />

      <ActionMenu
        needsAuthCount={registry.needsAuthCount}
        needsAuthServers={needsAuthServers}
        callsToday={metrics.callsToday}
        savingsPct={89}
        version={version}
        selectedIndex={selectedIndex}
      />
    </Box>
  );
}
