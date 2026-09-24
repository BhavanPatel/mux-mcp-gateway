/**
 * Metrics view — scrollable metrics dashboard.
 * Shows activity chart, context savings, resource savings, and top servers.
 */
import React from 'react';
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
  const { columns, rows } = useLayout();
  const boxWidth = Math.min(columns - 4, 68);

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onBack();
      return;
    }
  });

  // Compute savings
  const toolsWithMux = Math.min(4, serverCount);
  const savingsPct = serverCount > 0 ? Math.round(((serverCount - toolsWithMux) / serverCount) * 100) : 0;

  // Real per-day counts for the activity chart (WS-C5): every bar is measured.
  const dailyCounts = metrics.dailyActivity;

  // Top servers for bar chart. Bound the row count to the terminal height so
  // the view never overflows a short window (WS-B3). ~14 rows are taken by the
  // fixed header/summary/daily-chart/footer; the rest is available for servers.
  const maxServerRows = Math.max(1, rows - 14);
  const topEntries = metrics.topServers.slice(0, maxServerRows).map((s) => ({
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

      {/* Resource Savings — structural only (no fabricated MB / re-auth counts) */}
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {colors.textSecondary('Processes: ')}
        {colors.textBold(`${serverCount} server${serverCount === 1 ? '' : 's'} \u2192 1 gateway`)}
        {' '.repeat(Math.max(1, boxWidth - 40))}
        {colors.brandMid(box.vertical)}
      </Text>

      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      {/* Period Breakdown */}
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {colors.textDim(
          '\u2500\u2500 Period Breakdown \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
        )}
        {' '.repeat(Math.max(1, boxWidth - 60))}
        {colors.brandMid(box.vertical)}
      </Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {colors.textSecondary('Period'.padEnd(14))}
        {colors.textSecondary('Calls'.padEnd(10))}
        {colors.textSecondary('Avg ms')}
        {' '.repeat(Math.max(1, boxWidth - 36))}
        {colors.brandMid(box.vertical)}
      </Text>
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {colors.textPrimary('Today'.padEnd(14))}
        {colors.textBold(String(metrics.callsToday).padEnd(10))}
        {colors.textPrimary(`${metrics.avgLatencyMs}ms`)}
        {' '.repeat(Math.max(1, boxWidth - 36))}
        {colors.brandMid(box.vertical)}
      </Text>
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {colors.textPrimary('Last 7d'.padEnd(14))}
        {colors.textBold(String(metrics.callsLast7d).padEnd(10))}
        {colors.textPrimary(`${metrics.avgLatencyMs}ms`)}
        {' '.repeat(Math.max(1, boxWidth - 36))}
        {colors.brandMid(box.vertical)}
      </Text>
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {colors.textPrimary('Last 14d'.padEnd(14))}
        {colors.textBold(String(metrics.totalCalls).padEnd(10))}
        {colors.textPrimary(`${metrics.avgLatencyMs}ms`)}
        {' '.repeat(Math.max(1, boxWidth - 36))}
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
        {colors.accentDim('esc back | q quit')}
        {' '.repeat(Math.max(1, boxWidth - 21))}
        {colors.brandMid(box.vertical)}
      </Text>
      <Text>{colors.brandMid(`  ${box.bottomLeft}${'─'.repeat(boxWidth)}${box.bottomRight}`)}</Text>
    </Box>
  );
}
