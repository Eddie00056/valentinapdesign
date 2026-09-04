import { useRef } from "react";
import type { ReactNode } from "react";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import "../glasslab/glass-button.css";

/* Prototype — a contained "happy" tap reaction for the header icon buttons
   (watchlist star / alert bell), replacing the bellShake keyframes that
   translate + rotate the whole button almost off-frame.

   Everything here pivots on the glyph's own centre and never translates, so
   the button holds its spot. iOS feel: APPLE_EASE + a squish-then-overshoot.
   Three variants to pick from — pop / wiggle / halo. */

const EASE = [0.32, 0.72, 0, 1] as const; // APPLE_EASE

export type TapAnim = "pop" | "wiggle" | "halo";

export function TapPop({
  anim,
  accent = "#48d597",
  ariaLabel,
  children,
}: {
  anim: TapAnim;
  accent?: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const glyph = useAnimationControls();
  const halo = useAnimationControls();
  const busy = useRef(false);

  async function fire() {
    if (busy.current) return;
    busy.current = true;

    if (reduce) {
      await glyph.start({ scale: [1, 0.96, 1], transition: { duration: 0.16 } });
      busy.current = false;
      return;
    }

    if (anim === "pop") {
      await glyph.start({
        scale: [1, 0.82, 1.14, 1],
        transition: { duration: 0.52, times: [0, 0.22, 0.55, 1], ease: EASE },
      });
    } else if (anim === "wiggle") {
      await glyph.start({
        rotate: [0, -12, 9, -5, 0],
        scale: [1, 1.09, 1.0, 1.05, 1],
        transition: { duration: 0.6, times: [0, 0.2, 0.45, 0.72, 1], ease: EASE },
      });
    } else {
      // halo — pop + a colour blip + a ring that radiates out and fades
      halo.set({ scale: 0.65, opacity: 0.5 });
      halo.start({
        scale: 2.1,
        opacity: 0,
        transition: { duration: 0.7, ease: "easeOut" },
      });
      await glyph.start({
        scale: [1, 0.84, 1.14, 1],
        color: ["#f2f2f8", accent, "#f2f2f8"],
        transition: { duration: 0.55, times: [0, 0.22, 0.55, 1], ease: EASE },
      });
    }

    busy.current = false;
  }

  return (
    <motion.button
      type="button"
      aria-label={ariaLabel}
      onClick={fire}
      className="btn btn--mobile btn--icon btn--light"
      whileTap={reduce ? undefined : { scale: 0.94 }}
      transition={{ duration: 0.14, ease: EASE }}
      style={{ color: "#f2f2f8", overflow: "visible" }}
    >
      {anim === "halo" && (
        <motion.span
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.65 }}
          animate={halo}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `1.5px solid ${accent}`,
            pointerEvents: "none",
          }}
        />
      )}
      <motion.span
        className="tap-glyph"
        animate={glyph}
        style={{
          display: "block",
          lineHeight: 0,
          transformOrigin: "50% 50%",
          position: "relative",
          zIndex: 1,
        }}
      >
        {children}
      </motion.span>
    </motion.button>
  );
}
