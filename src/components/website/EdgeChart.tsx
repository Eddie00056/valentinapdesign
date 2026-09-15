import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import "./edge-chart.css";

/* The EdgeMobile chart card, live — replacing the baked Framer clip
   (edge-chart.mp4), which hard-cut between ranges. Same picture: a green
   line over a dark card, the wash under it fading out, a dashed line at
   the opening price, the dot on "now", the range rail with the chosen
   range in an outlined pill. The clip's own geometry, measured off its
   frames, in a 2000×1463 box.

   Motion: every range holds a series of the same length, so a change
   morphs the line point to point (0.55s, the snap ease the other live
   charts use), the dot rides the last point, the pill slides on a spring.
   The rail steps through the ranges on its own while the card is on
   screen; a tap picks one and the walk resumes from there. Reduced
   motion: the cut, no travel. */

const W = 2000;
const H = 1463;
const X0 = 32; // the line's first point
const X1 = 1976; // its last — the dot sits here
const TOP = 190; // highest a line may reach
const BASE = 683; // the opening price: every range's dashed line
const BOTTOM = 930; // lowest a line may reach
const DIVIDER = 1125;
const RAIL_Y = 1289; // the labels' centre line
const PILL_W = 177;
const PILL_H = 170;
const N = 140; // points per range — constant, so paths interpolate

const GREEN = "#4de796";
const GREY = "#717171";
const EASE_SNAP: [number, number, number, number] = [0.33, 1, 0.68, 1];

const RANGES = ["1D", "5D", "1M", "3M", "6M", "1Y", "MAX"] as const;
type Range = (typeof RANGES)[number];
const RAIL_X: Record<Range, number> = { "1D": 215, "5D": 485, "1M": 755, "3M": 1024, "6M": 1294, "1Y": 1568, MAX: 1839 };

/* Each range's character — seed, drift per step, noise — chosen so the
   set reads like the clip's: the day choppy and a touch up, the month
   dipping then climbing well clear of the open, the quarter flat then a
   leap, the year a long climb. */
const SHAPE: Record<Range, [number, number, number]> = {
  "1D": [7, 0.05, 3.2],
  "5D": [23, 0.1, 2.6],
  "1M": [41, 0.16, 2.4],
  "3M": [88, 0.2, 2.0],
  "6M": [131, 0.26, 1.8],
  "1Y": [204, 0.34, 1.6],
  MAX: [512, 0.42, 1.3],
};

function walk(seed: number, drift: number, vol: number) {
  let s = seed >>> 0;
  let v = 0;
  const out: number[] = [];
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < N; i++) {
    out.push(v);
    v += drift + (rnd() - 0.5) * vol;
  }
  return out;
}

/* The open pins to BASE; the walk is scaled so its farthest excursion
   just touches TOP or BOTTOM — the way the clip's lines fill the card. */
function build(range: Range) {
  const [seed, drift, vol] = SHAPE[range];
  const data = walk(seed, drift, vol);
  const up = Math.max(...data, 0.01);
  const down = Math.max(...data.map((v) => -v), 0.01);
  const k = Math.min((BASE - TOP) / up, (BOTTOM - BASE) / down);
  const x = (i: number) => X0 + (i / (N - 1)) * (X1 - X0);
  const y = (v: number) => BASE - v * k;
  const pts = data.map((v, i) => [x(i), y(v)] as const);
  const line = "M" + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L ");
  const area = `${line} L ${X1} ${DIVIDER} L ${X0} ${DIVIDER} Z`;
  const last = pts[N - 1];
  return { line, area, endX: last[0], endY: last[1] };
}

const HOLD_MS = 2400;

export function EdgeChart() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const [range, setRange] = useState<Range>("1D");
  const [picked, setPicked] = useState(0); // bumps on a tap, restarting the walk
  const { line, area, endX, endY } = useMemo(() => build(range), [range]);

  useEffect(() => {
    if (!inView) return;
    const id = window.setInterval(() => {
      setRange((r) => RANGES[(RANGES.indexOf(r) + 1) % RANGES.length]);
    }, HOLD_MS);
    return () => window.clearInterval(id);
  }, [inView, picked]);

  const morph = reduce ? { duration: 0 } : { duration: 0.55, ease: EASE_SNAP };
  const slide = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 380, damping: 34 };

  return (
    <div ref={ref} className="ec" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} className="ec-svg">
        <defs>
          {/* In the card's own space, not the path's box: the wash is
              strongest at the line's ceiling and gone well above the
              divider, whatever shape the range is — the clip's look. */}
          <linearGradient id="ec-wash" gradientUnits="userSpaceOnUse" x1="0" y1={TOP} x2="0" y2={DIVIDER - 90}>
            <stop offset="0" stopColor={GREEN} stopOpacity="0.28" />
            <stop offset="0.55" stopColor={GREEN} stopOpacity="0.07" />
            <stop offset="1" stopColor={GREEN} stopOpacity="0" />
          </linearGradient>
        </defs>

        <motion.path d={area} initial={false} animate={{ d: area }} transition={morph} fill="url(#ec-wash)" />
        <line
          x1={X0}
          x2={X1}
          y1={BASE}
          y2={BASE}
          stroke="#8a8f8b"
          strokeOpacity="0.6"
          strokeWidth="3"
          strokeDasharray="10 12"
        />
        <motion.path
          d={line}
          initial={false}
          animate={{ d: line }}
          transition={morph}
          fill="none"
          stroke={GREEN}
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <motion.circle
          cx={endX}
          cy={endY}
          initial={false}
          animate={{ cx: endX, cy: endY }}
          transition={morph}
          r="34"
          fill="none"
          stroke={GREEN}
          strokeOpacity="0.14"
          strokeWidth="3"
        />
        <motion.circle cx={endX} cy={endY} initial={false} animate={{ cx: endX, cy: endY }} transition={morph} r="15" fill={GREEN} />

        <line x1="0" x2={W} y1={DIVIDER} y2={DIVIDER} stroke="#ffffff" strokeOpacity="0.07" strokeWidth="2" />

        {/* attrX, not x: on an SVG element Motion reads `x` as a translate
            and the pill went off the card. */}
        <motion.rect
          x={RAIL_X[range] - PILL_W / 2}
          initial={false}
          animate={{ attrX: RAIL_X[range] - PILL_W / 2 }}
          transition={slide}
          y={RAIL_Y - PILL_H / 2}
          width={PILL_W}
          height={PILL_H}
          rx="30"
          fill={GREEN}
          fillOpacity="0.1"
          stroke={GREEN}
          strokeWidth="3"
        />
        {RANGES.map((r) => (
          <text
            key={r}
            x={RAIL_X[r]}
            y={RAIL_Y}
            className={`ec-label${r === range ? " is-on" : ""}`}
            textAnchor="middle"
            dominantBaseline="central"
            fill={r === range ? GREEN : GREY}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setRange(r);
              setPicked((n) => n + 1);
            }}
          >
            {r}
          </text>
        ))}
      </svg>
    </div>
  );
}
