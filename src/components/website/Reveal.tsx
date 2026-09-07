import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** fraction of the block on screen before it fades up */
  amount?: number;
};

/**
 * Opacity-only fade as a section scrolls into view. Deliberately no transform —
 * a translate/scale here would fight the page's CSS scroll-snap (it shifts the
 * snap-area box mid-animation). The "slow then snap" feel is the scroll-snap;
 * this just softens each section's arrival.
 */
export function Reveal({ children, amount = 0.35 }: Props) {
  const reduce = useReducedMotion();

  if (reduce) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
