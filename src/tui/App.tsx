/**
 * TUI Root — renders the Ink application.
 * State-aware: detects if registry exists and routes accordingly.
 */
import React, { useState } from 'react';
import { render, useApp, useInput } from 'ink';
import { Dashboard } from './views/Dashboard.js';
import { useRegistry } from './hooks/useRegistry.js';
import { useMetrics } from './hooks/useMetrics.js';
import { getMenuItemCount } from './components/ActionMenu.js';

const VERSION = '1.4.2';
const startTime = Date.now();

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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuCount = getMenuItemCount(registry.needsAuthCount);

  useInput((input, key) => {
    if (input === 'q') {
      exit();
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : menuCount - 1));
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => (prev < menuCount - 1 ? prev + 1 : 0));
    }
  });

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

export function renderTui() {
  render(<App />);
}
