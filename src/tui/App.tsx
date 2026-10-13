/**
 * TUI Root — renders the Ink application.
 * State-aware: detects if registry exists and routes between views.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { render, useApp, useInput } from 'ink';
import { Dashboard } from './views/Dashboard.js';
import { Onboarding, ONBOARDING_OPTION_COUNT } from './views/Onboarding.js';
import { EditServer } from './views/EditServer.js';
import { EditPicker } from './views/EditPicker.js';
import { AuthFlow } from './views/AuthFlow.js';
import { HealthCheck } from './views/HealthCheck.js';
import { AddServer } from './views/AddServer.js';
import { Metrics } from './views/Metrics.js';
import { Help } from './views/Help.js';
import { RemoveServer } from './views/RemoveServer.js';
import { useRegistry } from './hooks/useRegistry.js';
import { useMetrics } from './hooks/useMetrics.js';
import { usePool } from './hooks/usePool.js';
import { getMenuItemCount } from './components/ActionMenu.js';
import { setServerKeywords, removeServer } from '../registry.js';
import type { RemoveServerResult } from '../registry.js';
import { VERSION } from '../version.js';
import { findMcpJson, importFromMcpJson, addServerToRegistry } from './actions/import-servers.js';
import type { ImportResult } from './actions/import-servers.js';
import { runHealthChecks } from './actions/health-check.js';
import { authServer } from './actions/auth.js';
import type { TuiServerInfo } from './hooks/useRegistry.js';
import type { AuthServerState } from './views/AuthFlow.js';
import type { ServerCheckResult } from './views/HealthCheck.js';

const startTime = Date.now();

type View =
  | { name: 'dashboard' }
  | { name: 'onboarding' }
  | { name: 'edit-server'; server: TuiServerInfo }
  | { name: 'edit-picker' }
  | { name: 'auth-flow'; servers: AuthServerState[] }
  | { name: 'health-check'; results: ServerCheckResult[] }
  | { name: 'metrics' }
  | { name: 'help' }
  | { name: 'add-server' }
  | { name: 'remove-server' };

function formatUptime(now: number): string {
  const ms = now - startTime;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainMin = minutes % 60;
  return `${hours}h ${remainMin}m`;
}

function App() {
  const { exit } = useApp();
  const registry = useRegistry();
  const metrics = useMetrics();
  const pool = usePool();

  // Drive a 1s re-render so the dashboard uptime advances. This is the TUI
  // session uptime (this process's start), not gateway uptime — the gateway
  // runs as a separate process and exposes no start timestamp to the TUI.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Determine initial view based on registry state
  const initialView: View = registry.totalServers === 0 ? { name: 'onboarding' } : { name: 'dashboard' };
  const [view, setView] = useState<View>(initialView);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const menuCount = view.name === 'onboarding' ? ONBOARDING_OPTION_COUNT : getMenuItemCount(registry.needsAuthCount);

  const navigateTo = useCallback((newView: View) => {
    setView(newView);
    setSelectedIndex(0);
  }, []);

  const goBack = useCallback(() => {
    navigateTo({ name: 'dashboard' });
  }, [navigateTo]);

  // Map action menu index to action
  // Drive one server through the OAuth flow, reflecting progress into the
  // auth-flow view: waiting -> success/error. Shared by the dashboard
  // "Authorize N servers" action and the per-server retry affordance.
  const runAuth = useCallback((serverName: string) => {
    // Update the server's status to 'waiting' in the auth-flow view
    setView((prev) => {
      if (prev.name !== 'auth-flow') return prev;
      const updated = prev.servers.map((s) =>
        s.name === serverName ? { ...s, status: 'waiting' as const, error: undefined } : s,
      );
      return { name: 'auth-flow', servers: updated };
    });
    // Trigger OAuth discovery + browser flow
    authServer(serverName).then((result) => {
      setView((prev) => {
        if (prev.name !== 'auth-flow') return prev;
        const updated = prev.servers.map((s) =>
          s.name === serverName
            ? { ...s, status: result.success ? ('success' as const) : ('error' as const), error: result.error }
            : s,
        );
        return { name: 'auth-flow', servers: updated };
      });
    });
  }, []);

  const handleAuthRetry = useCallback((serverName: string) => runAuth(serverName), [runAuth]);

  const handleDashboardAction = useCallback(
    (index: number) => {
      const hasAttention = registry.needsAuthCount > 0;
      let actionIndex = index;

      // If attention section present, first item is "Authorize N servers"
      if (hasAttention) {
        if (actionIndex === 0) {
          // Authorize servers
          const authServers: AuthServerState[] = registry.servers
            .filter((s) => s.status === 'needs-auth')
            .map((s) => ({ name: s.name, status: 'pending' as const }));
          navigateTo({ name: 'auth-flow', servers: authServers });
          // Kick off the OAuth flow for each server; without this the view
          // sits on 'pending' forever and no browser ever opens.
          for (const s of authServers) {
            runAuth(s.name);
          }
          return;
        }
        actionIndex -= 1;
      }

      // Actions section (0-4)
      switch (actionIndex) {
        case 0: {
          // Test connections
          const results: ServerCheckResult[] = registry.servers.map((s) => ({
            name: s.name,
            status: 'testing' as const,
            toolCount: s.toolCount,
          }));
          navigateTo({ name: 'health-check', results });
          // Kick off real health checks
          runHealthChecks(
            registry.servers.map((s) => s.name),
            {
              onResult: (name, partial) => {
                setView((prev) => {
                  if (prev.name !== 'health-check') return prev;
                  const updated = prev.results.map((r) => (r.name === name ? { ...r, ...partial } : r));
                  return { name: 'health-check', results: updated };
                });
              },
              onComplete: () => {},
            },
          );
          break;
        }
        case 1:
          // View metrics
          navigateTo({ name: 'metrics' });
          break;
        case 2:
          // Add a server
          navigateTo({ name: 'add-server' });
          break;
        case 3: {
          // Edit server — open a picker so the user chooses which server to
          // edit (was: always registry.servers[0] regardless of selection).
          navigateTo({ name: 'edit-picker' });
          break;
        }
        case 4:
          // Remove a server
          navigateTo({ name: 'remove-server' });
          break;
      }
    },
    [registry, navigateTo, runAuth],
  );

  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleOnboardingSelect = useCallback(
    (action: 'quick-setup' | 'add-manually' | 'look-around') => {
      if (action === 'look-around') {
        navigateTo({ name: 'dashboard' });
      } else if (action === 'quick-setup') {
        const mcpPath = findMcpJson();
        if (mcpPath) {
          void importFromMcpJson(mcpPath).then(setImportResult);
        } else {
          setImportResult({ imported: [], skipped: [] });
        }
        navigateTo({ name: 'dashboard' });
      } else if (action === 'add-manually') {
        navigateTo({ name: 'add-server' });
      }
    },
    [navigateTo],
  );

  const handleSaveTags = useCallback(
    (serverName: string, tags: string[]) => {
      setServerKeywords(serverName, tags);
      goBack();
    },
    [goBack],
  );

  const handleDeleteServer = useCallback(
    // Returns the outcome so the calling view can surface not-found / write-failed
    // instead of assuming success. Navigation is the caller's responsibility.
    (serverName: string): Promise<RemoveServerResult> => {
      return removeServer(serverName);
    },
    [],
  );

  const handleAddServer = useCallback(
    (name: string, config: { transport: 'http' | 'stdio'; url?: string; command?: string; args?: string[] }) => {
      void addServerToRegistry(name, config).catch(() => {});
    },
    [],
  );

  const handleHealthRetryAll = useCallback(() => {
    const results: ServerCheckResult[] = registry.servers.map((s) => ({
      name: s.name,
      status: 'testing' as const,
      toolCount: s.toolCount,
    }));
    setView({ name: 'health-check', results });
    // Kick off real health checks
    runHealthChecks(
      registry.servers.map((s) => s.name),
      {
        onResult: (name, partial) => {
          setView((prev) => {
            if (prev.name !== 'health-check') return prev;
            const updated = prev.results.map((r) => (r.name === name ? { ...r, ...partial } : r));
            return { name: 'health-check', results: updated };
          });
        },
        onComplete: () => {},
      },
    );
  }, [registry]);

  const handleHealthAuthFailed = useCallback(() => {
    const failedNames =
      view.name === 'health-check' ? view.results.filter((r) => r.status === 'fail').map((r) => r.name) : [];
    if (failedNames.length > 0) {
      const authServers: AuthServerState[] = failedNames.map((name) => ({
        name,
        status: 'pending' as const,
      }));
      navigateTo({ name: 'auth-flow', servers: authServers });
    }
  }, [view, navigateTo]);

  useInput((input, key) => {
    // Global quit
    if (input === 'q' && view.name === 'dashboard') {
      exit();
      return;
    }

    // Help shortcut from dashboard
    if (input === '?' && view.name === 'dashboard') {
      navigateTo({ name: 'help' });
      return;
    }

    // Navigation only in dashboard and onboarding (other views handle their own input)
    if (view.name === 'dashboard' || view.name === 'onboarding') {
      if (key.upArrow) {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : menuCount - 1));
      }
      if (key.downArrow) {
        setSelectedIndex((prev) => (prev < menuCount - 1 ? prev + 1 : 0));
      }
      if (key.return) {
        if (view.name === 'dashboard') {
          handleDashboardAction(selectedIndex);
        } else {
          const options = ['quick-setup', 'add-manually', 'look-around'] as const;
          handleOnboardingSelect(options[selectedIndex]);
        }
      }
    }
  });

  switch (view.name) {
    case 'onboarding':
      return <Onboarding selectedIndex={selectedIndex} onSelect={handleOnboardingSelect} />;

    case 'edit-picker':
      return (
        <EditPicker
          servers={registry.servers}
          onBack={goBack}
          onSelect={(server) => navigateTo({ name: 'edit-server', server })}
        />
      );

    case 'edit-server':
      return (
        <EditServer
          server={view.server}
          onBack={goBack}
          onAuth={(name) => {
            navigateTo({ name: 'auth-flow', servers: [{ name, status: 'waiting' }] });
          }}
          onSaveTags={handleSaveTags}
          onDelete={handleDeleteServer}
        />
      );

    case 'auth-flow':
      return <AuthFlow servers={view.servers} onBack={goBack} onRetry={handleAuthRetry} />;

    case 'health-check':
      return (
        <HealthCheck
          results={view.results}
          onBack={goBack}
          onRetryAll={handleHealthRetryAll}
          onAuthFailed={handleHealthAuthFailed}
        />
      );

    case 'metrics':
      return <Metrics metrics={metrics} serverCount={registry.totalServers} onBack={goBack} />;

    case 'help':
      return <Help version={VERSION} onBack={goBack} />;

    case 'add-server':
      return <AddServer onBack={goBack} onAdd={handleAddServer} />;

    case 'remove-server':
      return <RemoveServer servers={registry.servers} onBack={goBack} onRemove={handleDeleteServer} />;

    case 'dashboard':
    default:
      return (
        <Dashboard
          registry={registry}
          metrics={metrics}
          version={VERSION}
          uptime={formatUptime(now)}
          selectedIndex={selectedIndex}
          pool={pool}
          importResult={importResult}
        />
      );
  }
}

export function renderTui() {
  render(<App />);
}
