/**
 * Help view — CLI command reference.
 * Shows all available commands with descriptions.
 */
import React from 'react';
import { Box, Text, useInput } from 'ink';
import { useLayout } from '../hooks/useLayout.js';
import { colors, box } from '../styles.js';

interface HelpProps {
  version: string;
  onBack: () => void;
}

const COMMANDS = [
  { cmd: 'mux', desc: 'Launch this dashboard (TTY); headless gateway otherwise' },
  { cmd: 'mux serve', desc: 'Run the MCP gateway on stdio' },
  { cmd: 'mux add <name>', desc: 'Add a server (--transport http|stdio)' },
  { cmd: 'mux remove <name>', desc: 'Remove a server from the registry' },
  { cmd: 'mux edit <name>', desc: 'Edit discovery keywords for a server' },
  { cmd: 'mux auth <name>', desc: 'Authorize a server via OAuth' },
  { cmd: 'mux health [name]', desc: 'Check server reachability' },
  { cmd: 'mux metrics', desc: 'Show usage metrics' },
  { cmd: 'mux doctor', desc: 'Diagnose the installation' },
  { cmd: 'mux logs [-f]', desc: 'Show or follow recent log lines' },
  { cmd: 'mux report-bug', desc: 'Gather a redacted diagnostic bundle' },
  { cmd: 'mux update', desc: 'Check for a newer version' },
  { cmd: 'mux uninstall', desc: 'Remove Mux data (~/.mux)' },
];

const SHORTCUTS = [
  { key: '\u2191\u2193', desc: 'Navigate menu items' },
  { key: 'enter', desc: 'Select / confirm' },
  { key: 'esc', desc: 'Go back to previous view' },
  { key: 'q', desc: 'Quit (from dashboard)' },
  { key: '?', desc: 'Show this help' },
];

export function Help({ version, onBack }: HelpProps) {
  const { columns } = useLayout();
  const boxWidth = Math.min(columns - 4, 68);

  useInput((input, key) => {
    if (key.escape || input === 'q' || input === '?') {
      onBack();
    }
  });

  return (
    <Box flexDirection="column">
      <Text>
        {colors.brandMid(
          `  ${box.topLeft}${'─ Help ─ Mux CLI v'}${version}${' '}${'─'.repeat(Math.max(0, boxWidth - 21 - version.length))}${box.topRight}`,
        )}
      </Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {colors.textDim('── Commands ─────────────────────────────────────────────')}
        {' '.repeat(Math.max(1, boxWidth - 60))}
        {colors.brandMid(box.vertical)}
      </Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      {COMMANDS.map((c) => (
        <Text key={c.cmd}>
          {colors.brandMid(`  ${box.vertical}  `)}
          {colors.accent(c.cmd.padEnd(28))}
          {colors.textSecondary(c.desc)}
          {' '.repeat(Math.max(1, boxWidth - 28 - c.desc.length - 4))}
          {colors.brandMid(box.vertical)}
        </Text>
      ))}

      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {colors.textDim('── Keyboard Shortcuts ───────────────────────────────────')}
        {' '.repeat(Math.max(1, boxWidth - 60))}
        {colors.brandMid(box.vertical)}
      </Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      {SHORTCUTS.map((s) => (
        <Text key={s.key}>
          {colors.brandMid(`  ${box.vertical}  `)}
          {colors.textBold(s.key.padEnd(10))}
          {colors.textSecondary(s.desc)}
          {' '.repeat(Math.max(1, boxWidth - 10 - s.desc.length - 4))}
          {colors.brandMid(box.vertical)}
        </Text>
      ))}

      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {colors.accentDim('esc back | q quit')}
        {' '.repeat(Math.max(1, boxWidth - 21))}
        {colors.brandMid(box.vertical)}
      </Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
      <Text>{colors.brandMid(`  ${box.bottomLeft}${'─'.repeat(boxWidth)}${box.bottomRight}`)}</Text>
    </Box>
  );
}
