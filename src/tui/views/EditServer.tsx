/**
 * EditServer view — server detail + discovery tag editing.
 * Shows name, type, URL, auth status, tools, and editable discovery tags.
 */
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useLayout } from '../hooks/useLayout.js';
import { colors, symbols, box } from '../styles.js';
import type { TuiServerInfo } from '../hooks/useRegistry.js';

interface EditServerProps {
  server: TuiServerInfo;
  onBack: () => void;
  onAuth: (serverName: string) => void;
  onSaveTags: (serverName: string, tags: string[]) => void;
  onDelete: (serverName: string) => void;
}

type EditMode = 'view' | 'editing-tags';

export function EditServer({ server, onBack, onAuth, onSaveTags, onDelete }: EditServerProps) {
  const { columns } = useLayout();
  const boxWidth = Math.min(columns - 4, 68);
  const [mode, setMode] = useState<EditMode>('view');
  const [tagInput, setTagInput] = useState(server.keywords.join(', '));
  const [confirmDelete, setConfirmDelete] = useState(false);

  useInput((input, key) => {
    if (mode === 'editing-tags') {
      if (key.return) {
        const newTags = tagInput
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        onSaveTags(server.name, newTags);
        setMode('view');
        return;
      }
      if (key.escape) {
        setTagInput(server.keywords.join(', '));
        setMode('view');
        return;
      }
      if (key.backspace || key.delete) {
        setTagInput((prev) => prev.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setTagInput((prev) => prev + input);
      }
      return;
    }

    if (confirmDelete) {
      if (input === 'y' || input === 'Y') {
        onDelete(server.name);
        return;
      }
      setConfirmDelete(false);
      return;
    }

    if (key.escape) {
      onBack();
      return;
    }
    if (input === 'e') {
      setMode('editing-tags');
      return;
    }
    if (input === 'r') {
      onAuth(server.name);
      return;
    }
    if (input === 'd') {
      setConfirmDelete(true);
      return;
    }
  });

  const transportLabel = server.transport === 'http' ? 'HTTP (Streamable)' : 'Stdio';
  const authLabel =
    server.status === 'connected'
      ? colors.success(`${symbols.success} OAuth active`)
      : server.status === 'needs-auth'
        ? colors.warning('Needs authorization')
        : colors.textSecondary('N/A');

  return (
    <Box flexDirection="column">
      <Text>
        {colors.brandMid(
          `  ${box.topLeft}${'─ Edit Server: '}${server.name}${' '}${'─'.repeat(Math.max(0, boxWidth - server.name.length - 17))}${box.topRight}`,
        )}
      </Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      <DetailRow label="Name" value={server.name} boxWidth={boxWidth} />
      <DetailRow label="Type" value={transportLabel} boxWidth={boxWidth} />
      {server.url && <DetailRow label="URL" value={truncateUrl(server.url, boxWidth - 20)} boxWidth={boxWidth} />}
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {colors.textSecondary('Auth'.padEnd(12))}
        {authLabel}
        {' '.repeat(Math.max(1, boxWidth - 20 - (server.status === 'connected' ? 13 : server.status === 'needs-auth' ? 19 : 3)))}
        {colors.brandMid(box.vertical)}
      </Text>
      <DetailRow label="Tools" value={server.toolCount ? `${server.toolCount} available` : 'None discovered'} boxWidth={boxWidth} />

      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {colors.textDim('── Discovery Tags ──')}
        {' '.repeat(Math.max(1, boxWidth - 24))}
        {colors.brandMid(box.vertical)}
      </Text>
      <Text>
        {colors.brandMid(`  ${box.vertical}  `)}
        {colors.textSecondary('How the AI finds this server when routing tool calls:')}
        {' '.repeat(Math.max(1, boxWidth - 56))}
        {colors.brandMid(box.vertical)}
      </Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      {mode === 'editing-tags' ? (
        <>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.accent(tagInput)}
            {colors.accent('|')}
            {' '.repeat(Math.max(1, boxWidth - tagInput.length - 5))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textDim('Comma-separated. Enter to save, Esc to cancel.')}
            {' '.repeat(Math.max(1, boxWidth - 50))}
            {colors.brandMid(box.vertical)}
          </Text>
        </>
      ) : (
        <>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textPrimary(server.keywords.length > 0 ? server.keywords.join(', ') : '(none)')}
            {' '.repeat(Math.max(1, boxWidth - Math.max(server.keywords.join(', ').length, 6) - 4))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textSecondary('These are auto-generated from tool names. Edit to')}
            {' '.repeat(Math.max(1, boxWidth - 53))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textSecondary('improve routing accuracy.')}
            {' '.repeat(Math.max(1, boxWidth - 28))}
            {colors.brandMid(box.vertical)}
          </Text>
        </>
      )}

      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      {confirmDelete ? (
        <Text>
          {colors.brandMid(`  ${box.vertical}  `)}
          {colors.error(`Remove "${server.name}"? [y]es / any key to cancel`)}
          {' '.repeat(Math.max(1, boxWidth - server.name.length - 42))}
          {colors.brandMid(box.vertical)}
        </Text>
      ) : (
        <Text>
          {colors.brandMid(`  ${box.vertical}  `)}
          {colors.accentDim('[e] edit tags   [r] refresh auth   [d] delete   [esc] back')}
          {' '.repeat(Math.max(1, boxWidth - 60))}
          {colors.brandMid(box.vertical)}
        </Text>
      )}

      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
      <Text>{colors.brandMid(`  ${box.bottomLeft}${'─'.repeat(boxWidth)}${box.bottomRight}`)}</Text>
    </Box>
  );
}

function DetailRow({ label, value, boxWidth }: { label: string; value: string; boxWidth: number }) {
  return (
    <Text>
      {colors.brandMid(`  ${box.vertical}  `)}
      {colors.textSecondary(label.padEnd(12))}
      {colors.textPrimary(value)}
      {' '.repeat(Math.max(1, boxWidth - 12 - value.length - 4))}
      {colors.brandMid(box.vertical)}
    </Text>
  );
}

function truncateUrl(url: string, maxLen: number): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 3) + '...';
}
