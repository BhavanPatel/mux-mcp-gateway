/**
 * EditPicker view — pick which server to edit.
 * A thin select list; on Enter it hands the SELECTED server back to the caller
 * (App routes it to the EditServer view). This replaces the old behaviour where
 * "Edit server" always targeted registry.servers[0] regardless of selection.
 */
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useLayout } from '../hooks/useLayout.js';
import { colors, symbols, box } from '../styles.js';
import type { TuiServerInfo } from '../hooks/useRegistry.js';

interface EditPickerProps {
  servers: TuiServerInfo[];
  onBack: () => void;
  onSelect: (server: TuiServerInfo) => void;
}

export function EditPicker({ servers, onBack, onSelect }: EditPickerProps) {
  const { columns } = useLayout();
  const boxWidth = Math.min(columns - 4, 68);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : servers.length - 1));
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => (prev < servers.length - 1 ? prev + 1 : 0));
    }
    if (key.return && servers.length > 0) {
      onSelect(servers[selectedIndex]);
    }
  });

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

  const title = '\u2500 Edit Server ';
  const titlePad = '\u2500'.repeat(Math.max(0, boxWidth - title.length));

  return (
    <Box flexDirection="column">
      <Text>{colors.brandMid(`  ${box.topLeft}${title}${titlePad}${box.topRight}`)}</Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {colors.textPrimary('Select a server to edit:')}
        {' '.repeat(Math.max(1, boxWidth - 28))}
        {colors.brandMid(box.vertical)}
      </Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      {servers.length === 0 && (
        <Text>
          {colors.brandMid(`  ${box.vertical}  `)}
          {colors.textDim('No servers registered.')}
          {' '.repeat(Math.max(1, boxWidth - 26))}
          {colors.brandMid(box.vertical)}
        </Text>
      )}

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
        {colors.accentDim('\u2191\u2193 select \u2502 enter edit \u2502 esc back')}
        {' '.repeat(Math.max(1, boxWidth - 34))}
        {colors.brandMid(box.vertical)}
      </Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
      <Text>{colors.brandMid(`  ${box.bottomLeft}${'\u2500'.repeat(boxWidth)}${box.bottomRight}`)}</Text>
    </Box>
  );
}
