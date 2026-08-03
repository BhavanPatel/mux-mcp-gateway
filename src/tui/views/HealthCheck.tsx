/**
 * HealthCheck view — per-server connection test with live-updating results.
 * Shows spinner while testing, then ✓/✗ per server with latency or error.
 */
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useLayout } from '../hooks/useLayout.js';
import { colors, symbols, box } from '../styles.js';

export type CheckStatus = 'pending' | 'testing' | 'pass' | 'fail';

export interface ServerCheckResult {
  name: string;
  status: CheckStatus;
  toolCount?: number;
  latencyMs?: number;
  error?: string;
}

interface HealthCheckProps {
  results: ServerCheckResult[];
  onBack: () => void;
  onRetryAll: () => void;
  onAuthFailed: () => void;
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function HealthCheck({ results, onBack, onRetryAll, onAuthFailed }: HealthCheckProps) {
  const { layout, columns } = useLayout();
  const boxWidth = Math.min(columns - 4, 68);
  const [spinnerIdx, setSpinnerIdx] = useState(0);
  const showDesc = layout === 'full' || layout === 'standard';

  const hasActive = results.some((r) => r.status === 'pending' || r.status === 'testing');
  const passCount = results.filter((r) => r.status === 'pass').length;
  const failCount = results.filter((r) => r.status === 'fail').length;
  const testingCount = results.filter((r) => r.status === 'testing' || r.status === 'pending').length;

  useEffect(() => {
    if (!hasActive) return;
    const timer = setInterval(() => {
      setSpinnerIdx((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, [hasActive]);

  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    if (input === 'q') {
      onBack();
      return;
    }
    if (input === 'r') {
      onRetryAll();
      return;
    }
    if (input === 'a' && failCount > 0) {
      onAuthFailed();
    }
  });

  return (
    <Box flexDirection="column">
      <Text>
        {colors.brandMid(
          `  ${box.topLeft}${'─ Test Connections '}${'─'.repeat(Math.max(0, boxWidth - 20))}${box.topRight}`,
        )}
      </Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {colors.textPrimary(`Testing ${results.length} servers...`)}
        {' '.repeat(Math.max(1, boxWidth - `Testing ${results.length} servers...`.length - 4))}
        {colors.brandMid(box.vertical)}
      </Text>

      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      {results.map((result) => {
        const icon = getCheckIcon(result.status, spinnerIdx);
        const detail = getCheckDetail(result, showDesc);
        const nameLen = Math.min(result.name.length, 18);
        const paddedName = result.name.length > 18 ? result.name.slice(0, 15) + '...' : result.name;
        const dots = colors.textDim('·'.repeat(Math.max(2, 20 - nameLen)));

        return (
          <Text key={result.name}>
            {colors.brandMid(`  ${box.vertical}  `)}
            {icon}{' '}
            {result.status === 'pass'
              ? colors.textPrimary(paddedName)
              : result.status === 'fail'
                ? colors.error(paddedName)
                : colors.textPrimary(paddedName)}{' '}
            {dots} {detail}
            {' '.repeat(Math.max(1, boxWidth - nameLen - detailLen(result, showDesc) - 30 + 16))}
            {colors.brandMid(box.vertical)}
          </Text>
        );
      })}

      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {colors.textDim('─'.repeat(boxWidth - 4))}
        {colors.brandMid(`  ${box.vertical}`)}
      </Text>

      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {passCount > 0 && colors.success(`${passCount} passed`)}
        {passCount > 0 && (failCount > 0 || testingCount > 0) && colors.textDim(' | ')}
        {failCount > 0 && colors.error(`${failCount} failed`)}
        {failCount > 0 && testingCount > 0 && colors.textDim(' | ')}
        {testingCount > 0 && colors.textSecondary(`${testingCount} in progress`)}
        {' '.repeat(Math.max(1, boxWidth - summaryLen(passCount, failCount, testingCount) - 4))}
        {colors.brandMid(box.vertical)}
      </Text>

      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {failCount > 0
          ? colors.accentDim('[a] authorize failed │ [r] retry all │ [esc] back')
          : colors.accentDim('[r] retry all │ [esc] back')}
        {' '.repeat(Math.max(1, boxWidth - (failCount > 0 ? 52 : 29)))}
        {colors.brandMid(box.vertical)}
      </Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
      <Text>{colors.brandMid(`  ${box.bottomLeft}${'─'.repeat(boxWidth)}${box.bottomRight}`)}</Text>
    </Box>
  );
}

function getCheckIcon(status: CheckStatus, spinnerIdx: number): string {
  switch (status) {
    case 'pass':
      return colors.success(symbols.success);
    case 'fail':
      return colors.error(symbols.error);
    case 'testing':
      return colors.warning(SPINNER_FRAMES[spinnerIdx]);
    case 'pending':
      return colors.textDim(symbols.pending);
  }
}

function getCheckDetail(result: ServerCheckResult, showDesc: boolean): string {
  switch (result.status) {
    case 'pass':
      if (showDesc && result.toolCount && result.latencyMs) {
        return colors.success(`${result.toolCount} tools`) + colors.textDim(`   ${result.latencyMs}ms`);
      }
      return colors.success(`${result.toolCount || '?'} tools`);
    case 'fail':
      return colors.error(result.error || 'Connection failed');
    case 'testing':
      return colors.textSecondary('connecting...');
    case 'pending':
      return colors.textDim('waiting...');
  }
}

function detailLen(result: ServerCheckResult, showDesc: boolean): number {
  switch (result.status) {
    case 'pass':
      if (showDesc && result.toolCount && result.latencyMs) {
        return `${result.toolCount} tools`.length + `   ${result.latencyMs}ms`.length;
      }
      return `${result.toolCount || '?'} tools`.length;
    case 'fail':
      return (result.error || 'Connection failed').length;
    case 'testing':
      return 13;
    case 'pending':
      return 10;
  }
}

function summaryLen(passCount: number, failCount: number, testingCount: number): number {
  let len = 0;
  if (passCount > 0) len += `${passCount} passed`.length;
  if (passCount > 0 && (failCount > 0 || testingCount > 0)) len += 3;
  if (failCount > 0) len += `${failCount} failed`.length;
  if (failCount > 0 && testingCount > 0) len += 3;
  if (testingCount > 0) len += `${testingCount} in progress`.length;
  return len;
}
