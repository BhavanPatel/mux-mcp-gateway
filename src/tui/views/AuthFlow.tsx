/**
 * AuthFlow view — OAuth progress UI with spinner and status.
 * Shows per-server auth progress when authorizing one or multiple servers.
 */
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useLayout } from '../hooks/useLayout.js';
import { colors, symbols, box } from '../styles.js';

export type AuthStatus = 'pending' | 'waiting' | 'success' | 'error';

export interface AuthServerState {
  name: string;
  status: AuthStatus;
  error?: string;
}

interface AuthFlowProps {
  servers: AuthServerState[];
  onBack: () => void;
  onRetry: (serverName: string) => void;
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function AuthFlow({ servers, onBack, onRetry }: AuthFlowProps) {
  const { columns } = useLayout();
  const boxWidth = Math.min(columns - 4, 68);
  const [spinnerIdx, setSpinnerIdx] = useState(0);

  const hasActive = servers.some((s) => s.status === 'pending' || s.status === 'waiting');
  const successCount = servers.filter((s) => s.status === 'success').length;
  const errorCount = servers.filter((s) => s.status === 'error').length;

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
    if (input === 'r') {
      const failed = servers.find((s) => s.status === 'error');
      if (failed) onRetry(failed.name);
    }
  });

  const title = servers.length === 1 ? `Authorize: ${servers[0].name}` : `Authorize ${servers.length} servers`;

  return (
    <Box flexDirection="column">
      <Text>
        {colors.brandMid(
          `  ${box.topLeft}${'─ '}${title}${' '}${'─'.repeat(Math.max(0, boxWidth - title.length - 4))}${box.topRight}`,
        )}
      </Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      {hasActive && (
        <Text>
          {colors.brandMid(`  ${box.vertical}  `)}
          {colors.textPrimary('Opening browser for OAuth authorization...')}
          {' '.repeat(Math.max(1, boxWidth - 46))}
          {colors.brandMid(box.vertical)}
        </Text>
      )}

      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      {servers.map((server) => {
        const statusIcon = getStatusIcon(server.status, spinnerIdx);
        const statusText = getStatusText(server);
        const nameWidth = Math.min(server.name.length, 20);
        const paddedName = server.name.padEnd(nameWidth);

        return (
          <Text key={server.name}>
            {colors.brandMid(`  ${box.vertical}  `)}
            {statusIcon}
            {' '}
            {server.status === 'success' ? colors.success(paddedName) : server.status === 'error' ? colors.error(paddedName) : colors.textPrimary(paddedName)}
            {' '}
            {colors.textDim('·'.repeat(Math.max(2, 24 - nameWidth)))}
            {' '}
            {statusText}
            {' '.repeat(Math.max(1, boxWidth - nameWidth - statusTextLen(server) - 34 + 20))}
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
        {successCount > 0 && colors.success(`${successCount} authorized`)}
        {successCount > 0 && errorCount > 0 && colors.textDim(' | ')}
        {errorCount > 0 && colors.error(`${errorCount} failed`)}
        {hasActive && colors.textSecondary(`${SPINNER_FRAMES[spinnerIdx]} waiting...`)}
        {!hasActive && successCount === 0 && errorCount === 0 && colors.textSecondary('Ready')}
        {' '.repeat(Math.max(1, boxWidth - summaryLen(successCount, errorCount, hasActive) - 4))}
        {colors.brandMid(box.vertical)}
      </Text>

      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {errorCount > 0
          ? colors.accentDim('[r] retry failed │ [esc] back')
          : colors.accentDim('[esc] back')}
        {' '.repeat(Math.max(1, boxWidth - (errorCount > 0 ? 33 : 14)))}
        {colors.brandMid(box.vertical)}
      </Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
      <Text>{colors.brandMid(`  ${box.bottomLeft}${'─'.repeat(boxWidth)}${box.bottomRight}`)}</Text>
    </Box>
  );
}

function getStatusIcon(status: AuthStatus, spinnerIdx: number): string {
  switch (status) {
    case 'success':
      return colors.success(symbols.success);
    case 'error':
      return colors.error(symbols.error);
    case 'waiting':
      return colors.warning(SPINNER_FRAMES[spinnerIdx]);
    case 'pending':
      return colors.textDim(symbols.pending);
  }
}

function getStatusText(server: AuthServerState): string {
  switch (server.status) {
    case 'success':
      return colors.success('Authorized');
    case 'error':
      return colors.error(server.error || 'Failed');
    case 'waiting':
      return colors.warning('Waiting for browser...');
    case 'pending':
      return colors.textSecondary('Pending');
  }
}

function statusTextLen(server: AuthServerState): number {
  switch (server.status) {
    case 'success':
      return 10;
    case 'error':
      return (server.error || 'Failed').length;
    case 'waiting':
      return 22;
    case 'pending':
      return 7;
  }
}

function summaryLen(successCount: number, errorCount: number, hasActive: boolean): number {
  let len = 0;
  if (successCount > 0) len += `${successCount} authorized`.length;
  if (successCount > 0 && errorCount > 0) len += 3;
  if (errorCount > 0) len += `${errorCount} failed`.length;
  if (hasActive) len += 12;
  if (!hasActive && successCount === 0 && errorCount === 0) len += 5;
  return len;
}
