import { useEffect, useRef, useState } from "react";
import type React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import "./order-bar.css";

/* ------------------------------------------------------------------
   OrderBar — the platform's one-row market entry, shared by the ladder
   and the chart (user, 2026-11-05).

   Buy · Qty · Sell, in the platform's filled plates and −/+ stepper.
   The quantity sizes every order its surface sends, and two props
   carry that without adding height:
     order="lead"  the field leads the row — Qty · Buy · Sell — so the
                   reading order says "size, then act"; no label
     hint="…"      a tooltip on the field says what it governs

   Owns its tokens (the platform's values as fallbacks, so a host's
   win), type and button reset, so it drops into any surface.
------------------------------------------------------------------ */

export type OrderBarProps = {
  qty: number;
  onQty: (n: number) => void;
  onBuy: () => void;
  onSell: () => void;
  /** "split" is the reference's Buy · Qty · Sell; "lead" puts Qty first. */
  order?: "split" | "lead" | "trail";
  /** "fill" stretches across its host (the ladder); "compact" sizes to
      content (a chart overlay). */
  fit?: "fill" | "compact";
  /** "market" on the ladder; the chart's "MKT". */
  label?: "market" | "MKT";
  /** Tooltip on the quantity field. */
  hint?: string;
  /** Extra controls after the row — the chart's Flatten. */
  trailing?: React.ReactNode;
  /** Shared-layout id for the field, so a host can fly it between homes. */
  layoutId?: string;
  max?: number;
  /** Market actions unavailable (e.g. outside regular hours). With
      `explain`, they wear an off state and a press says why; without,
      they look live and silently do nothing — the platform's current
      behaviour, kept for comparison. */
  blocked?: { reason: string; explain: boolean };
  /** No shares to sell: the sell button becomes "Short", still live, and
      hover says what that means. */
  short?: { note: string };
};

export function OrderBar({
  qty,
  onQty,
  onBuy,
  onSell,
  order = "split",
  fit = "fill",
  label = "market",
  hint,
  trailing,
  layoutId,
  max = 999,
  blocked,
  short,
}: OrderBarProps) {
  const reduce = useReducedMotion();
  const clamp = (n: number) => Math.min(max, Math.max(1, n));
  const [why, setWhy] = useState<"buy" | "sell" | null>(null);
  useEffect(() => {
    if (!why) return;
    const t = window.setTimeout(() => setWhy(null), 4000);
    return () => clearTimeout(t);
  }, [why]);
  useEffect(() => {
    if (!blocked) setWhy(null);
  }, [blocked]);

  const act = (side: "buy" | "sell") => {
    const shorting = side === "sell" && !!short;
    const off = blocked?.explain;
    /* The session rule, if any, wins the tip; else a short explains itself. */
    const reason = blocked?.reason ?? (shorting ? short!.note : undefined);
    return (
      <span
        className="ob-act-host"
        /* lead: Qty·Buy·Sell · split: Buy·Qty·Sell · trail: Buy·Sell·Qty */
        style={{ order: side === "buy" ? (order === "lead" ? 2 : 1) : order === "trail" ? 2 : 3 }}
        onPointerEnter={shorting && !blocked ? () => setWhy(side) : undefined}
        onPointerLeave={() => setWhy(null)}
      >
        <button
          type="button"
          className="ob-act"
          data-side={side}
          data-off={off || undefined}
          data-short={shorting || undefined}
          aria-disabled={blocked ? true : undefined}
          aria-description={off || shorting ? reason : undefined}
          onClick={() => {
            if (!blocked) {
              setWhy(null);
              return side === "buy" ? onBuy() : onSell();
            }
            if (off) setWhy((w) => (w === side ? null : side));
          }}
          onBlur={() => setWhy(null)}
        >
          {side === "buy" ? "Buy" : shorting ? "Short" : "Sell"}{" "}
          {/* Long and short labels; the host's width picks one (the
              platform says "MKT" in narrower widgets). */}
          <span className="ob-l-long">{label}</span>
          <span className="ob-l-short">MKT</span>
        </button>
        <AnimatePresence>
          {why === side && reason && (
            <motion.span
              role="status"
              className="ob-tip ob-tip--wrap"
              data-side={side}
              initial={reduce ? false : { opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
              transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }}
            >
              {reason}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    );
  };

  const field = (
    <span className="ob-step">
      <button
        type="button"
        className="ob-step-btn"
        aria-label="Decrement"
        disabled={qty <= 1}
        onClick={() => onQty(clamp(qty - 1))}
      >
        <svg width={8} height={8} viewBox="0 0 8 8" aria-hidden="true">
          <path d="M.7 3.5h6.6v1H.7z" fill="currentColor" />
        </svg>
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label="Quantity"
        aria-description={hint}
        autoComplete="off"
        value={qty}
        onChange={(e) => {
          const v = parseInt(e.target.value.replace(/\D/g, ""), 10);
          onQty(Number.isFinite(v) ? clamp(v) : 1);
        }}
      />
      <button
        type="button"
        className="ob-step-btn"
        aria-label="Increment"
        disabled={qty >= max}
        onClick={() => onQty(clamp(qty + 1))}
      >
        <svg width={8} height={8} viewBox="0 0 8 8" aria-hidden="true">
          <path d="M3.5.7h1v2.8h2.8v1H4.5v2.8h-1V4.5H.7v-1h2.8z" fill="currentColor" />
        </svg>
      </button>
    </span>
  );

  return (
    <div className="ob" data-fit={fit} data-order={order}>
      {act("buy")}
      {/* Visual order by CSS `order`, DOM order fixed, so the field keeps
          its identity (and focus) across a switch and can fly. */}
      <motion.div
        layoutId={layoutId}
        layout={layoutId && !reduce ? true : undefined}
        transition={{ type: "spring", stiffness: 300, damping: 34 }}
        className="ob-qty"
        style={{ order: order === "lead" ? 1 : order === "trail" ? 3 : 2 }}
      >
        {hint ? <Tip text={hint}>{field}</Tip> : field}
      </motion.div>
      {act("sell")}
      {trailing && <span className="ob-trail">{trailing}</span>}
    </div>
  );
}

/** The platform's plain tooltip: a solid raised card, one line of
    white text, under its trigger after a short rest. Hover or focus. */
function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const t = useRef<number | null>(null);
  const show = () => {
    if (t.current) clearTimeout(t.current);
    t.current = window.setTimeout(() => setOpen(true), 350);
  };
  const hide = () => {
    if (t.current) clearTimeout(t.current);
    setOpen(false);
  };
  useEffect(() => () => void (t.current && clearTimeout(t.current)), []);

  return (
    <span
      className="ob-tip-host"
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(e) => e.key === "Escape" && hide()}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            className="ob-tip"
            initial={reduce ? false : { opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }}
          >
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
