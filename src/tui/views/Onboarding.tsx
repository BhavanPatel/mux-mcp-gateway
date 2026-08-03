/**
 * Onboarding view — first-time user experience.
 * Shows welcome message + 3 options: Quick Setup, Add Manually, Just Look Around.
 */
import React from 'react';
import { Box, Text } from 'ink';
import { Banner } from '../components/Banner.js';
import { useLayout } from '../hooks/useLayout.js';
import { useStaggerIn } from '../hooks/useAnimations.js';
import { colors, symbols, box } from '../styles.js';

interface OnboardingProps {
  selectedIndex: number;
  onSelect: (action: 'quick-setup' | 'add-manually' | 'look-around') => void;
}

const OPTIONS = [
  {
    id: 'quick-setup' as const,
    label: 'Quick Setup',
    desc: 'Import servers from your existing mcp.json',
  },
  {
    id: 'add-manually' as const,
    label: 'Add Manually',
    desc: 'Configure servers one by one',
  },
  {
    id: 'look-around' as const,
    label: 'Just Look Around',
    desc: 'Show me what Mux can do',
  },
];

export function Onboarding({ selectedIndex, onSelect: _onSelect }: OnboardingProps) {
  const { layout, columns } = useLayout();
  const boxWidth = Math.min(columns - 4, 68);
  const showDesc = layout !== 'narrow';
  const visibleCount = useStaggerIn(OPTIONS.length);

  return (
    <Box flexDirection="column" gap={1}>
      <Banner version="" uptime="" toolCount={0} callsToday={0} successRate={0} />

      <Text>
        {'  '}
        {colors.textBold('MCP Gateway Router')}
      </Text>
      <Text>
        {'  '}
        {colors.textSecondary('One MCP to rule them all.')}
      </Text>
      <Text>{''}</Text>
      <Text>
        {'  '}
        {colors.textPrimary('Welcome! Mux connects your AI clients to all your MCP servers')}
      </Text>
      <Text>
        {'  '}
        {colors.textPrimary('through a single always-on gateway.')}
      </Text>

      <Box flexDirection="column">
        <Text>
          {colors.brandMid(
            `  ${box.topLeft}${' How would you like to start? '}${'─'.repeat(Math.max(0, boxWidth - 31))}${box.topRight}`,
          )}
        </Text>
        <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

        {OPTIONS.slice(0, visibleCount).map((opt, i) => (
          <Box key={opt.id} flexDirection="column">
            <Text>
              {colors.brandMid(`  ${box.vertical}  `)}
              {i === selectedIndex ? colors.accent(symbols.selected) : ' '}{' '}
              {i === selectedIndex ? colors.textBold(opt.label) : colors.textPrimary(opt.label)}
              {' '.repeat(Math.max(1, boxWidth - opt.label.length - 6))}
              {colors.brandMid(box.vertical)}
            </Text>
            {showDesc && (
              <Text>
                {colors.brandMid(`  ${box.vertical}    `)}
                {colors.textSecondary(opt.desc)}
                {' '.repeat(Math.max(1, boxWidth - opt.desc.length - 6))}
                {colors.brandMid(box.vertical)}
              </Text>
            )}
            {i < OPTIONS.length - 1 && (
              <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
            )}
          </Box>
        ))}

        <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
        <Text>
          {colors.brandMid(`  ${box.vertical}  `)}
          {colors.accentDim('↑↓ navigate │ enter select')}
          {' '.repeat(Math.max(1, boxWidth - 31))}
          {colors.brandMid(box.vertical)}
        </Text>
        <Text>{colors.brandMid(`  ${box.bottomLeft}${'─'.repeat(boxWidth)}${box.bottomRight}`)}</Text>
      </Box>
    </Box>
  );
}

export const ONBOARDING_OPTION_COUNT = OPTIONS.length;
