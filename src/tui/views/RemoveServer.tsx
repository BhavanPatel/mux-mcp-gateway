/**
 * RemoveServer view — server picker → confirmation with impact details.
 * Two phases: select server, then confirm deletion.
 */
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useLayout } from '../hooks/useLayout.js';
import { colors, symbols, box } from '../styles.js';
import type { TuiServerInfo } from '../hooks/useRegistry.js';

type RemovePhase = 'select' | 'confirm' | 'done';

interface RemoveServerProps {
  servers: TuiServerInfo[];
  onBack: () => void;
  onRemove: (serverName: string) => void;
}

export function RemoveServer({ servers, onBack, onRemove }: RemoveServerProps) {
  const { columns } = useLayout();
  const boxWidth = Math.min(columns - 4, 68);
  const [phase, setPhase] = useState<RemovePhase>('select');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [confirmIndex, setConfirmIndex] = useState(0);
  const [removedName, setRemovedName] = useState('');

  const selectedServer = servers[selectedIndex];

  useInput((input, key) => {
    if (key.escape) {
      if (phase === 'confirm') {
        setPhase('select');
        setConfirmIndex(0);
      } else {
        onBack();
      }
      return;
    }

    if (phase === 'select') {
      if (key.upArrow) {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : servers.length - 1));
      }
      if (key.downArrow) {
        setSelectedIndex((prev) => (prev < servers.length - 1 ? prev + 1 : 0));
      }
      if (key.return && servers.length > 0) {
        setPhase('confirm');
        setConfirmIndex(0);
      }
    }

    if (phase === 'confirm') {
      if (key.upArrow || key.downArrow) {
        setConfirmIndex((prev) => (prev === 0 ? 1 : 0));
      }
      if (key.return) {
        if (confirmIndex === 0) {
          setRemovedName(selectedServer.name);
          onRemove(selectedServer.name);
          setPhase('done');
        } else {
          setPhase('select');
        }
      }
    }

    if (phase === 'done' && key.return) {
      onBack();
    }
  });

  const title = '\u2500 Remove Server ';
  const titlePad = '\u2500'.repeat(Math.max(0, boxWidth - title.length));

  const getStatusIcon = (status: TuiServerInfo['status']): string => {
    switch (status) {
      case 'connected':
        return colors.success(symbols.connected);
      case 'needs-auth':
        return colors.warning(symbols.disconnected);
      case 'disconnected':
        return colors.textSecondary(symbols.disconnected);
      case 'connecting':
        return colors.accentDim(symbols.connecting);
    }
  };

  return (
    <Box flexDirection="column">
      <Text>{colors.brandMid(`  ${box.topLeft}${title}${titlePad}${box.topRight}`)}</Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      {phase === 'select' && (
        <>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textPrimary('Select a server to remove:')}
            {' '.repeat(Math.max(1, boxWidth - 30))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          {servers.map((server, i) => {
            const isSelected = i === selectedIndex;
            const icon = getStatusIcon(server.status);
            const indicator = isSelected ? colors.accent(symbols.selected) : ' ';
            const name = isSelected ? colors.textBold(server.name) : colors.textPrimary(server.name);
            const toolInfo = server.toolCount
              ? colors.textSecondary(`${server.toolCount} tools`)
              : colors.textDim('\u2014');
            const transport = colors.textDim(server.transport.toUpperCase());
            const nameLen = server.name.length;
            const toolStr = server.toolCount ? `${server.toolCount} tools` : '\u2014';
            const padLen = Math.max(1, boxWidth - nameLen - toolStr.length - 16);

            return (
              <Text key={server.name}>
                {colors.brandMid(`  ${box.vertical}  `)}
                {indicator} {icon} {name}
                {' '.repeat(Math.max(1, 18 - nameLen))}
                {toolInfo}
                {' '.repeat(Math.max(1, padLen - 8))}
                {transport}
                {' '.repeat(Math.max(1, 4))}
                {colors.brandMid(box.vertical)}
              </Text>
            );
          })}
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.accentDim('\u2191\u2193 select \u2502 enter confirm \u2502 esc back')}
            {' '.repeat(Math.max(1, boxWidth - 36))}
            {colors.brandMid(box.vertical)}
          </Text>
        </>
      )}

      {phase === 'confirm' && selectedServer && (
        <>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textPrimary(`Are you sure you want to remove "${selectedServer.name}"?`)}
            {' '.repeat(Math.max(1, boxWidth - 39 - selectedServer.name.length))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textSecondary('Type:      ')}
            {colors.textPrimary(
              `${selectedServer.transport.toUpperCase()}${selectedServer.transport === 'http' ? ' (Streamable)' : ''}`,
            )}
            {' '.repeat(Math.max(1, boxWidth - 18 - (selectedServer.transport === 'http' ? 18 : 5)))}
            {colors.brandMid(box.vertical)}
          </Text>
          {selectedServer.url && (
            <Text>
              {colors.brandMid(`  ${box.vertical}  `)}
              {colors.textSecondary('URL:       ')}
              {colors.textPrimary(
                selectedServer.url.length > boxWidth - 20
                  ? selectedServer.url.slice(0, boxWidth - 23) + '...'
                  : selectedServer.url,
              )}
              {' '.repeat(Math.max(1, boxWidth - 13 - Math.min(selectedServer.url.length, boxWidth - 20)))}
              {colors.brandMid(box.vertical)}
            </Text>
          )}
          {selectedServer.keywords.length > 0 && (
            <Text>
              {colors.brandMid(`  ${box.vertical}  `)}
              {colors.textSecondary('Tags:      ')}
              {colors.textPrimary(selectedServer.keywords.join(', '))}
              {' '.repeat(Math.max(1, boxWidth - 13 - selectedServer.keywords.join(', ').length))}
              {colors.brandMid(box.vertical)}
            </Text>
          )}
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textSecondary('This will:')}
            {' '.repeat(Math.max(1, boxWidth - 14))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}    `)}
            {colors.textDim(symbols.pending)} {colors.textSecondary('Remove from registry')}
            {' '.repeat(Math.max(1, boxWidth - 28))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}    `)}
            {colors.textDim(symbols.pending)} {colors.textSecondary('Delete cached tokens')}
            {' '.repeat(Math.max(1, boxWidth - 28))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}    `)}
            {colors.textDim(symbols.pending)} {colors.textSecondary('Remove discovery tags')}
            {' '.repeat(Math.max(1, boxWidth - 29))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {confirmIndex === 0 ? colors.accent(symbols.selected) : ' '}{' '}
            {confirmIndex === 0 ? colors.textBold('Yes, remove') : colors.textPrimary('Yes, remove')}
            {' '.repeat(Math.max(1, boxWidth - 17))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {confirmIndex === 1 ? colors.accent(symbols.selected) : ' '}{' '}
            {confirmIndex === 1 ? colors.textBold('Cancel') : colors.textPrimary('Cancel')}
            {' '.repeat(Math.max(1, boxWidth - 12))}
            {colors.brandMid(box.vertical)}
          </Text>
        </>
      )}

      {phase === 'done' && (
        <>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.success(`${symbols.success} Server "${removedName}" removed`)}
            {' '.repeat(Math.max(1, boxWidth - 22 - removedName.length))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.accentDim('[enter] back to dashboard')}
            {' '.repeat(Math.max(1, boxWidth - 29))}
            {colors.brandMid(box.vertical)}
          </Text>
        </>
      )}

      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
      <Text>{colors.brandMid(`  ${box.bottomLeft}${'\u2500'.repeat(boxWidth)}${box.bottomRight}`)}</Text>
    </Box>
  );
}
