import { useEffect, useReducer, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import "./typed-error.css";

/* The boxed order ticket's fractional-shares error, typed out letter by
   letter under a caret (a "\n" in the copy is typed as a line break): the message reveals itself the way a field error
   is read — as a line being written to you — rather than popping in.
   Same copy as the ticket's error row, set like the order-placed caption
   beside it on the slide (see the css); the deck shows it 1:1 (no fit),
   so the size here is the size on the slide. */

/* Two lines, broken where they come out most even in the caption face
   (232px / 243px at 20.8px; every other break differs by 37px or more),
   left-aligned to one edge in a block the width of the longer line; the
   block is centred over the mark below it. Each line is sized by a hidden
   copy of itself, so nothing drifts while typing. */
export const ERROR_COPY = "Switch to a market order\nto trade fractional shares.";

const CHAR_MS = 42; // one letter
const PAUSE_MS = 220; // after a comma / full stop
const HOLD_MS = 2600; // the finished line, before it clears
const CLEAR_MS = 360; // fade out
const GAP_MS = 700; // empty line, caret blinking, before the next pass

export function TypedError({
  text = ERROR_COPY,
  loop = true,
}: {
  text?: string;
  loop?: boolean;
}) {
  const reduced = useReducedMotion();
  const [n, setN] = useState(reduced ? text.length : 0);
  const [phase, setPhase] = useState<"typing" | "hold" | "clear" | "gap">(
    reduced ? "hold" : "gap",
  );
  const [pass, bump] = useReducer((x: number) => x + 1, 0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (reduced) return;
    let i = 0;
    const step = () => {
      i += 1;
      setN(i);
      if (i >= text.length) {
        setPhase("hold");
        timer.current = window.setTimeout(() => {
          if (!loop) return;
          setPhase("clear");
          timer.current = window.setTimeout(() => {
            setN(0);
            setPhase("gap");
            timer.current = window.setTimeout(bump, GAP_MS);
          }, CLEAR_MS);
        }, HOLD_MS);
        return;
      }
      const ch = text[i - 1];
      timer.current = window.setTimeout(step, ch === "," || ch === "." ? PAUSE_MS : CHAR_MS);
    };
    timer.current = window.setTimeout(() => {
      setPhase("typing");
      step();
    }, GAP_MS);
    return () => window.clearTimeout(timer.current);
  }, [pass, text, loop, reduced]);

  // each line: its finished self, hidden, sizes and centres a row; the
  // typed part sits on the row's left edge, the caret after the last
  // landed letter (it waits at a finished line's end until the break itself
  // is "typed", then moves to the next row)
  const lines = text.split("\n");
  let start = 0;
  const rows = lines.map((line, i) => {
    const typed = Math.max(0, Math.min(line.length, n - start));
    const next = start + line.length + 1;
    const current = n >= start && (n < next || i === lines.length - 1);
    start = next;
    return { line, typed, current };
  });
  return (
    <motion.div
      className="te-block"
      role="status"
      aria-live="polite"
      animate={{ opacity: phase === "clear" ? 0 : 1 }}
      transition={{ duration: phase === "clear" ? CLEAR_MS / 1000 : 0.12, ease: "easeOut" }}
    >
      {rows.map(({ line, typed, current }, i) => (
        <span className="te-line" key={i}>
          <span className="te-row">
            <span className="te-ghost" aria-hidden="true">
              {line}
            </span>
            <span className="te-live">
              {line.slice(0, typed)}
              {current && (
                <span
                  className={"te-caret" + (phase === "typing" ? "" : " te-caret--blink")}
                  aria-hidden="true"
                />
              )}
            </span>
          </span>
        </span>
      ))}
    </motion.div>
  );
}
