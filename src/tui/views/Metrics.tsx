/**
 * Metrics view — scrollable metrics dashboard.
 * Shows activity chart, context savings, resource savings, and top servers.
 */
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useLayout } from '../hooks/useLayout.js';
import { ActivityChart } from '../components/ActivityChart.js';
import { BarChart } from '../components/BarChart.js';
import { colors, box } from '../styles.js';
import type { MetricsData } from '../hooks/useMetrics.js';

interface MetricsProps {
  metrics: MetricsData;
  serverCount: number;
  onBack: () => void;
}

export function Metrics({ metrics, serverCount, onBack }: MetricsProps) {
  const { columns } = useLayout();
  const boxWidth = Math.min(columns - 4, 68);
  const [, setScrollOffset] = useState(0);

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onBack();
      return;
    }
    if (key.upArrow) {
      setScrollOffset((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow) {
      setScrollOffset((prev) => prev + 1);
    }
  });

  // Compute savings
  const toolsWithMux = Math.min(4, serverCount);
  const savingsPct = serverCount > 0 ? Math.round(((serverCount - toolsWithMux) / serverCount) * 100) : 0;

  // Build daily counts from metrics (simplified: use callsToday for today, estimate rest)
  const dailyCounts = buildDailyCounts(metrics);

  // Top servers for bar chart
  const topEntries = metrics.topServers.map((s) => ({
    label: s.name,
    value: s.calls,
    suffix: `${s.calls} calls (${metrics.totalCalls > 0 ? Math.round((s.calls / metrics.totalCalls) * 100) : 0}%)`,
  }));

  return (
    <Box flexDirection="column">
      <Text>
        {colors.brandMid(
          `  ${box.topLeft}${'─ Metrics ─ Last 14 days '}${'─'.repeat(Math.max(0, boxWidth - 26))}${box.topRight}`,
        )}
      </Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      {/* Summary line */}
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {colors.textBold(`${metrics.totalCalls} calls`)}
        {colors.textDim(' | ')}
        {colors.textPrimary(`${metrics.avgLatencyMs}ms avg`)}
        {colors.textDim(' | ')}
        {colors.textPrimary(`${metrics.successRate}% success`)}
        {colors.textDim(' | ')}
        {colors.accent(`~${savingsPct}% context savings`)}
        {' '.repeat(Math.max(1, boxWidth - 60))}
        {colors.brandMid(box.vertical)}
      </Text>

      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      {/* Activity section */}
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {colors.textDim('── Activity ─────────────────────────────────────────────')}
        {' '.repeat(Math.max(1, boxWidth - 60))}
        {colors.brandMid(box.vertical)}
      </Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      <Box flexDirection="column">
        <ActivityChart dailyCounts={dailyCounts} />
      </Box>

      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      {/* Context Savings section */}
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {colors.textDim('── Context Savings ──────────────────────────────────────')}
        {' '.repeat(Math.max(1, boxWidth - 60))}
        {colors.brandMid(box.vertical)}
      </Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {colors.textSecondary('Without Mux  ')}
        {colors.barFill('\u2588'.repeat(Math.min(32, serverCount * 3)))}
        {'  '}
        {colors.textSecondary(`${serverCount} tools`)}
        {' '.repeat(Math.max(1, boxWidth - 55))}
        {colors.brandMid(box.vertical)}
      </Text>
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {colors.textSecondary('With Mux     ')}
        {colors.barFill('\u2588'.repeat(Math.min(32, toolsWithMux * 3)))}
        {colors.barEmpty('\u2591'.repeat(Math.max(0, Math.min(32, serverCount * 3) - toolsWithMux * 3)))}
        {'  '}
        {colors.textSecondary(`${toolsWithMux} tools`)}
        {' '.repeat(Math.max(1, boxWidth - 55))}
        {colors.brandMid(box.vertical)}
      </Text>
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {colors.accent(`             \u25BC ${savingsPct}% less context per AI message`)}
        {' '.repeat(Math.max(1, boxWidth - 52))}
        {colors.brandMid(box.vertical)}
      </Text>

      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      {/* Top Servers section */}
      {topEntries.length > 0 && (
        <>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textDim('── Top Servers ──────────────────────────────────────────')}
            {' '.repeat(Math.max(1, boxWidth - 60))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

          <BarChart entries={topEntries} maxBarWidth={20} />
        </>
      )}

      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {colors.accentDim('\u2191\u2193 scroll | esc back | q quit')}
        {' '.repeat(Math.max(1, boxWidth - 33))}
        {colors.brandMid(box.vertical)}
      </Text>
      <Text>{colors.brandMid(`  ${box.bottomLeft}${'─'.repeat(boxWidth)}${box.bottomRight}`)}</Text>
    </Box>
  );
}

/**
 * Build approximate daily counts from metrics data.
 * In a real implementation this would aggregate from raw events.
 */
function buildDailyCounts(metrics: MetricsData): number[] {
  const days = 14;
  const counts: number[] = [];
  const avgPerDay = metrics.totalCalls > 0 ? Math.round(metrics.totalCalls / days) : 0;

  for (let i = 0; i < days - 1; i++) {
    // Simulate variation around average
    const variation = Math.round((Math.random() - 0.3) * avgPerDay * 0.6);
    counts.push(Math.max(0, avgPerDay + variation));
  }
  // Last day is today's actual count
  counts.push(metrics.callsToday);
  return counts;
}
