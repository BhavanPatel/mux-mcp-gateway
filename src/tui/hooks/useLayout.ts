/**
 * Responsive layout breakpoint detection.
 * Returns the current layout mode based on terminal width, plus terminal
 * height. Re-renders on SIGWINCH (terminal resize) — Ink's useStdout alone
 * does not subscribe to resize, so we track dimensions in state (WS-B3).
 */
import { useState, useEffect } from 'react';
import { useStdout } from 'ink';

export type Layout = 'full' | 'standard' | 'compact' | 'narrow';

const DEFAULT_COLUMNS = 80;
const DEFAULT_ROWS = 24;

export function useLayout(): { layout: Layout; columns: number; rows: number } {
  const { stdout } = useStdout();
  const [size, setSize] = useState({
    columns: stdout?.columns ?? DEFAULT_COLUMNS,
    rows: stdout?.rows ?? DEFAULT_ROWS,
  });

  useEffect(() => {
    if (!stdout) return;
    const onResize = () => {
      setSize({ columns: stdout.columns ?? DEFAULT_COLUMNS, rows: stdout.rows ?? DEFAULT_ROWS });
    };
    stdout.on('resize', onResize);
    // Sync once in case dimensions changed between initial state and effect.
    onResize();
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  const { columns, rows } = size;
  const layout: Layout = columns >= 100 ? 'full' : columns >= 80 ? 'standard' : columns >= 60 ? 'compact' : 'narrow';

  return { layout, columns, rows };
}
