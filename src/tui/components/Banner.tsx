/**
 * Banner component — ASCII art logo with gradient + right-side stats.
 * Responsive: stats beside logo (full/standard), below (compact), text-only (narrow).
 */
import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { useLayout } from '../hooks/useLayout.js';
import { BANNER_LINES, colors, box } from '../styles.js';

interface BannerProps {
  version: string;
  uptime?: string;
  toolCount?: number;
  callsToday?: number;
  successRate?: number;
}

export function Banner({ version, uptime, toolCount, callsToday, successRate }: BannerProps) {
  const { layout, columns } = useLayout();

  if (layout === 'narrow') {
    return <NarrowBanner version={version} toolCount={toolCount} columns={columns} />;
  }

  const showStatsRight = layout === 'full' || layout === 'standard';
  const boxWidth = Math.min(columns - 4, 68);

  return (
    <Box flexDirection="column">
      <Text>{colors.brandMid(`  ${box.topLeft}${'─'.repeat(boxWidth)}${box.topRight}`)}</Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      {BANNER_LINES.map((line, i) => {
        const stat = showStatsRight ? getStatLine(i, { version, uptime, toolCount, callsToday, successRate }) : '';
        const padding = boxWidth - line.length - stat.length - 2;
        const padStr = padding > 0 ? ' '.repeat(padding) : ' ';
        return (
          <Text key={i}>
            {colors.brandMid(`  ${box.vertical}  `)}
            <Gradient name="cristal">{line}</Gradient>
            <Text>{padStr}</Text>
            <Text>{colors.textSecondary(stat)}</Text>
            {colors.brandMid(`${box.vertical}`)}
          </Text>
        );
      })}

      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      {!showStatsRight && (
        <Text>
          {colors.brandMid(`  ${box.vertical}  `)}
          <Text>{colors.textSecondary(`v${version} │ `)}</Text>
          {uptime && <Text>{colors.textSecondary(`▲ ${uptime} │ `)}</Text>}
          {toolCount !== undefined && <Text>{colors.textSecondary(`${toolCount} tools │ `)}</Text>}
          {callsToday !== undefined && <Text>{colors.textSecondary(`${callsToday} calls`)}</Text>}
          <Text>{' '.repeat(Math.max(0, boxWidth - 50))}</Text>
          {colors.brandMid(box.vertical)}
        </Text>
      )}

      <Text>{colors.brandMid(`  ${box.bottomLeft}${'─'.repeat(boxWidth)}${box.bottomRight}`)}</Text>
    </Box>
  );
}

function NarrowBanner({ version, toolCount, columns }: { version: string; toolCount?: number; columns: number }) {
  const w = Math.min(columns - 4, 40);
  return (
    <Box flexDirection="column">
      <Text>{colors.brandMid(`  ${box.topLeft}${'─'.repeat(w)}${box.topRight}`)}</Text>
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        <Gradient name="cristal">M U X</Gradient>
        <Text>{`  v${version}`}</Text>
        <Text>{' '.repeat(Math.max(0, w - 14 - version.length))}</Text>
        {colors.brandMid(box.vertical)}
      </Text>
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        <Text>{colors.textSecondary(`${toolCount ?? 0} tools`)}</Text>
        <Text>{' '.repeat(Math.max(0, w - 12))}</Text>
        {colors.brandMid(box.vertical)}
      </Text>
      <Text>{colors.brandMid(`  ${box.bottomLeft}${'─'.repeat(w)}${box.bottomRight}`)}</Text>
    </Box>
  );
}

function getStatLine(
  index: number,
  stats: { version: string; uptime?: string; toolCount?: number; callsToday?: number; successRate?: number },
): string {
  switch (index) {
    case 0:
      return `v${stats.version}`;
    case 1:
      return stats.uptime ? `▲ ${stats.uptime} uptime` : '';
    case 2:
      return stats.toolCount !== undefined ? `${stats.toolCount} tools loaded` : '';
    case 3:
      return stats.callsToday !== undefined ? `${stats.callsToday} calls today` : '';
    case 4:
      return stats.successRate !== undefined ? `${stats.successRate}% success` : '';
    default:
      return '';
  }
}
