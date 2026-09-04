import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

/* Robinhood-style stats block for the alert screen:
   - Bid / Ask with a live depth bar (bid vs ask size), tick-driven, up top
   - every other stat directly below, one even spacing, no dividers
   Standalone on /work/stats-lab; embedded in AlertCreationScreen driven by
   the shared price clock (pass `tick` / `bidPrice` / `askPrice` / `up` / `down`
   so it stays in sync and on-palette). */

const TICK_MS = 2200; // matches priceHub PX_STEP for the standalone lab
const MUTED = "#8e97ad";
const VAL = "#f2f2f8";
const FS = 12; // one type size for the whole readout (label + value)
const ROW_PAD = 9; // vertical padding per stat row

// bid/ask size sequences — deterministic, small moves. Start even (3/3) so the
// depth bar sits dead centre at rest, then nudge ±1 either way.
const BID_SEQ = [3, 4, 3, 4, 5, 4, 3, 4];
const ASK_SEQ = [3, 3, 4, 4, 3, 4, 4, 3];

// rows under the divider; the live bid/ask sizes are prepended as the first row
const rows: [string, string, string, string][] = [
  ["Open", "$191.78", "Prev close", "$194.70"],
  ["Volume", "68M", "Avg volume", "79M"],
  ["Market cap", "1.62T", "Shares", "506.44M"],
  ["Dividends", "$5.34", "Yield", "1.24%"],
  ["EPS", "24.00", "P/E", "78.00"],
  ["Ex-date", "06 Nov 2020", "Earnings date", "26 May 2021"],
];

type Props = {
  /** external tick index — when set, no internal interval; sizes follow this */
  tick?: number;
  bidPrice?: string;
  askPrice?: string;
  /** up / down accent — pass the host palette so the bar matches everything else */
  up?: string;
  down?: string;
};

export function LiveStats({
  tick,
  bidPrice = "$194.28",
  askPrice = "$194.30",
  up = "#48d597",
  down = "#ff557d",
}: Props = {}) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const idx = useRef(0);
  const external = tick != null;

  useEffect(() => {
    if (external || reduce) return;
    const id = window.setInterval(() => {
      idx.current += 1;
      setI(idx.current);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [external, reduce]);

  const step = external ? tick! : i;
  const bid = BID_SEQ[step % BID_SEQ.length];
  const ask = ASK_SEQ[step % ASK_SEQ.length];

  // Balanced around 50: pull the raw split toward centre (COMPRESS) and cap the
  // travel (BAND) so it nudges rather than swings. bid == ask -> exactly 50.
  const COMPRESS = 0.5;
  const BAND = 10; // max % either side of centre
  const rawPct = bid + ask > 0 ? (bid / (bid + ask)) * 100 : 50;
  const bidPct = Math.max(
    50 - BAND,
    Math.min(50 + BAND, 50 + (rawPct - 50) * COMPRESS),
  );

  // matches LiveCandleChart's SYNC spring so the bar, the chart's "now" line
  // and the pill all settle together on each price tick. ~0.65s, no bounce.
  const spring = {
    type: "spring" as const,
    stiffness: 80,
    damping: 20,
    mass: 1,
  };

  return (
    <div style={{ fontFamily: "'Open Sans', Helvetica, Arial, sans-serif" }}>
      {/* Bid / Ask + depth bar */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: FS }}>
        <div>
          <span style={{ color: MUTED }}>Bid </span>
          <span style={{ color: VAL, fontVariantNumeric: "tabular-nums" }}>{bidPrice}</span>
          <span style={{ color: MUTED }}>{" × "}{bid}</span>
        </div>
        <div>
          <span style={{ color: MUTED }}>Ask </span>
          <span style={{ color: VAL, fontVariantNumeric: "tabular-nums" }}>{askPrice}</span>
          <span style={{ color: MUTED }}>{" × "}{ask}</span>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: 3,
          height: 6,
          marginTop: 8,
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <motion.div
          style={{ background: up, borderRadius: 2 }}
          animate={{ width: `${bidPct}%` }}
          transition={reduce ? { duration: 0 } : spring}
        />
        <motion.div
          style={{ background: down, borderRadius: 2, flex: 1 }}
          transition={reduce ? { duration: 0 } : spring}
        />
      </div>

      {/* stat rows — no divider; sit tight under the depth bar. Bid/ask size
          live in the header row above, so they're not repeated here. */}
      <div style={{ marginTop: 2 }}>
        {rows.map(([a, b, c, d], ri) => (
          <Row key={ri}>
            <Cell k={a} v={b} />
            <Cell k={c} v={d} />
          </Row>
        ))}
      </div>
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        padding: `${ROW_PAD}px 0`,
      }}
    >
      {children}
    </div>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: FS }}>
      <span style={{ color: MUTED }}>{k}</span>
      <span style={{ color: VAL, fontVariantNumeric: "tabular-nums" }}>{v}</span>
    </div>
  );
}
