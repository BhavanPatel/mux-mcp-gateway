/**
 * Spinner — animated braille spinner component.
 * Used for connection status and loading indicators.
 */
import React, { useState, useEffect } from 'react';
import { Text } from 'ink';
import { colors } from '../styles.js';

interface SpinnerProps {
  /** Color function to apply. Defaults to warning (yellow). */
  color?: (text: string) => string;
}

const FRAMES = ['\u280B', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2807', '\u280F'];

export function Spinner({ color }: SpinnerProps) {
  const [idx, setIdx] = useState(0);
  const colorFn = color ?? colors.warning;

  useEffect(() => {
    const timer = setInterval(() => {
      setIdx((prev) => (prev + 1) % FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  return <Text>{colorFn(FRAMES[idx])}</Text>;
}
