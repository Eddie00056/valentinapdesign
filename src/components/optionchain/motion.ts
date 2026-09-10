/**
 * Motion vocabulary for the option chain.
 *
 * Ported from the proposal mock's `option-chain-motion.ts`. Durations,
 * easings and variants are verbatim — the chain updates constantly, so
 * motion has one job here: say what changed without pulling your eye off
 * the strike you were reading.
 *
 * The two styled-components keyframe helpers from the original live in
 * option-chain.css now as real `@keyframes oc-flash-up/down`; everything
 * else below is unchanged.
 */
export const DURATION = {
  /** Tick flash, hover affordances. Must feel instant. */
  instant: 0.08,
  fast: 0.14,
  /** Panel and tray entrances. */
  base: 0.2,
  /** Expiry change / chain re-render, where a longer beat aids orientation. */
  slow: 0.32,
} as const;

export const EASING = {
  /** Default. Fast out, settled in. */
  standard: [0.2, 0, 0, 1] as const,
  /** Entrances. */
  decelerate: [0, 0, 0, 1] as const,
  /** Exits. */
  accelerate: [0.3, 0, 1, 1] as const,
} as const;

export const SEG_SPRING = { type: "spring", stiffness: 460, damping: 40 } as const;
