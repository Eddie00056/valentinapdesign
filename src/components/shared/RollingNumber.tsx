import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";

/* Odometer number roll: a 0-9 strip per digit slides to the target. No
   AnimatePresence, so a digit can never leave a ghost behind.

   Extracted from the options strategy builder so the chain widget and the
   builder share one implementation — a change to how a live figure ticks
   should land on both pages at once. Every comment below records a fix
   that was made against the real render; don't relitigate them. */

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function Digit({ d }: { d: number }) {
  const reduce = useReducedMotion();
  return (
    <span
      style={{
        display: "inline-block",
        overflow: "hidden",
        // Explicit width, not content-sized — a nested flex column's
        // auto-width can render inconsistently cell to cell even with
        // tabular-nums, which read as an uneven gap between digits.
        width: "0.58em",
        height: "1.15em",
        lineHeight: "1.15em",
        verticalAlign: "bottom",
      }}
    >
      <motion.span
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
        }}
        animate={{ y: `-${d * 1.15}em` }}
        transition={
          reduce ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }
        }
      >
        {DIGITS.map((n) => (
          <span key={n} style={{ height: "1.15em" }}>
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

export function Rolling({
  value,
  style,
  className,
}: {
  value: string;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontVariantNumeric: "tabular-nums",
        // Digits render as separate inline-block cells (for the odometer
        // roll) rather than plain text — the page's letter-spacing still
        // applies at each cell boundary, which reads as an uneven gap
        // between digits. Numbers should be tight regardless.
        letterSpacing: 0,
        ...style,
      }}
    >
      {value.split("").map((ch, i) =>
        ch >= "0" && ch <= "9" ? (
          <Digit key={i} d={+ch} />
        ) : (
          // Digit cells sit at vertical-align:bottom (baked into their own
          // height/line-height box) — punctuation must match that exact
          // alignment or it visibly staggers against the digits next to it.
          <span
            key={i}
            style={{
              display: "inline-block",
              height: "1.15em",
              lineHeight: "1.15em",
              verticalAlign: "bottom",
              whiteSpace: "pre",
            }}
          >
            {ch}
          </span>
        ),
      )}
    </span>
  );
}
