/**
 * Hook to read connection pool status for the TUI.
 * Checks which servers have active connections via the pool state file.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

export interface PoolStatus {
  /** Server names with active connections */
  activeConnections: string[];
  /** Server names currently connecting */
  connecting: string[];
  /** Total active connection count */
  activeCount: number;
}

const POOL_STATE_PATH = resolve(homedir(), '.mux', 'pool-state.json');

export function usePool(): PoolStatus {
  const empty: PoolStatus = {
    activeConnections: [],
    connecting: [],
    activeCount: 0,
  };

  try {
    if (!existsSync(POOL_STATE_PATH)) return empty;

    const raw = JSON.parse(readFileSync(POOL_STATE_PATH, 'utf-8'));
    const connections: Array<{ name: string; state: string }> = raw.connections || [];

    const active = connections.filter((c) => c.state === 'active').map((c) => c.name);
    const connecting = connections.filter((c) => c.state === 'connecting').map((c) => c.name);

    return {
      activeConnections: active,
      connecting,
      activeCount: active.length,
    };
  } catch {
    return empty;
  }
}
