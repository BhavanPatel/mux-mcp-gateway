/**
 * BarChart — animated horizontal bar chart component.
 * Renders labeled bars with fill proportional to value/max.
 */
import React from 'react';
import { Box, Text } from 'ink';
import { useLayout } from '../hooks/useLayout.js';
import { useBarFillAnimation } from '../hooks/useAnimations.js';
import { colors } from '../styles.js';

export interface BarEntry {
  label: string;
  value: number;
  suffix?: string;
}

interface BarChartProps {
  entries: BarEntry[];
  maxBarWidth?: number;
}

export function BarChart({ entries, maxBarWidth }: BarChartProps) {
  const { columns } = useLayout();
  const barWidth = maxBarWidth ?? Math.min(columns - 40, 24);
  const maxValue = Math.max(...entries.map((e) => e.value), 1);
  const maxLabelLen = Math.max(...entries.map((e) => e.label.length), 1);
  const fills = useBarFillAnimation(entries.length);

  return (
    <Box flexDirection="column">
      {entries.map((entry, idx) => {
        const targetFillLen = Math.round((entry.value / maxValue) * barWidth);
        const animatedFillLen = Math.round(targetFillLen * (fills[idx] ?? 0));
        const emptyLen = barWidth - animatedFillLen;
        const bar = colors.barFill('\u2588'.repeat(animatedFillLen)) + colors.barEmpty('\u2591'.repeat(emptyLen));
        const suffix = entry.suffix ?? `${entry.value}`;

        return (
          <Text key={entry.label}>
            {'  '}
            {colors.textPrimary(entry.label.padEnd(maxLabelLen + 2))}
            {bar}
            {'  '}
            {colors.textSecondary(suffix)}
          </Text>
        );
      })}
    </Box>
  );
}
