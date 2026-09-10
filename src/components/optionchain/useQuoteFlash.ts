import { useEffect, useRef, useState } from 'react';

export type FlashDirection = 'up' | 'down' | null;

/**
 * Returns 'up' / 'down' for a short window after `value` changes, then null.
 *
 * Drives the bid/ask tick flash. The timer is cleared on every change so a fast
 * sequence of ticks re-arms rather than queuing overlapping flashes.
 */
export function useQuoteFlash(value: number, durationMs = 420): FlashDirection {
  const [direction, setDirection] = useState<FlashDirection>(null);
  const previous = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value === previous.current) return;
    setDirection(value > previous.current ? 'up' : 'down');
    previous.current = value;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDirection(null), durationMs);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, durationMs]);

  return direction;
}

/**
 * Simulates a live quote feed so the mock demonstrates tick motion.
 * Replace with the real `useSecurityQuote` subscription when wiring up.
 */
export function useSimulatedTicks(enabled: boolean, intervalMs = 1400): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);

  return tick;
}
