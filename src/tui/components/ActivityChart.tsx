/**
 * ActivityChart — 14-day activity heatmap using block characters.
 * Renders a vertical bar chart showing daily call counts.
 */
import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../styles.js';

interface ActivityChartProps {
  /** Daily call counts, most recent last. Up to 14 entries. */
  dailyCounts: number[];
}

const MAX_HEIGHT = 3;

export function ActivityChart({ dailyCounts }: ActivityChartProps) {
  const data = dailyCounts.slice(-14);
  const maxVal = Math.max(...data, 1);
  const peak = Math.max(...data);
  const avg = data.length > 0 ? Math.round(data.reduce((a, b) => a + b, 0) / data.length) : 0;

  // Build rows from top to bottom
  const rows: string[][] = [];
  for (let row = MAX_HEIGHT; row >= 1; row--) {
    const threshold = (row / MAX_HEIGHT) * maxVal;
    const cells = data.map((val) => {
      if (val >= threshold) return '\u2593\u2593';
      if (val >= threshold * 0.5) return '\u2591\u2591';
      return '  ';
    });
    rows.push(cells);
  }

  // Day labels (just day-of-month)
  const today = new Date();
  const labels = data.map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (data.length - 1 - i));
    return String(d.getDate()).padStart(2, ' ');
  });

  return (
    <Box flexDirection="column">
      {rows.map((cells, rowIdx) => (
        <Text key={rowIdx}>
          {'  '}
          {cells
            .map((cell, colIdx) => {
              const val = data[colIdx];
              const threshold = ((MAX_HEIGHT - rowIdx) / MAX_HEIGHT) * maxVal;
              if (val >= threshold) return colors.chartActive(cell);
              if (val >= threshold * 0.5) return colors.chartLow(cell);
              return cell;
            })
            .join(' ')}
        </Text>
      ))}
      <Text>
        {'  '}
        {labels.map((l) => colors.textDim(l)).join(' ')}
      </Text>
      <Text>
        {'  '}
        {colors.textSecondary(`Peak: ${peak}/day   Avg: ${avg}/day`)}
      </Text>
    </Box>
  );
}
