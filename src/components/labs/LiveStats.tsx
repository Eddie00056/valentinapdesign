import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

/* Prototype — Robinhood-style stats block for the alert screen:
   - Bid / Ask with a live depth bar (bid vs ask size), tick-driven
   - stat rows below, no group dividers, one even spacing throughout
   - stat rows below with NO group dividers, one even spacing throughout
   Same tick logic as the candlestick prototype. Standalone. */

const TICK_MS = 1500;
const GREEN = "#48d597";
const RED = "#ff557d";
const MUTED = "#8e97ad";
const VAL = "#f2f2f8";

// bid/ask size sequences — deterministic, small moves
const BID_SEQ = [3, 4, 3, 5, 4, 6, 4, 3];
const ASK_SEQ = [1, 2, 1, 1, 3, 2, 4, 2];

const rows: [string, string, string, string][] = [
  ["Bid size", "3", "Ask size", "1"],
  ["Open", "$191.78", "Prev close", "$194.70"],
  ["Volume", "68M", "Avg volume", "79M"],
  ["Market cap", "1.62T", "Shares", "506.44M"],
  ["Dividends", "$5.34", "Yield", "1.24%"],
  ["EPS", "24.00", "P/E", "78.00"],
  ["Ex-date", "06 Nov 2020", "Earnings date", "26 May 2021"],
];

export function LiveStats() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const idx = useRef(0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      idx.current += 1;
      setI(idx.current);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [reduce]);

  const bid = BID_SEQ[i % BID_SEQ.length];
  const ask = ASK_SEQ[i % ASK_SEQ.length];
  const bidPct = (bid / (bid + ask)) * 100;

  const spring = { type: "spring" as const, stiffness: 260, damping: 30 };

  return (
    <div style={{ fontFamily: "'Open Sans', Helvetica, Arial, sans-serif" }}>
      {/* Bid / Ask + depth bar */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <div>
          <span style={{ color: MUTED }}>Bid </span>
          <span style={{ color: VAL, fontVariantNumeric: "tabular-nums" }}>$194.28</span>
          <span style={{ color: MUTED }}> &times;{bid}</span>
        </div>
        <div>
          <span style={{ color: MUTED }}>Ask </span>
          <span style={{ color: VAL, fontVariantNumeric: "tabular-nums" }}>$194.30</span>
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
          style={{ background: GREEN, borderRadius: 2 }}
          animate={{ width: `${bidPct}%` }}
          transition={reduce ? { duration: 0 } : spring}
        />
        <motion.div
          style={{ background: RED, borderRadius: 2, flex: 1 }}
          transition={reduce ? { duration: 0 } : spring}
        />
      </div>

      {/* stat rows — no dividers, even spacing */}
      <div style={{ marginTop: 24 }}>
        {rows.map(([a, b, c, d], ri) => (
          <div
            key={ri}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              padding: "9px 0",
            }}
          >
            <Cell k={a} v={b} />
            <Cell k={c} v={d} />
          </div>
        ))}
      </div>
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
