/**
 * Update view — version check, update progress with spinners, "what's new" post-update.
 * Steps: checking → prompt (if update available) → updating → success/already-latest.
 */
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useLayout } from '../hooks/useLayout.js';
import { colors, symbols, box } from '../styles.js';

type UpdatePhase = 'checking' | 'latest' | 'available' | 'updating' | 'success' | 'error';

interface UpdateStep {
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
  error?: string;
}

interface UpdateProps {
  version: string;
  onBack: () => void;
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const UPDATE_STEPS: string[] = [
  'Pulling latest code',
  'Installing dependencies',
  'Building',
  'Patching client configs',
  'Restarting Mux service',
];

export function Update({ version, onBack }: UpdateProps) {
  const { columns } = useLayout();
  const boxWidth = Math.min(columns - 4, 68);
  const [phase, setPhase] = useState<UpdatePhase>('checking');
  const [latestVersion, setLatestVersion] = useState<string>(version);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [steps, setSteps] = useState<UpdateStep[]>(UPDATE_STEPS.map((label) => ({ label, status: 'pending' })));
  const [spinnerIdx, setSpinnerIdx] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_errorMsg, setErrorMsg] = useState<string>('');

  // Spinner animation
  const isAnimating = phase === 'checking' || phase === 'updating';
  useEffect(() => {
    if (!isAnimating) return;
    const timer = setInterval(() => {
      setSpinnerIdx((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, [isAnimating]);

  // Simulate version check on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      // In production, this would fetch from npm/GitHub releases
      const mockLatest = version; // Same version = already latest
      setLatestVersion(mockLatest);
      setPhase(mockLatest === version ? 'latest' : 'available');
    }, 1200);
    return () => clearTimeout(timer);
  }, [version]);

  // Simulate update progress
  const startUpdate = () => {
    setPhase('updating');
    setSteps(UPDATE_STEPS.map((label) => ({ label, status: 'pending' })));

    let currentStep = 0;
    const advance = () => {
      if (currentStep >= UPDATE_STEPS.length) {
        setPhase('success');
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
        600 + Math.random() * 400,
      );
    };
    advance();
  };

  useInput((input, key) => {
    if (key.escape || (phase === 'latest' && key.return) || (phase === 'success' && key.return)) {
      onBack();
      return;
    }
    if (phase === 'error' && key.return) {
      onBack();
      return;
    }
    if (phase === 'available') {
      if (key.upArrow || key.downArrow) {
        setSelectedIndex((prev) => (prev === 0 ? 1 : 0));
      }
      if (key.return) {
        if (selectedIndex === 0) {
          startUpdate();
        } else {
          onBack();
        }
      }
    }
  });

  const title = '─ Update ';
  const titlePad = '─'.repeat(Math.max(0, boxWidth - title.length));

  return (
    <Box flexDirection="column">
      <Text>{colors.brandMid(`  ${box.topLeft}${title}${titlePad}${box.topRight}`)}</Text>
      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>

      {phase === 'checking' && (
        <Text>
          {colors.brandMid(`  ${box.vertical}  `)}
          {colors.warning(SPINNER_FRAMES[spinnerIdx])} {colors.textPrimary('Checking for updates...')}
          {' '.repeat(Math.max(1, boxWidth - 28))}
          {colors.brandMid(box.vertical)}
        </Text>
      )}

      {phase === 'latest' && (
        <>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textSecondary('Current version:  ')}
            {colors.textBold(`v${version}`)}
            {' '.repeat(Math.max(1, boxWidth - 22 - version.length))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textSecondary('Latest version:   ')}
            {colors.textBold(`v${latestVersion}`)}
            {' '.repeat(Math.max(1, boxWidth - 22 - latestVersion.length))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.success(`${symbols.success} You're on the latest version`)}
            {' '.repeat(Math.max(1, boxWidth - 33))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.accentDim('[enter] back')}
            {' '.repeat(Math.max(1, boxWidth - 16))}
            {colors.brandMid(box.vertical)}
          </Text>
        </>
      )}

      {phase === 'available' && (
        <>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textSecondary('Current version:  ')}
            {colors.textBold(`v${version}`)}
            {' '.repeat(Math.max(1, boxWidth - 22 - version.length))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textSecondary('Latest version:   ')}
            {colors.success(`v${latestVersion}`)}
            {' '.repeat(Math.max(1, boxWidth - 22 - latestVersion.length))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textPrimary('Update now?')}
            {' '.repeat(Math.max(1, boxWidth - 15))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {selectedIndex === 0 ? colors.accent(symbols.selected) : ' '}{' '}
            {selectedIndex === 0
              ? colors.textBold(`Yes, update to v${latestVersion}`)
              : colors.textPrimary(`Yes, update to v${latestVersion}`)}
            {' '.repeat(Math.max(1, boxWidth - 23 - latestVersion.length))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {selectedIndex === 1 ? colors.accent(symbols.selected) : ' '}{' '}
            {selectedIndex === 1 ? colors.textBold('Cancel') : colors.textPrimary('Cancel')}
            {' '.repeat(Math.max(1, boxWidth - 12))}
            {colors.brandMid(box.vertical)}
          </Text>
        </>
      )}

      {phase === 'updating' && (
        <>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textPrimary(`Updating v${version} \u2192 v${latestVersion}`)}
            {' '.repeat(Math.max(1, boxWidth - 18 - version.length - latestVersion.length))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          {steps.map((step) => {
            const icon =
              step.status === 'done'
                ? colors.success(symbols.success)
                : step.status === 'active'
                  ? colors.warning(SPINNER_FRAMES[spinnerIdx])
                  : step.status === 'error'
                    ? colors.error(symbols.error)
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

      {phase === 'success' && (
        <>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.success(`${symbols.success} Updated to v${latestVersion} successfully`)}
            {' '.repeat(Math.max(1, boxWidth - 30 - latestVersion.length))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textSecondary("What's new:")}
            {' '.repeat(Math.max(1, boxWidth - 15))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}    `)}
            {colors.textDim(symbols.pending)} {colors.textPrimary('Bug fixes and improvements')}
            {' '.repeat(Math.max(1, boxWidth - 35))}
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

      {phase === 'error' && (
        <>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.error(`${symbols.error} Update failed`)}
            {' '.repeat(Math.max(1, boxWidth - 18))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.textSecondary(_errorMsg || 'Unknown error')}
            {' '.repeat(Math.max(1, boxWidth - (_errorMsg || 'Unknown error').length - 4))}
            {colors.brandMid(box.vertical)}
          </Text>
          <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
          <Text>
            {colors.brandMid(`  ${box.vertical}  `)}
            {colors.accentDim('[enter] back')}
            {' '.repeat(Math.max(1, boxWidth - 16))}
            {colors.brandMid(box.vertical)}
          </Text>
        </>
      )}

      <Text>{colors.brandMid(`  ${box.vertical}${' '.repeat(boxWidth)}${box.vertical}`)}</Text>
      <Text>{colors.brandMid(`  ${box.bottomLeft}${'─'.repeat(boxWidth)}${box.bottomRight}`)}</Text>
    </Box>
  );
}
