/**
 * BoxWrapper — responsive box with title, auto-width based on terminal size.
 * Wraps content in Unicode box-drawing frame.
 */
import React from 'react';
import { Box, Text } from 'ink';
import { useLayout } from '../hooks/useLayout.js';
import { colors, box } from '../styles.js';

interface BoxWrapperProps {
  title?: string;
  children: React.ReactNode;
  footer?: string;
}

export function BoxWrapper({ title, children, footer }: BoxWrapperProps) {
  const { columns } = useLayout();
  const boxWidth = Math.min(columns - 4, 68);

  const titleBar = title
    ? `${box.topLeft}${'─ '}${title}${' '}${'─'.repeat(Math.max(0, boxWidth - title.length - 4))}${box.topRight}`
    : `${box.topLeft}${'─'.repeat(boxWidth)}${box.topRight}`;

  return (
    <Box flexDirection="column">
      <Text>{colors.brandMid(`  ${titleBar}`)}</Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      {children}

      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
      {footer && (
        <Text>
          {colors.brandMid(`  ${box.vertical}  `)}
          {colors.accentDim(footer)}
          {' '.repeat(Math.max(1, boxWidth - footer.length - 4))}
          {colors.brandMid(box.vertical)}
        </Text>
      )}
      {footer && <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>}
      <Text>{colors.brandMid(`  ${box.bottomLeft}${'─'.repeat(boxWidth)}${box.bottomRight}`)}</Text>
    </Box>
  );
}
