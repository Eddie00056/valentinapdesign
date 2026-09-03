import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";

/* Prototype — static 1D line chart, Robinhood-style:
   - the whole line is a uniform light green
   - only the final short segment ("recent") pops to full-strength green
   - a pulsing dot sits at "now"; the line stops there
   - the dashed prev-close baseline runs the full width, and gets bolder
     in the "future" region past "now"
   - baseline sits ~1/4 up from the bottom
   Standalone; nothing here touches AlertCreationScreen. */

const W = 360;
const H = 190;
const PAD = 22;
const N = 96;
const START_FROM_BOTTOM = 0.25;
const PROGRESS = 0.56; // how far across the day "now" is
const TAIL_POINTS = 20; // trailing points drawn in the brighter green

const LINE = "#7ED37B"; // the bulk of the line
const LINE_HOT = "#00C805"; // recent segment + dot + pulse
const LINE_DOWN = "#FF7A45";
const LINE_DOWN_HOT = "#FF5A00";

function walk(seed: number, n: number, drift: number, vol: number) {
  let s = seed;
  let v = 50;
  const out: number[] = [];
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < n; i++) {
    v += drift + (rnd() - 0.5) * vol;
    out.push(v);
  }
  return out;
}

const toPath = (pts: [number, number][]) =>
  "M" + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("L");

export function LiveLineChart() {
  const reduce = useReducedMotion();

  const { mainPath, tailPath, baselineY, endX, dot, up } = useMemo(() => {
    const data = walk(7, N, 0.22, 3.0);
    const v0 = data[0];

    const baselineY = PAD + (H - 2 * PAD) * (1 - START_FROM_BOTTOM);
    const spaceUp = baselineY - PAD;
    const spaceDown = H - PAD - baselineY;

    const rel = data.map((v) => v - v0);
    const relMax = Math.max(0, ...rel);
    const relMin = Math.min(0, ...rel);
    const k = Math.min(
      relMax > 0 ? spaceUp / relMax : Infinity,
      relMin < 0 ? spaceDown / -relMin : Infinity,
    );
    const yy = (v: number) => baselineY - (v - v0) * k;

    const endX = W * PROGRESS;
    const pts = data.map(
      (v, i) => [(i / (data.length - 1)) * endX, yy(v)] as [number, number],
    );
    return {
      mainPath: toPath(pts),
      tailPath: toPath(pts.slice(-TAIL_POINTS - 1)),
      baselineY,
      endX,
      dot: pts[pts.length - 1],
      up: data[data.length - 1] >= v0,
    };
  }, []);

  const hot = up ? LINE_HOT : LINE_DOWN_HOT;
  const cool = up ? LINE : LINE_DOWN;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: "block", overflow: "hidden" }}
      aria-hidden="true"
    >
      {/* baseline — light for the elapsed part, bolder past "now" */}
      <line
        x1="0"
        x2={endX}
        y1={baselineY}
        y2={baselineY}
        stroke="rgba(0,0,0,0.14)"
        strokeWidth="1"
        strokeDasharray="0.75 4"
        strokeLinecap="round"
      />
      <line
        x1={endX}
        x2={W}
        y1={baselineY}
        y2={baselineY}
        stroke="rgba(0,0,0,0.34)"
        strokeWidth="1.4"
        strokeDasharray="1.4 4"
        strokeLinecap="round"
      />

      {/* the line — uniform cool green */}
      <motion.path
        d={mainPath}
        fill="none"
        stroke={cool}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0, opacity: 0 }}
        animate={reduce ? undefined : { pathLength: 1, opacity: 1 }}
        transition={{
          pathLength: { duration: 1, ease: [0.4, 0, 0.2, 1] },
          opacity: { duration: 0.25 },
        }}
      />

      {/* recent segment pops */}
      <motion.path
        d={tailPath}
        fill="none"
        stroke={hot}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { opacity: 0 }}
        animate={reduce ? undefined : { opacity: 1 }}
        transition={{ opacity: { duration: 0.3, delay: 0.9 } }}
      />

      {/* the only live thing: a pulse ring at "now" — scale, not r, so the
          loop can't flip direction and flash */}
      {!reduce && (
        <motion.circle
          cx={dot[0]}
          cy={dot[1]}
          r={3.6}
          fill={hot}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
          initial={{ scale: 0.5, opacity: 0.45 }}
          animate={{ scale: 4.4, opacity: 0 }}
          transition={{
            duration: 1.7,
            ease: "easeOut",
            repeat: Infinity,
            repeatType: "loop",
          }}
        />
      )}
      <circle cx={dot[0]} cy={dot[1]} r="3.6" fill={hot} />
    </svg>
  );
}
