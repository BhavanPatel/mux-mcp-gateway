/**
 * TUI Root — renders the Ink application.
 * State-aware: detects if registry exists and routes between views.
 */
import React, { useState, useCallback } from 'react';
import { render, useApp, useInput } from 'ink';
import { Dashboard } from './views/Dashboard.js';
import { Onboarding, ONBOARDING_OPTION_COUNT } from './views/Onboarding.js';
import { EditServer } from './views/EditServer.js';
import { AuthFlow } from './views/AuthFlow.js';
import { HealthCheck } from './views/HealthCheck.js';
import { Metrics } from './views/Metrics.js';
import { Help } from './views/Help.js';
import { useRegistry } from './hooks/useRegistry.js';
import { useMetrics } from './hooks/useMetrics.js';
import { getMenuItemCount } from './components/ActionMenu.js';
import { setServerKeywords, removeServer } from '../registry.js';
import type { TuiServerInfo } from './hooks/useRegistry.js';
import type { AuthServerState } from './views/AuthFlow.js';
import type { ServerCheckResult } from './views/HealthCheck.js';

const VERSION = '1.4.2';
const startTime = Date.now();

type View =
  | { name: 'dashboard' }
  | { name: 'onboarding' }
  | { name: 'edit-server'; server: TuiServerInfo }
  | { name: 'auth-flow'; servers: AuthServerState[] }
  | { name: 'health-check'; results: ServerCheckResult[] }
  | { name: 'metrics' }
  | { name: 'help' };

function formatUptime(): string {
  const ms = Date.now() - startTime;
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

  // Determine initial view based on registry state
  const initialView: View = registry.totalServers === 0 ? { name: 'onboarding' } : { name: 'dashboard' };
  const [view, setView] = useState<View>(initialView);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const menuCount =
    view.name === 'onboarding' ? ONBOARDING_OPTION_COUNT : getMenuItemCount(registry.needsAuthCount);

  const navigateTo = useCallback((newView: View) => {
    setView(newView);
    setSelectedIndex(0);
  }, []);

  const goBack = useCallback(() => {
    navigateTo({ name: 'dashboard' });
  }, [navigateTo]);

  // Map action menu index to action
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
          break;
        }
        case 1:
          // View metrics
          navigateTo({ name: 'metrics' });
          break;
        case 2:
          // Add a server — for now stay on dashboard (could trigger onboarding add flow)
          break;
        case 3: {
          // Edit server — pick first connected server as default
          const target = registry.servers[0];
          if (target) navigateTo({ name: 'edit-server', server: target });
          break;
        }
        case 4:
          // Remove a server — for now stay on dashboard
          break;
        case 5:
          // Update (System)
          break;
        case 6:
          // Uninstall (System)
          break;
      }
    },
    [registry, navigateTo],
  );

  const handleOnboardingSelect = useCallback(
    (action: 'quick-setup' | 'add-manually' | 'look-around') => {
      if (action === 'look-around') {
        navigateTo({ name: 'dashboard' });
      }
      // quick-setup and add-manually will be wired to actual logic later
    },
    [navigateTo],
  );

  const handleSaveTags = useCallback((serverName: string, tags: string[]) => {
    setServerKeywords(serverName, tags);
    goBack();
  }, [goBack]);

  const handleDeleteServer = useCallback((serverName: string) => {
    removeServer(serverName);
    goBack();
  }, [goBack]);

  const handleAuthRetry = useCallback((_serverName: string) => {
    // TODO: re-trigger OAuth for the given server
  }, []);

  const handleHealthRetryAll = useCallback(() => {
    if (view.name !== 'health-check') return;
    const results: ServerCheckResult[] = registry.servers.map((s) => ({
      name: s.name,
      status: 'testing' as const,
      toolCount: s.toolCount,
    }));
    setView({ name: 'health-check', results });
  }, [view, registry]);

  const handleHealthAuthFailed = useCallback(() => {
    const failedNames = view.name === 'health-check'
      ? view.results.filter((r) => r.status === 'fail').map((r) => r.name)
      : [];
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
      return (
        <Onboarding
          selectedIndex={selectedIndex}
          onSelect={handleOnboardingSelect}
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
      return (
        <AuthFlow
          servers={view.servers}
          onBack={goBack}
          onRetry={handleAuthRetry}
        />
      );

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
      return (
        <Metrics
          metrics={metrics}
          serverCount={registry.totalServers}
          onBack={goBack}
        />
      );

    case 'help':
      return (
        <Help
          version={VERSION}
          onBack={goBack}
        />
      );

    case 'dashboard':
    default:
      return (
        <Dashboard
          registry={registry}
          metrics={metrics}
          version={VERSION}
          uptime={formatUptime()}
          selectedIndex={selectedIndex}
        />
      );
  }
}

export function renderTui() {
  render(<App />);
}
