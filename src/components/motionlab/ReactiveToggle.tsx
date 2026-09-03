import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { c, geo } from "./tokens";
import type { Side, Theme } from "./tokens";
import type { TickApi } from "./useTickSound";
import { TrackFrame, pillStyle, xFor } from "./toggleParts";

/**
 * Treatment 5 — "Reactive labels + tick", controlled.
 *
 * - pill slides on a critically-damped spring
 * - the label only changes colour (no movement)
 * - the pill border pulses a green glow on commit
 * - a deep cinematic hit fires on commit (if `sound` is provided + enabled)
 */
export function ReactiveToggle({
  value,
  onChange,
  sound,
  theme = "dark",
}: {
  value: Side;
  onChange: (s: Side) => void;
  sound?: TickApi;
  theme?: Theme;
}) {
  const reduce = useReducedMotion();
  const prev = useRef<Side>(value);
  const touched = useRef(false);

  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      sound?.tick();
    }
  }, [value, sound]);

  const pick = (s: Side) => {
    touched.current = true;
    onChange(s);
  };

  return (
    <TrackFrame value={value} onPick={pick} labelFx theme={theme}>
      <motion.div
        style={pillStyle}
        animate={{ x: xFor(value) }}
        transition={
          reduce
            ? { duration: 0 }
            : { type: "spring", stiffness: 550, damping: 38, mass: 1 }
        }
      >
        {touched.current && !reduce && (
          <motion.div
            key={value}
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{
              position: "absolute",
              inset: -1,
              borderRadius: geo.R,
              boxShadow: `0 0 10px 1px ${c.pillBorder}`,
              pointerEvents: "none",
            }}
          />
        )}
      </motion.div>
    </TrackFrame>
  );
}
