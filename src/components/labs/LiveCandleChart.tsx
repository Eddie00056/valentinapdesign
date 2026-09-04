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

const W_DEF = 360;
const H_DEF = 190;
const PAD_DEF = 22;
const N = 96;
const CANDLES = 22;
const START_FROM_BOTTOM = 0.25;
const PROGRESS = 0.56;
const TAIL_CANDLES = 8; // trailing candles at full strength
const BASE_PRICE = 772.76;
const TICK_MS = 1500;
const TICK_UNIT = 0.01; // price per tick
const TICK_PX = 2; // pixels the line / candle moves per tick (small)
const SEQ = [1, -1, 2, -2]; // fixed price-move sequence, looped

const UP = "#00C805";
const DOWN = "#FF5A00";
const UP_COOL = "#7ED37B";
const DOWN_COOL = "#FF9E7E";

// one transition for every "now" element so the line, pill and forming candle
// settle together — and matched by LiveStats' depth bar so the whole readout
// moves as a unit on each price tick. Slightly overdamped, ~0.65s, no bounce.
const SYNC = { type: "spring" as const, stiffness: 80, damping: 20, mass: 1 };

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

type Props = {
  /** svg viewBox width / height — lets the alert screen mount it in a short, wide box */
  w?: number;
  h?: number;
  pad?: number;
  /** baseline (prev-close) dash colour — dark surfaces need a light stroke */
  baselineStroke?: string;
  /** gate the static-candle fade-in on the host's draw phase */
  drawIn?: boolean;
  /** live price from the host. When set, the chart drops its own tick sim and
      the "now" line / forming candle follow this instead — keeps it in sync
      with a price readout rendered elsewhere. */
  price?: number;
  /** day's previous close — colours the "now" line / pill to match a header change */
  prevClose?: number;
  /** pixels per $1 of move when driven by `price` — small, so "now" holds its spot */
  unitPx?: number;
  /** up / down accent — override so the "now" line + hot candles match a host palette */
  upColor?: string;
  downColor?: string;
  /** draw the forming candle past the series. Off for the alert screen, where
      "now" is just the dotted line + pill and a trailing candle reads as junk. */
  forming?: boolean;
  /** opacity of the non-hot (older) candles — lower = more faded */
  coolFade?: number;
  /** draw the prev-close baseline dash. Off for the alert screen. */
  baseline?: boolean;
  /** live mode: the "now" line + pill + tick sim. Off for historical
      timeframes — the series just fills the width, static, no price element. */
  live?: boolean;
  /** pull the "now" pill + line-end in from the right edge (px). Use when the
      host clips the chart's right bleed and the pill would be cut off. */
  pillInset?: number;
  /** where the baseline / series sits: fraction of the plot height up from the
      bottom. Lower = candles sit lower, less dead space beneath them. */
  startFromBottom?: number;
};

export function LiveCandleChart({
  w = W_DEF,
  h = H_DEF,
  pad = PAD_DEF,
  baselineStroke = "rgba(0,0,0,0.16)",
  drawIn = true,
  price: extPrice,
  prevClose,
  unitPx = 6,
  upColor = UP,
  downColor = DOWN,
  forming = true,
  coolFade = 1,
  baseline = true,
  startFromBottom = START_FROM_BOTTOM,
  live = true,
  pillInset = 0,
}: Props = {}) {
  const W = w;
  const H = h;
  const PAD = pad;
  const reduce = useReducedMotion();
  const external = extPrice != null;
  // ticks = current level; hi/lo = running extremes of the forming candle
  const [tk, setTk] = useState({ now: 0, hi: 0, lo: 0 });
  const idxRef = useRef(0);

  // external-price mode: anchor the forming candle's open at the first price we
  // see, then track how far above/below it we've traded (in $).
  const anchorRef = useRef<number | null>(null);
  if (external && anchorRef.current == null) anchorRef.current = extPrice!;
  const [ext, setExt] = useState({ hi: 0, lo: 0 });

  useEffect(() => {
    if (!external) return;
    const d = extPrice! - (anchorRef.current ?? extPrice!);
    setExt((e) => ({ hi: Math.max(e.hi, d), lo: Math.min(e.lo, d) }));
  }, [external, extPrice]);

  useEffect(() => {
    if (external || reduce || !live) return;
    const id = window.setInterval(() => {
      const delta = SEQ[idxRef.current % SEQ.length];
      idxRef.current += 1;
      setTk((t) => {
        const now = t.now + delta;
        return { now, hi: Math.max(t.hi, now), lo: Math.min(t.lo, now) };
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [external, reduce, live]);

  const model = useMemo(() => {
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

    const baselineY = PAD + (H - 2 * PAD) * (1 - startFromBottom);
    const spaceUp = baselineY - PAD;
    const spaceDown = H - PAD - baselineY;
    const k = Math.min(
      hi - v0 > 0 ? spaceUp / (hi - v0) : Infinity,
      v0 - lo > 0 ? spaceDown / (v0 - lo) : Infinity,
    );
    const yy = (v: number) => baselineY - (v - v0) * k;

    // live: series stops at "now" (~56% across). static: fill the width.
    const endX = W * (live ? PROGRESS : 0.96);
    const slot = endX / CANDLES;
    const bw = Math.min(slot * 0.62, 9);

    const candles = ks.map((c, i) => {
      const cx = i * slot + slot / 2;
      const top = yy(Math.max(c.o, c.c));
      const bot = yy(Math.min(c.o, c.c));
      // static (historical) view: every candle full-strength, no fade / tail
      const hot = !live || i >= CANDLES - TAIL_CANDLES;
      return {
        x: cx - bw / 2,
        y: top,
        w: bw,
        h: Math.max(1.4, bot - top),
        wx: cx,
        wy1: yy(c.hi),
        wy2: yy(c.lo),
        hot,
        color: c.up ? (hot ? upColor : UP_COOL) : hot ? downColor : DOWN_COOL,
      };
    });

    return {
      candles,
      baselineY,
      baseY: yy(ks[ks.length - 1].c),
      liveX: endX + slot * 0.5,
      bw,
    };
  }, [W, H, PAD, upColor, downColor, startFromBottom, live]);

  const { candles, baselineY, baseY, liveX, bw } = model;

  const clampY = (y: number) => Math.max(8, Math.min(H - 8, y));

  // external $ offset from the anchor — computed inline (not via useEffect) so
  // the "now" line + pill land in the SAME render as the host price, keeping
  // them in lockstep with the bid/ask readout and depth bar.
  const dNow = external ? extPrice! - (anchorRef.current ?? extPrice!) : 0;

  // "now" always continues from the last static candle's close (`baseY`) — in
  // external mode it just wiggles from there as the host price moves. `unitPx`
  // is deliberately small so the forming candle stays put, like the sim did.
  const dispPrice = external ? extPrice! : BASE_PRICE + tk.now * TICK_UNIT;
  const openY = baseY; // candle opened at the base level
  const priceY = external
    ? clampY(baseY - dNow * unitPx)
    : baseY - tk.now * TICK_PX; // = forming candle's close
  const hiY = external
    ? clampY(baseY - Math.max(ext.hi, dNow) * unitPx)
    : baseY - tk.hi * TICK_PX; // running high (lowest y)
  const loY = external
    ? clampY(baseY - Math.min(ext.lo, dNow) * unitPx)
    : baseY - tk.lo * TICK_PX; // running low
  const bodyTop = Math.min(openY, priceY);
  const bodyH = Math.max(1.4, Math.abs(priceY - openY));
  const liveUp = priceY <= openY;
  const liveColor = liveUp ? upColor : downColor;
  // the "now" line + pill: in external mode colour by the day's change so it
  // tracks the header; otherwise it's always the hot green of the prototype.
  const nowColor =
    external && prevClose != null && extPrice! < prevClose ? downColor : upColor;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: "block", overflow: "visible" }}
      aria-hidden="true"
    >
      {baseline && (
        <line
          x1="0"
          x2={W}
          y1={baselineY}
          y2={baselineY}
          stroke={baselineStroke}
          strokeWidth="1"
          strokeDasharray="0.75 4"
          strokeLinecap="round"
        />
      )}

      <motion.g
        initial={reduce ? false : { opacity: 0 }}
        animate={reduce || drawIn ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {candles.map((c, i) => (
          <g key={i} opacity={c.hot ? 1 : coolFade}>
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

      {/* the forming candle — builds as the price ticks; wick extends if it
          makes a new high/low */}
      {forming && (
        <>
          <motion.line
            x1={liveX}
            x2={liveX}
            initial={false}
            animate={{ y1: hiY, y2: loY }}
            transition={reduce ? { duration: 0 } : SYNC}
            stroke={liveColor}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <motion.rect
            x={liveX - bw / 2}
            width={bw}
            rx="1"
            initial={false}
            animate={{ y: bodyTop, height: bodyH }}
            transition={reduce ? { duration: 0 } : SYNC}
            fill={liveColor}
          />
        </>
      )}

      {/* "now" — dotted price line + axis pill. Live timeframes only. */}
      {live && (
        <motion.g
          initial={false}
          animate={{ y: priceY }}
          transition={reduce ? { duration: 0 } : SYNC}
        >
          <line
            x1="0"
            x2={W - 44 - pillInset}
            y1="0"
            y2="0"
            stroke={nowColor}
            strokeWidth="1.2"
            strokeDasharray="1 3"
            strokeLinecap="round"
          />
          <rect x={W - 44 - pillInset} y={-9} width="46" height="18" rx="9" fill={nowColor} />
          <text
            x={W - 21 - pillInset}
            y="4"
            textAnchor="middle"
            fontSize="10"
            fontWeight="700"
            fill="#fff"
            fontFamily="-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
          >
            {dispPrice.toFixed(2)}
          </text>
        </motion.g>
      )}
    </svg>
  );
}
