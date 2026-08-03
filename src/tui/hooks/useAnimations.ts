/**
 * Animation hooks for the TUI.
 * Provides count-up, stagger-in, and pulse effects.
 */
import { useState, useEffect, useRef } from 'react';

/**
 * Animates a number from 0 to target over duration ms.
 */
export function useCountUp(target: number, duration = 600): number {
  const [current, setCurrent] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) {
      setCurrent(0);
      return;
    }
    startRef.current = Date.now();
    const tick = () => {
      const elapsed = Date.now() - (startRef.current || 0);
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(target * eased));
      if (progress < 1) {
        setTimeout(tick, 16);
      }
    };
    tick();
  }, [target, duration]);

  return current;
}

/**
 * Returns how many items should be visible (stagger-in effect).
 */
export function useStaggerIn(totalItems: number, delayMs = 150): number {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (totalItems === 0) return;
    let current = 0;
    const show = () => {
      current++;
      setVisibleCount(current);
      if (current < totalItems) {
        setTimeout(show, delayMs);
      }
    };
    const timer = setTimeout(show, 50);
    return () => clearTimeout(timer);
  }, [totalItems, delayMs]);

  return visibleCount;
}

/**
 * Returns a brightness that pulses between dim and bright.
 */
export function usePulse(enabled: boolean, intervalMs = 1200): boolean {
  const [bright, setBright] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      setBright((prev) => !prev);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs]);

  return bright;
}

const SPINNER_FRAMES = [
  '\u280B',
  '\u2819',
  '\u2839',
  '\u2838',
  '\u283C',
  '\u2834',
  '\u2826',
  '\u2827',
  '\u2807',
  '\u280F',
];

/**
 * Returns the current spinner frame for animated spinners.
 */
export function useSpinner(active: boolean): string {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setIdx((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, [active]);

  return SPINNER_FRAMES[idx];
}

/**
 * Returns progress (0-1) per bar for staggered fill animation.
 */
export function useBarFillAnimation(barCount: number, rowDelayMs = 80): number[] {
  const [fills, setFills] = useState<number[]>(new Array(barCount).fill(0));

  useEffect(() => {
    if (barCount === 0) return;
    const duration = 400;
    const startTime = Date.now();

    const tick = () => {
      const now = Date.now();
      const newFills = Array.from({ length: barCount }, (_, i) => {
        const barStart = startTime + i * rowDelayMs;
        const elapsed = now - barStart;
        if (elapsed <= 0) return 0;
        return Math.min(elapsed / duration, 1);
      });
      setFills(newFills);
      if (newFills.some((f) => f < 1)) {
        setTimeout(tick, 16);
      }
    };
    tick();
  }, [barCount, rowDelayMs]);

  return fills;
}
