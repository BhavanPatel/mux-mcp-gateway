/**
 * ServerList — displays server rows with status dots, tool count, and usage bars.
 * Responsive: hides bars and latency at smaller widths.
 */
import React from 'react';
import { Box, Text } from 'ink';
import { useLayout } from '../hooks/useLayout.js';
import { usePulse, useSpinner } from '../hooks/useAnimations.js';
import { colors, symbols, box } from '../styles.js';
import type { TuiServerInfo } from '../hooks/useRegistry.js';

interface ServerListProps {
  servers: TuiServerInfo[];
  connectedCount: number;
  totalServers: number;
  callsPerServer: Record<string, number>;
  latencyPerServer?: Record<string, number>;
}

export function ServerList({
  servers,
  connectedCount,
  totalServers,
  callsPerServer,
  latencyPerServer,
}: ServerListProps) {
  const { layout, columns } = useLayout();
  const boxWidth = Math.min(columns - 4, 68);
  const showBars = layout === 'full' || layout === 'standard';
  const title = `Servers (${connectedCount}/${totalServers} connected)`;
  const maxCalls = Math.max(...Object.values(callsPerServer), 1);
  const hasConnected = servers.some((s) => s.status === 'connected');
  const hasConnecting = servers.some((s) => s.status === 'connecting');
  const pulseBright = usePulse(hasConnected);
  const spinnerFrame = useSpinner(hasConnecting);

  return (
    <Box flexDirection="column">
      <Text>
        {colors.brandMid(
          `  ${box.topLeft}${` ${title} `}${'─'.repeat(Math.max(0, boxWidth - title.length - 3))}${box.topRight}`,
        )}
      </Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      {servers.map((server) => (
        <ServerRow
          key={server.name}
          server={server}
          calls={callsPerServer[server.name] || 0}
          maxCalls={maxCalls}
          showBars={showBars}
          boxWidth={boxWidth}
          pulseBright={pulseBright}
          spinnerFrame={spinnerFrame}
          latencyMs={latencyPerServer?.[server.name]}
        />
      ))}

      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
      <Text>{colors.brandMid(`  ${box.bottomLeft}${'─'.repeat(boxWidth)}${box.bottomRight}`)}</Text>
    </Box>
  );
}

function ServerRow({
  server,
  calls,
  maxCalls,
  showBars,
  boxWidth: _boxWidth,
  pulseBright,
  spinnerFrame,
  latencyMs,
}: {
  server: TuiServerInfo;
  calls: number;
  maxCalls: number;
  showBars: boolean;
  boxWidth: number;
  pulseBright: boolean;
  spinnerFrame: string;
  latencyMs?: number;
}) {
  const dot = getStatusDot(server.status, pulseBright, spinnerFrame);
  const name = server.name.padEnd(16);
  const tools = server.toolCount ? `${String(server.toolCount).padStart(2)} tools` : '  \u2014   ';
  const latStr = latencyMs ? colors.textDim(`${String(latencyMs).padStart(4)}ms`) : '';
  const statusText = getStatusText(server.status);

  if (!showBars) {
    return (
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {dot} {colors.textPrimary(name)}
        {colors.textBold(tools)}
        {'  '}
        {statusText}
        {colors.brandMid(box.vertical)}
      </Text>
    );
  }

  const barWidth = 12;
  const filledLen = maxCalls > 0 ? Math.round((calls / maxCalls) * barWidth) : 0;
  const bar = colors.barFill('\u2588'.repeat(filledLen)) + colors.barEmpty('\u2591'.repeat(barWidth - filledLen));
  const callsStr = calls > 0 ? colors.textBold(`${String(calls).padStart(4)} calls`) : statusText;

  return (
    <Text>
      {colors.brandMid(`  ${box.vertical}  `)}
      {dot} {colors.textPrimary(name)}
      {colors.textBold(tools)}
      {latStr ? ` ${latStr}` : ''}
      {'   '}
      {bar} {callsStr}
      {'  '}
      {colors.brandMid(box.vertical)}
    </Text>
  );
}

function getStatusDot(status: TuiServerInfo['status'], pulseBright: boolean, spinnerFrame: string): string {
  switch (status) {
    case 'connected':
      return pulseBright ? colors.success(symbols.connected) : colors.accentDim(symbols.connected);
    case 'needs-auth':
      return colors.warning(symbols.disconnected);
    case 'connecting':
      return colors.accentDim(spinnerFrame);
    default:
      return colors.textSecondary(symbols.disconnected);
  }
}

function getStatusText(status: TuiServerInfo['status']): string {
  switch (status) {
    case 'needs-auth':
      return colors.warning('needs auth');
    case 'connecting':
      return colors.accentDim('connecting...');
    case 'disconnected':
      return colors.textSecondary('disconnected');
    default:
      return '';
  }
}
