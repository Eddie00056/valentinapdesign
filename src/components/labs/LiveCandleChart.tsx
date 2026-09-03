import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";

/* Prototype v2 — same concept as LiveLineChart but candlesticks:
   - candles for the elapsed session, up to "now" (PROGRESS across)
   - the last few candles pop; the pulse dot sits at "now"
   - dashed prev-close baseline, bolder past "now", with faint future ticks
   - baseline ~1/4 up from the bottom
   Standalone; nothing here touches AlertCreationScreen. */

const W = 360;
const H = 190;
const PAD = 22;
const N = 96;
const CANDLES = 22;
const START_FROM_BOTTOM = 0.25;
const PROGRESS = 0.56;
const TAIL_CANDLES = 4; // trailing candles at full strength

const UP = "#00C805";
const DOWN = "#FF5A00";
const UP_COOL = "#7ED37B";
const DOWN_COOL = "#FF9E7E";

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

type K = { o: number; c: number; hi: number; lo: number; up: boolean };

export function LiveCandleChart() {
  const reduce = useReducedMotion();

  const model = useMemo(() => {
    const raw = walk(7, N, 0.22, 3.0);
    const per = Math.floor(raw.length / CANDLES);
    const ks: K[] = [];
    for (let i = 0; i < CANDLES; i++) {
      const seg = raw.slice(i * per, i === CANDLES - 1 ? raw.length : (i + 1) * per);
      const o = seg[0];
      const c = seg[seg.length - 1];
      ks.push({ o, c, hi: Math.max(...seg), lo: Math.min(...seg), up: c >= o });
    }
    const v0 = ks[0].o;
    const lo = Math.min(...ks.map((k) => k.lo), v0);
    const hi = Math.max(...ks.map((k) => k.hi), v0);

    const baselineY = PAD + (H - 2 * PAD) * (1 - START_FROM_BOTTOM);
    const spaceUp = baselineY - PAD;
    const spaceDown = H - PAD - baselineY;
    const k = Math.min(
      hi - v0 > 0 ? spaceUp / (hi - v0) : Infinity,
      v0 - lo > 0 ? spaceDown / (v0 - lo) : Infinity,
    );
    const yy = (v: number) => baselineY - (v - v0) * k;

    const endX = W * PROGRESS;
    const slot = endX / CANDLES;
    const bw = Math.min(slot * 0.62, 9);

    const candles = ks.map((c, i) => {
      const cx = i * slot + slot / 2;
      const top = yy(Math.max(c.o, c.c));
      const bot = yy(Math.min(c.o, c.c));
      const hot = i >= CANDLES - TAIL_CANDLES;
      return {
        x: cx - bw / 2,
        y: top,
        w: bw,
        h: Math.max(1.4, bot - top),
        wx: cx,
        wy1: yy(c.hi),
        wy2: yy(c.lo),
        color: c.up ? (hot ? UP : UP_COOL) : hot ? DOWN : DOWN_COOL,
      };
    });

    const last = ks[ks.length - 1];
    return { candles, baselineY, endX, slot, dotY: yy(last.c), dotX: endX };
  }, []);

  const { candles, baselineY, endX, dotY, dotX } = model;

  // faint "future" ticks past now
  const future = Array.from({ length: 5 }, (_, i) => {
    const x = endX + ((W - endX) / 6) * (i + 1);
    return { x, y: baselineY + 8 + i * 4 };
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: "block", overflow: "hidden" }}
      aria-hidden="true"
    >
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

      {future.map((f, i) => (
        <line
          key={i}
          x1={f.x - 4}
          x2={f.x + 4}
          y1={f.y}
          y2={f.y}
          stroke={UP}
          strokeOpacity="0.35"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      ))}

      <motion.g
        initial={reduce ? false : { opacity: 0 }}
        animate={reduce ? undefined : { opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {candles.map((c, i) => (
          <g key={i}>
            <line
              x1={c.wx}
              x2={c.wx}
              y1={c.wy1}
              y2={c.wy2}
              stroke={c.color}
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <rect x={c.x} y={c.y} width={c.w} height={c.h} rx="1" fill={c.color} />
          </g>
        ))}
      </motion.g>

      {!reduce && (
        <motion.circle
          cx={dotX}
          cy={dotY}
          r={3.6}
          fill={UP}
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
      <circle cx={dotX} cy={dotY} r="3.6" fill={UP} />
    </svg>
  );
}
