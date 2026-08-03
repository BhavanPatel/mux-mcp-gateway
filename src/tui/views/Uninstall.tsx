/**
 * Uninstall view — type-to-confirm, step-by-step removal progress.
 * Phases: confirm (type "uninstall") → removing → done.
 */
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { useLayout } from '../hooks/useLayout.js';
import { colors, symbols, box } from '../styles.js';

type UninstallPhase = 'confirm' | 'removing' | 'done';

interface UninstallStep {
  label: string;
  status: 'pending' | 'active' | 'done';
}

interface UninstallProps {
  onBack: () => void;
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const REMOVAL_STEPS: string[] = [
  'Removed registry',
  'Removed tokens',
  'Removed metrics',
  'Removed client hooks',
  'Restored mcp.json configs',
];

export function Uninstall({ onBack }: UninstallProps) {
  const { exit } = useApp();
  const { columns } = useLayout();
  const boxWidth = Math.min(columns - 4, 68);
  const [phase, setPhase] = useState<UninstallPhase>('confirm');
  const [typedText, setTypedText] = useState('');
  const [steps, setSteps] = useState<UninstallStep[]>(REMOVAL_STEPS.map((label) => ({ label, status: 'pending' })));
  const [spinnerIdx, setSpinnerIdx] = useState(0);

  const isAnimating = phase === 'removing';
  useEffect(() => {
    if (!isAnimating) return;
    const timer = setInterval(() => {
      setSpinnerIdx((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, [isAnimating]);

  const startUninstall = () => {
    setPhase('removing');
    setSteps(REMOVAL_STEPS.map((label) => ({ label, status: 'pending' })));

    let currentStep = 0;
    const advance = () => {
      if (currentStep >= REMOVAL_STEPS.length) {
        setPhase('done');
        return;
      }
      setSteps((prev) =>
        prev.map((s, i) => {
          if (i === currentStep) return { ...s, status: 'active' };
          if (i < currentStep) return { ...s, status: 'done' };
          return s;
        }),
      );
      currentStep++;
      setTimeout(
        () => {
          setSteps((prev) => prev.map((s, i) => (i === currentStep - 1 ? { ...s, status: 'done' } : s)));
          advance();
        },
        400 + Math.random() * 300,
      );
    };
    advance();
  };

  useInput((input, key) => {
    if (key.escape && phase === 'confirm') {
      onBack();
      return;
    }
    if (phase === 'done') {
      exit();
      return;
    }
    if (phase === 'confirm') {
      if (key.backspace || key.delete) {
        setTypedText((prev) => prev.slice(0, -1));
        return;
      }
      if (key.return) {
        if (typedText === 'uninstall') {
          startUninstall();
        }
        return;
      }
      if (input && input.length === 1 && !key.ctrl && !key.meta) {
        setTypedText((prev) => prev + input);
      }
    }
  });

  const title = '\u2500 Uninstall ';
  const titlePad = '\u2500'.repeat(Math.max(0, boxWidth - title.length));

  const WARNING_LINES = [
    'This will completely remove Mux from your system:',
    '',
    `  ${symbols.pending} Remove registry (~/.mux/servers.json)`,
    `  ${symbols.pending} Remove cached tokens (~/.mux/tokens.json)`,
    `  ${symbols.pending} Remove metrics data (~/.mux/metrics.json)`,
    `  ${symbols.pending} Remove client hooks (Kiro, Cursor, etc.)`,
    `  ${symbols.pending} Restore original mcp.json configs`,
    '',
    'Your AI clients will revert to connecting to MCP',
    'servers directly (you may need to re-auth each one).',
  ];

  return (
    <Box flexDirection="column">
      <Text>{colors.brandMid(`  ${box.topLeft}${title}${titlePad}${box.topRight}`)}</Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      {phase === 'confirm' && (
        <>
          {WARNING_LINES.map((line, i) => (
            <Text key={i}>
              {colors.brandMid(`  ${box.vertical}  `)}
              {line === '' ? ' ' : colors.textSecondary(line)}
              {' '.repeat(Math.max(1, boxWidth - Math.max(line.length, 1) - 4))}
              {colors.brandMid(box.vertical)}
            </Text>
          ))}
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textDim('\u2500'.repeat(boxWidth - 4))}
            {colors.brandMid(`  ${box.vertical}`)}
          </Text>
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textPrimary('Type "uninstall" to confirm:  ')}
            {colors.warning(typedText)}
            {typedText === 'uninstall' ? colors.success(' \u2713') : ''}
            {' '.repeat(Math.max(1, boxWidth - 32 - typedText.length - (typedText === 'uninstall' ? 2 : 0)))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.accentDim('[esc] cancel')}
            {' '.repeat(Math.max(1, boxWidth - 16))}
            {colors.brandMid(box.vertical)}
          </Text>
        </>
      )}

      {phase === 'removing' && (
        <>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textPrimary('Removing Mux...')}
            {' '.repeat(Math.max(1, boxWidth - 19))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          {steps.map((step) => {
            const icon =
              step.status === 'done'
                ? colors.success(symbols.success)
                : step.status === 'active'
                  ? colors.warning(SPINNER_FRAMES[spinnerIdx])
                  : colors.textDim(symbols.pending);
            const text =
              step.status === 'done' || step.status === 'active'
                ? colors.textPrimary(step.label)
                : colors.textDim(step.label);
            return (
              <Text key={step.label}>
                {colors.brandMid(`  ${box.vertical}  `)}
                {icon} {text}
                {' '.repeat(Math.max(1, boxWidth - step.label.length - 6))}
                {colors.brandMid(box.vertical)}
              </Text>
            );
          })}
        </>
      )}

      {phase === 'done' && (
        <>
          {REMOVAL_STEPS.map((step) => (
            <Text key={step}>
              {colors.brandMid(`  ${box.vertical}  `)}
              {colors.success(symbols.success)} {colors.textPrimary(step)}
              {' '.repeat(Math.max(1, boxWidth - step.length - 6))}
              {colors.brandMid(box.vertical)}
            </Text>
          ))}
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textPrimary('Mux has been removed. Your AI clients will now connect')}
            {' '.repeat(Math.max(1, boxWidth - 57))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textPrimary('to MCP servers directly.')}
            {' '.repeat(Math.max(1, boxWidth - 28))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textSecondary('Thanks for using Mux.')}
            {' '.repeat(Math.max(1, boxWidth - 25))}
            {colors.brandMid(box.vertical)}
          </Text>
        </>
      )}

      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
      <Text>{colors.brandMid(`  ${box.bottomLeft}${'\u2500'.repeat(boxWidth)}${box.bottomRight}`)}</Text>
    </Box>
  );
}
