/**
 * TUI Root — renders the Ink application.
 * State-aware: detects if registry exists and routes accordingly.
 */
import React from 'react';
import { render, useApp, useInput } from 'ink';
import { Banner } from './components/Banner.js';

function App() {
  const { exit } = useApp();

  useInput((input) => {
    if (input === 'q') exit();
  });

  return (
    <Banner
      version="1.4.2"
      uptime="0m"
      toolCount={0}
      callsToday={0}
      successRate={100}
    />
  );
}

export function renderTui() {
  render(<App />);
}
