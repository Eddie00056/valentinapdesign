import { useMemo, useState } from "react";
import { motion, useReducedMotion, MotionConfig } from "motion/react";

/* PROTOTYPE — a Robinhood-ish market chart to replace the baked Framer
   clip in the EdgeMobile / homepage bento.
   - real gradient area fill that fades to transparent (the video's fill
     was a hard-edged block)
   - switching timeframe morphs the path point-to-point with a spring
   - trend flip (up <-> down) crossfades the stroke / fill colour
   Not wired into any page yet. */

const W = 520;
const H = 260;
const PAD_X = 10;
const PAD_Y = 24;
const N = 80; // constant across timeframes so the path can morph

const RANGES = ["1D", "1W", "1M", "3M", "6M", "1Y", "MAX"] as const;
type Range = (typeof RANGES)[number];

const UP = "#48d597";
const DOWN = "#ff557d";

function walk(seed: number, drift: number, vol: number) {
  let s = seed >>> 0;
  let v = 50;
  const out: number[] = [];
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < N; i++) {
    v += drift + (rnd() - 0.5) * vol;
    out.push(v);
  }
  return out;
}

// per-range character: [seed, drift, vol]
const SHAPE: Record<Range, [number, number, number]> = {
  "1D": [7, 0.05, 3.4],
  "1W": [19, 0.14, 2.6],
  "1M": [41, -0.22, 2.2],
  "3M": [88, 0.3, 1.8],
  "6M": [113, 0.42, 1.6],
  "1Y": [204, -0.18, 2.0],
  MAX: [512, 0.55, 1.3],
};

function build(range: Range) {
  const [seed, drift, vol] = SHAPE[range];
  const data = walk(seed, drift, vol);
  const lo = Math.min(...data);
  const hi = Math.max(...data);
  const span = hi - lo || 1;
  const x = (i: number) => PAD_X + (i / (N - 1)) * (W - 2 * PAD_X);
  const y = (v: number) => PAD_Y + (1 - (v - lo) / span) * (H - 2 * PAD_Y);

  const pts = data.map((v, i) => [x(i), y(v)] as const);
  const line = "M" + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L ");
  const area = `${line} L ${x(N - 1).toFixed(1)} ${H} L ${x(0).toFixed(1)} ${H} Z`;
  const up = data[N - 1] >= data[0];
  const baseY = y(data[0]);
  return { line, area, up, baseY };
}

export function MarketChart() {
  const reduce = useReducedMotion();
  const [range, setRange] = useState<Range>("1D");
  const { line, area, up, baseY } = useMemo(() => build(range), [range]);
  const color = up ? UP : DOWN;

  const spring = reduce
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 120, damping: 22, mass: 0.9 };

  return (
    <MotionConfig transition={spring}>
      <div className="mc">
        <svg viewBox={`0 0 ${W} ${H}`} className="mc-svg" role="img" aria-label={`${range} price chart`}>
          <defs>
            <linearGradient id="mc-fill" x1="0" y1="0" x2="0" y2="1">
              <motion.stop offset="0" animate={{ stopColor: color }} stopOpacity="0.22" />
              <motion.stop offset="1" animate={{ stopColor: color }} stopOpacity="0" />
            </linearGradient>
          </defs>

          <line
            x1={PAD_X}
            x2={W - PAD_X}
            y1={baseY}
            y2={baseY}
            stroke="#ffffff"
            strokeOpacity="0.18"
            strokeWidth="1"
            strokeDasharray="2 4"
          />

          <motion.path d={area} animate={{ d: area }} fill="url(#mc-fill)" />
          <motion.path
            d={line}
            animate={{ d: line, stroke: color }}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="mc-tabs" role="tablist">
          {RANGES.map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={r === range}
              className={r === range ? "is-on" : ""}
              style={r === range ? { color } : undefined}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <style>{`
        .mc {
          background: #000;
          border-radius: 24px;
          padding: 20px 20px 14px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .mc-svg { width: 100%; height: auto; display: block; overflow: visible; }
        .mc-tabs {
          display: flex;
          justify-content: space-between;
          gap: 4px;
        }
        .mc-tabs button {
          appearance: none;
          background: none;
          border: 0;
          padding: 6px 10px;
          border-radius: 8px;
          font: inherit;
          font-size: 0.8125rem;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: #7d7d7d;
          cursor: pointer;
          transition: color 0.15s ease, background 0.15s ease;
        }
        .mc-tabs button:hover { color: #d0d0d0; }
        .mc-tabs button.is-on { background: rgba(255,255,255,0.06); }
      `}</style>
    </MotionConfig>
  );
}
