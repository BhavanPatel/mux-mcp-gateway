/**
 * Responsive layout breakpoint detection.
 * Returns the current layout mode based on terminal width.
 */
import { useStdout } from 'ink';

export type Layout = 'full' | 'standard' | 'compact' | 'narrow';

export function useLayout(): { layout: Layout; columns: number } {
  const { stdout } = useStdout();
  const columns = stdout?.columns ?? 80;

  const layout: Layout = columns >= 100 ? 'full' : columns >= 80 ? 'standard' : columns >= 60 ? 'compact' : 'narrow';

  return { layout, columns };
}
