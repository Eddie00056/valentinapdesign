import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

/* Robinhood-style stats block for the alert screen:
   - Bid / Ask with a live depth bar (bid vs ask size), tick-driven, up top
   - a single divider
   - every other stat below it, one even spacing, no further dividers
   Standalone on /work/stats-lab; embedded in AlertCreationScreen driven by
   the shared price clock (pass `tick` / `bidPrice` / `askPrice` / `up` / `down`
   so it stays in sync and on-palette). */

const TICK_MS = 1500;
const MUTED = "#8e97ad";
const VAL = "#f2f2f8";
const DIVIDER = "rgba(255,255,255,0.09)";

// bid/ask size sequences — deterministic, small moves
const BID_SEQ = [3, 4, 3, 5, 4, 6, 4, 3];
const ASK_SEQ = [1, 2, 1, 1, 3, 2, 4, 2];

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

  // Raw split can swing ~43->83%. Pull it toward 50/50 (COMPRESS) and cap the
  // travel (BAND) so a big size move nudges the bar rather than throwing it.
  const COMPRESS = 0.4;
  const BAND = 14; // max % either side of centre
  const rawPct = (bid / (bid + ask)) * 100;
  const bidPct = Math.max(
    50 - BAND,
    Math.min(50 + BAND, 50 + (rawPct - 50) * COMPRESS),
  );

  // gentle, slightly overdamped spring — glides to the new width, no snap/bounce
  const spring = {
    type: "spring" as const,
    stiffness: 90,
    damping: 22,
    mass: 1,
  };

  return (
    <div style={{ fontFamily: "'Open Sans', Helvetica, Arial, sans-serif" }}>
      {/* Bid / Ask + depth bar */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <div>
          <span style={{ color: MUTED }}>Bid </span>
          <span style={{ color: VAL, fontVariantNumeric: "tabular-nums" }}>{bidPrice}</span>
          <span style={{ color: MUTED }}> &times;{bid}</span>
        </div>
        <div>
          <span style={{ color: MUTED }}>Ask </span>
          <span style={{ color: VAL, fontVariantNumeric: "tabular-nums" }}>{askPrice}</span>
          <span style={{ color: MUTED }}> &times;{ask}</span>
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

      {/* divider — bid/ask + its visual sit above; everything else below.
          bottom margin + the first row's 9px top padding == the 18px gap above */}
      <div style={{ height: 1, background: DIVIDER, margin: "18px 0 9px" }} />

      {/* stat rows — no further dividers, even spacing */}
      <div>
        <Row>
          <Cell k="Bid size" v={String(bid)} />
          <Cell k="Ask size" v={String(ask)} />
        </Row>
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
        padding: "9px 0",
      }}
    >
      {children}
    </div>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
      <span style={{ color: MUTED }}>{k}</span>
      <span style={{ color: VAL, fontVariantNumeric: "tabular-nums" }}>{v}</span>
    </div>
  );
}
