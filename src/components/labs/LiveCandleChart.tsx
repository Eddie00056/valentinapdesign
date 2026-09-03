import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

/* Prototype v2 — candlesticks, Robinhood "advanced" style:
   - candles for the elapsed session, up to "now" (PROGRESS across)
   - the last few candles pop; the rest are the cool green/red
   - "now" = a green DOTTED price line across the full width + a price pill
     on the right axis. It moves only when the price ticks: every TICK_MS a
     small delta comes in, the line snaps to the new level, then holds.
   - dashed prev-close baseline, ~1/4 up from the bottom
   Standalone; nothing here touches AlertCreationScreen. */

const W = 360;
const H = 190;
const PAD = 22;
const N = 96;
const CANDLES = 22;
const START_FROM_BOTTOM = 0.25;
const PROGRESS = 0.56;
const TAIL_CANDLES = 8; // trailing candles at full strength
const BASE_PRICE = 772.76;
const TICK_MS = 1500;
const TICK_UNIT = 0.01; // price per tick
const TICK_PX = 9; // pixels the dotted line moves per tick
const SEQ = [1, -1, 2, -2]; // fixed price-move sequence, looped

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
  const [ticks, setTicks] = useState(0); // cumulative ticks from BASE_PRICE
  const idxRef = useRef(0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      const delta = SEQ[idxRef.current % SEQ.length];
      idxRef.current += 1;
      setTicks((t) => t + delta);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [reduce]);

  const { candles, baselineY, baseY } = useMemo(() => {
    const raw = walk(7, N, 0.22, 3.0);
    const per = Math.floor(raw.length / CANDLES);
    const ks: K[] = [];
    for (let i = 0; i < CANDLES; i++) {
      const seg = raw.slice(
        i * per,
        i === CANDLES - 1 ? raw.length : (i + 1) * per,
      );
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

    return { candles, baselineY, baseY: yy(ks[ks.length - 1].c) };
  }, []);

  const price = BASE_PRICE + ticks * TICK_UNIT;
  const priceY = baseY - ticks * TICK_PX;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: "block", overflow: "visible" }}
      aria-hidden="true"
    >
      <line
        x1="0"
        x2={W}
        y1={baselineY}
        y2={baselineY}
        stroke="rgba(0,0,0,0.16)"
        strokeWidth="1"
        strokeDasharray="0.75 4"
        strokeLinecap="round"
      />

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

      {/* "now" — dotted price line + axis pill. Moves only on a tick. */}
      <motion.g
        initial={false}
        animate={{ y: priceY }}
        transition={{ duration: reduce ? 0 : 0.45, ease: [0.33, 1, 0.68, 1] }}
      >
        <line
          x1="0"
          x2={W - 44}
          y1="0"
          y2="0"
          stroke={UP}
          strokeWidth="1.2"
          strokeDasharray="1 3"
          strokeLinecap="round"
        />
        <rect x={W - 44} y={-9} width="46" height="18" rx="9" fill={UP} />
        <text
          x={W - 21}
          y="4"
          textAnchor="middle"
          fontSize="10"
          fontWeight="700"
          fill="#fff"
          fontFamily="-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
        >
          {price.toFixed(2)}
        </text>
      </motion.g>
    </svg>
  );
}
