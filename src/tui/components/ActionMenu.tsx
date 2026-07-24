/**
 * ActionMenu — grouped action list with Attention (conditional), Actions, and System sections.
 * Supports arrow-key navigation with selected indicator.
 */
import React from 'react';
import { Box, Text } from 'ink';
import { useLayout } from '../hooks/useLayout.js';
import { colors, symbols, box } from '../styles.js';

interface ActionMenuProps {
  needsAuthCount: number;
  needsAuthServers: string[];
  callsToday: number;
  savingsPct: number;
  version: string;
  selectedIndex: number;
}

export function ActionMenu({
  needsAuthCount,
  needsAuthServers,
  callsToday,
  savingsPct,
  version,
  selectedIndex,
}: ActionMenuProps) {
  const { layout, columns } = useLayout();
  const boxWidth = Math.min(columns - 4, 68);
  const showDesc = layout === 'full' || layout === 'standard';
  let idx = 0;

  return (
    <Box flexDirection="column">
      <Text>
        {colors.brandMid(`  ${box.topLeft}${' Actions '}${'─'.repeat(Math.max(0, boxWidth - 10))}${box.topRight}`)}
      </Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      {needsAuthCount > 0 && (
        <>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.warning(`${symbols.attention} Attention`)}
            {' '.repeat(Math.max(0, boxWidth - 16))}
            {colors.brandMid(box.vertical)}
          </Text>
          <MenuRow
            label={`Authorize ${needsAuthCount} servers`}
            desc={needsAuthServers.slice(0, 3).join(', ')}
            selected={idx++ === selectedIndex}
            showDesc={showDesc}
            boxWidth={boxWidth}
          />
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
        </>
      )}

      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {colors.accent(`${symbols.actions} Actions`)}
        {' '.repeat(Math.max(0, boxWidth - 14))}
        {colors.brandMid(box.vertical)}
      </Text>
      <MenuRow
        label="Test connections"
        desc="Health check all servers"
        selected={idx++ === selectedIndex}
        showDesc={showDesc}
        boxWidth={boxWidth}
      />
      <MenuRow
        label="View metrics"
        desc={`${callsToday} calls | ${savingsPct}% savings`}
        selected={idx++ === selectedIndex}
        showDesc={showDesc}
        boxWidth={boxWidth}
      />
      <MenuRow
        label="Add a server"
        desc="Register new MCP server"
        selected={idx++ === selectedIndex}
        showDesc={showDesc}
        boxWidth={boxWidth}
      />
      <MenuRow
        label="Edit server"
        desc="Discovery tags, URL, rename"
        selected={idx++ === selectedIndex}
        showDesc={showDesc}
        boxWidth={boxWidth}
      />
      <MenuRow
        label="Remove a server"
        desc="Delete from registry"
        selected={idx++ === selectedIndex}
        showDesc={showDesc}
        boxWidth={boxWidth}
      />

      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {colors.textSecondary(`${symbols.system} System`)}
        {' '.repeat(Math.max(0, boxWidth - 13))}
        {colors.brandMid(box.vertical)}
      </Text>
      <MenuRow
        label="Update"
        desc={`v${version} (latest)`}
        selected={idx++ === selectedIndex}
        showDesc={showDesc}
        boxWidth={boxWidth}
      />
      <MenuRow
        label="Uninstall"
        desc="Remove Mux completely"
        selected={idx++ === selectedIndex}
        showDesc={showDesc}
        boxWidth={boxWidth}
      />

      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {colors.accentDim('↑↓ navigate │ enter select │ ? help │ q quit')}
        {' '.repeat(Math.max(0, boxWidth - 49))}
        {colors.brandMid(box.vertical)}
      </Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
      <Text>{colors.brandMid(`  ${box.bottomLeft}${'─'.repeat(boxWidth)}${box.bottomRight}`)}</Text>
    </Box>
  );
}

function MenuRow({
  label,
  desc,
  selected,
  showDesc,
  boxWidth,
}: {
  label: string;
  desc: string;
  selected: boolean;
  showDesc: boolean;
  boxWidth: number;
}) {
  const indicator = selected ? colors.accent(symbols.selected) : ' ';
  const labelText = selected ? colors.textBold(label) : label;

  if (!showDesc) {
    return (
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {indicator} {labelText}
        {' '.repeat(Math.max(1, boxWidth - label.length - 6))}
        {colors.brandMid(box.vertical)}
      </Text>
    );
  }

  const dots = colors.textDim('·'.repeat(Math.max(2, 28 - label.length)));
  return (
    <Text>
      {colors.brandMid(`  ${box.vertical}  `)}
      {indicator} {labelText} {dots} {colors.textSecondary(desc)}
      {' '.repeat(Math.max(1, boxWidth - label.length - 28 - desc.length + 18))}
      {colors.brandMid(box.vertical)}
    </Text>
  );
}

export function getMenuItemCount(needsAuthCount: number): number {
  return (needsAuthCount > 0 ? 1 : 0) + 5 + 2;
}
