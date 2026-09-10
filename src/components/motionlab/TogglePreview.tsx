import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { c, geo } from "./tokens";
import type { Side } from "./tokens";
import { TrackFrame, pillStyle, xFor } from "./toggleParts";
import { PreviewStage } from "../gallery/PreviewStage";

/**
 * Non-interactive thumbnail: the toggle plays on a loop so the card shows the
 * motion at a glance. Pointer events are disabled so a click falls through to
 * the card link.
 *
 * The outer element is an explicit stage. `transform: scale()` grows what you
 * see but not what the element occupies, so without a declared box the tile
 * took its height from the track's 20px layout box and collapsed to a sliver.
 * The track is 104x20; at 1.8 it paints 187x36, which this stage has room for.
 */
export function TogglePreview() {
  const reduce = useReducedMotion();
  const [value, setValue] = useState<Side>("stock");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (reduce) return;
    timer.current = window.setInterval(() => {
      setValue((v) => (v === "stock" ? "option" : "stock"));
    }, 1900);
    return () => window.clearInterval(timer.current);
  }, [reduce]);

  return (
    <PreviewStage
      width={264}
      height={150}
      contentWidth={104}
      contentHeight={20}
      scale={1.8}
    >
      <TrackFrame value={value} onPick={() => {}} theme="light">
        <motion.div
          style={pillStyle()}
          animate={{ x: xFor(value) }}
          transition={
            reduce
              ? { duration: 0 }
              : { type: "spring", stiffness: 550, damping: 38, mass: 1 }
          }
        >
          {!reduce && (
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
    </PreviewStage>
  );
}
