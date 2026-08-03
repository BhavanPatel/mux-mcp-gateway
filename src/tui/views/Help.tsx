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
  { cmd: 'mux-cli', desc: 'Interactive menu (dashboard or onboarding)' },
  { cmd: 'mux-cli setup', desc: 'Import servers from existing mcp.json' },
  { cmd: 'mux-cli add <name>', desc: 'Add a server (interactive or one-liner)' },
  { cmd: 'mux-cli remove <name>', desc: 'Remove a server from registry' },
  { cmd: 'mux-cli auth [name|--all]', desc: 'Trigger OAuth for HTTP server(s)' },
  { cmd: 'mux-cli health', desc: 'Health check all servers' },
  { cmd: 'mux-cli list', desc: 'Show registered servers + auth status' },
  { cmd: 'mux-cli status', desc: 'Show Mux process info' },
  { cmd: 'mux-cli metrics', desc: 'Usage stats and context savings' },
  { cmd: 'mux-cli keywords [name]', desc: 'View/edit discovery tags for a server' },
  { cmd: 'mux-cli update', desc: 'Pull latest code + rebuild' },
  { cmd: 'mux-cli uninstall', desc: 'Remove Mux completely' },
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
