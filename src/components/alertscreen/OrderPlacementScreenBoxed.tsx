import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { pxHub, PX_BASE } from "./priceHub";
import type { PriceState } from "./priceHub";
import { UP, DOWN } from "./chart";
import { FractionalIcon, GlassButton } from "../glasslab/GlassButton";
import "../glasslab/glass-button.css";
// pulls in the rollUpA/B + rollDownA/B keyframes the price roll below uses
// (ported verbatim from the quote screen).
import "./alert-screen.css";
import { PhoneFrame, PhoneStage } from "./PhoneFrame";

/* Order placement — "boxed field" variation of OrderPlacementScreen.
   Everything above the order form (drawer handle, ticker, price roll,
   bid/ask pill, footer) is identical to the divider-row version; the order
   form itself trades the borderless divider-row list for individually
   bordered, rounded input fields — the treatment from the AmountStepper
   reference, adapted from its light theme to this screen's dark palette. */

const SYMBOL = "DASH";
const PREV_CLOSE = 192.91;
const MUTED = "#8e97ad";
const VAL = "#f2f2f8";
const BORDER_DIM = "#23262c";

function fmt(n: number) {
  return n.toFixed(2);
}

export function OrderPlacementScreenBoxed() {
  const [s, setS] = useState<PriceState>({ price: PX_BASE, prev: PX_BASE, dir: 0, n: 0 });
  const [qty] = useState(2);
  const [qtyType, setQtyType] = useState<"shares" | "dollars">("shares");
  const [qtyMenuOpen, setQtyMenuOpen] = useState(false);

  const [fracOpen, setFracOpen] = useState(false);

  useEffect(() => {
    const unsub = pxHub().subscribe(setS);
    return unsub;
  }, []);

  useEffect(() => {
    if (!qtyMenuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setQtyMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [qtyMenuOpen]);

  const bidPx = s.price - 0.01;
  const askPx = s.price + 0.01;

  const delta = s.price - PREV_CLOSE;
  const sign = delta >= 0 ? "+" : "−";
  const changeColor = delta >= 0 ? UP : DOWN;
  const changeText = `${sign}${fmt(Math.abs(delta))} (${sign}${fmt(Math.abs((delta / PREV_CLOSE) * 100))}%)`;

  // price roll — ported verbatim from the quote screen (AlertCreationScreen):
  // each character gets its own two-line roll, driven by the price clock's
  // tick counter (`s.n` here is the same value AlertCreationScreen calls `pn`).
  const next = "$" + s.price.toFixed(2);
  const prevStr = ("$" + s.prev.toFixed(2)).padStart(next.length, " ");
  const rising = s.price >= s.prev;
  const rollName = rising
    ? s.n % 2
      ? "rollUpA"
      : "rollUpB"
    : s.n % 2
      ? "rollDownA"
      : "rollDownB";
  const chars = next.split("").map((ch, i) => {
    const p = prevStr[i] ?? ch;
    const changed = s.n > 0 && p !== ch;
    const flash = changed && s.dir !== 0;
    return {
      top: rising ? (changed ? p : ch) : ch,
      bottom: rising ? ch : changed ? p : ch,
      color: flash ? (s.dir === 1 ? UP : DOWN) : "#ffffff",
      anim: changed ? rollName + " 560ms cubic-bezier(.2,.8,.25,1) both" : "none",
    };
  });

  const total = s.price * qty;

  return (
    <PhoneStage>
      <PhoneFrame
        fadeAt={100}
        footer={
          // pinned to the bottom of the screen area, outside the scrolling
          // content — the site's shared glass-pill buttons (glasslab/GlassButton),
          // same red/green semantics as everywhere else on the site.
          <div className="dark" style={{ marginTop: 10, display: "flex", gap: 10 }}>
            <GlassButton variant="red" size="mobile" block>
              Sell
            </GlassButton>
            <GlassButton variant="green" size="mobile" block>
              Buy
            </GlassButton>
          </div>
        }
      >
        <div style={{ position: "relative" }}>
          {/* native iOS drawer handle — this screen presents as a sheet, not
              a pushed page. */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ width: 36, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.3)" }} />
          </div>

          {/* ticker — a straight copy of the quote screen: just the symbol
              (no company name, matching the live page), the fractional-shares
              icon riding along on the right instead of its own icon row. */}
          <div style={{ marginTop: 14, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: VAL }}>{SYMBOL}</span>
            <button
              aria-label="Fractional shares"
              onClick={() => setFracOpen((o) => !o)}
              className="opb-frac-btn"
              style={{
                flex: "none",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                // same glass `light`-icon-button treatment as the header icon
                // on the quote screen (AlertCreationScreen's fracGlass) —
                // not a flat transparent circle.
                background:
                  "linear-gradient(66deg, rgba(255,255,255,0.1), rgba(255,255,255,0.045))",
                boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
                color: fracOpen ? UP : "rgba(255,255,255,0.9)",
              }}
            >
              <FractionalIcon />
            </button>
          </div>
          <style>{`.opb-frac-btn svg { width: 16px; height: 16px; }`}</style>

          <AnimatePresence initial={false}>
            {fracOpen && (
              <motion.div
                key="frac-banner"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                style={{ overflow: "hidden" }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setFracOpen(false)}
                  style={{
                    marginTop: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.06)",
                    color: VAL,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    Fractional shares available for {SYMBOL} market orders
                  </span>
                  <span aria-hidden="true" style={{ flex: "none", lineHeight: 0, opacity: 0.6 }}>
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M1.6 1.6l10.8 10.8M12.4 1.6L1.6 12.4"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ marginTop: 2, display: "flex", gap: 4, alignItems: "flex-end" }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                fontSize: 18,
                fontWeight: 600,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {chars.map((ch, i) => (
                <div
                  key={i}
                  style={{
                    overflow: "hidden",
                    height: 22,
                    color: ch.color,
                    transition: "color 760ms cubic-bezier(.4,0,.2,1)",
                  }}
                >
                  <div style={{ display: "block", animation: ch.anim }}>
                    <span style={{ height: 22, display: "flex", alignItems: "flex-end", justifyContent: "center", boxSizing: "border-box" }}>
                      {ch.top}
                    </span>
                    <span style={{ height: 22, display: "flex", alignItems: "flex-end", justifyContent: "center", boxSizing: "border-box" }}>
                      {ch.bottom}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <span
              style={{
                fontSize: 14,
                fontWeight: 400,
                height: 22,
                display: "flex",
                alignItems: "flex-end",
                lineHeight: 1,
                color: changeColor,
                transition: "color 520ms ease",
              }}
            >
              {changeText}
            </span>
          </div>

          {/* bid / ask — one seamless pill, deep-tinted halves with the
              label + live price both set in the accent colour. */}
          <div style={{ marginTop: 16, height: 22, display: "flex", borderRadius: 6, overflow: "hidden" }}>
            <BidAskHalf label="Bid" price={bidPx} tint="rgba(72,213,151,0.14)" accent={UP} />
            <BidAskHalf label="Ask" price={askPx} tint="rgba(255,85,125,0.14)" accent={DOWN} />
          </div>

          {/* order form — each row is label left / bordered rounded box right
              (the AmountStepper treatment). A single CSS grid ("1fr auto")
              wraps every row so the box column shares one width across all
              of them, sized to the widest box (Account's "Individual
              Margin") — instead of each box hugging its own content. */}
          <div
            style={{
              marginTop: 22,
              position: "relative",
              display: "grid",
              gridTemplateColumns: "1fr auto",
              alignItems: "center",
              rowGap: 10,
              columnGap: 12,
            }}
          >
            <span
              role="button"
              tabIndex={0}
              onClick={() => setQtyMenuOpen((o) => !o)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setQtyMenuOpen((o) => !o);
                }
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", color: VAL, fontSize: 14 }}
            >
              {qtyType === "shares" ? "Quantity" : "Amount"}
              <ChevronDownIcon color={qtyMenuOpen ? UP : VAL} />
            </span>
            <div style={{ ...fieldBoxStyle, justifyContent: "space-between", position: "relative" }}>
              <span style={{ color: VAL, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
                {qtyType === "shares" ? qty : `$${qty}`}
              </span>

              <AnimatePresence>
                {qtyMenuOpen && (
                  <motion.div
                    key="qty-menu"
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ type: "spring", visualDuration: 0.22, bounce: 0 }}
                    style={{
                      position: "absolute",
                      top: "calc(100% + 8px)",
                      right: 0,
                      width: "min(260px, 70vw)",
                      zIndex: 20,
                      background: "#0a0a0c",
                      border: `1px solid ${BORDER_DIM}`,
                      borderRadius: 14,
                      padding: 6,
                      boxShadow: "0 24px 48px rgba(0,0,0,0.55)",
                      transformOrigin: "top right",
                    }}
                  >
                    <QtyMenuRow
                      icon={<StackIcon />}
                      title="Share quantity"
                      sub="Buy and sell orders available"
                      selected={qtyType === "shares"}
                      onClick={() => {
                        setQtyType("shares");
                        setQtyMenuOpen(false);
                      }}
                    />
                    <QtyMenuRow
                      icon={<DollarIcon />}
                      title="Dollar amount"
                      sub="Buy orders available"
                      selected={qtyType === "dollars"}
                      onClick={() => {
                        setQtyType("dollars");
                        setQtyMenuOpen(false);
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Field label="Order type" value="Market" caret />
            <Field label="Route" value="Auto" caret />
            <Field label="Special instructions" value="None" caret />
            <Field label="Account" value="Individual Margin" caret />
            <Field
              label="Estimated order total"
              value={
                <motion.span
                  key={Math.round(total * 100)}
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  style={{ fontWeight: 600 }}
                >
                  ${fmt(total)}
                </motion.span>
              }
            />

            {/* scrim while the quantity-type menu is open — starts right
                below the quantity row (its height + the grid's row gap),
                bleeding past the screen padding like the reference. */}
            <AnimatePresence>
              {qtyMenuOpen && (
                <motion.div
                  key="scrim"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setQtyMenuOpen(false)}
                  style={{
                    position: "absolute",
                    top: 54,
                    left: -24,
                    right: -24,
                    bottom: -8,
                    zIndex: 10,
                    background: "rgba(0,0,0,0.6)",
                  }}
                />
              )}
            </AnimatePresence>
          </div>

        </div>
      </PhoneFrame>
    </PhoneStage>
  );
}

/* ---- pieces ---- */

/** Half of the Bid/Ask pill — deep-tinted panel, label + live price both
    set in the accent colour (both sides read as one seamless capsule). */
function BidAskHalf({
  label,
  price,
  tint,
  accent,
}: {
  label: string;
  price: number;
  tint: string;
  accent: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        background: tint,
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <span style={{ color: accent, fontSize: 12, lineHeight: 1 }}>{label}</span>
      <motion.span
        key={Math.round(price * 100)}
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        style={{ color: accent, fontSize: 14, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}
      >
        {fmt(price)}
      </motion.span>
    </div>
  );
}

const fieldBoxStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  height: 44,
  padding: "0 14px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.03)",
  border: `1px solid ${BORDER_DIM}`,
};

/** One field: label left, plain text (matching a real order-ticket's row
    language) — the bordered rounded box (the AmountStepper treatment,
    adapted from its light theme) sits to the right and wraps only the
    value/control, never the label. Pass `right` for fully custom box
    content (e.g. the quantity stepper). */
function Field({
  label,
  value,
  right,
  caret = false,
}: {
  label: ReactNode;
  value?: ReactNode;
  right?: ReactNode;
  caret?: boolean;
}) {
  // Two direct grid children (not a wrapping row) — the parent grid's
  // shared "auto" column is what gives every box the same width.
  return (
    <>
      <span style={{ color: VAL, fontSize: 14 }}>{label}</span>
      <div style={fieldBoxStyle}>
        {right ?? (
          <>
            <span style={{ color: VAL, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{value}</span>
            {caret && <ChevronDownIcon color={VAL} />}
          </>
        )}
      </div>
    </>
  );
}

function QtyMenuRow({
  icon,
  title,
  sub,
  selected,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "12px 10px",
        background: "transparent",
        border: "none",
        borderRadius: 10,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span style={{ flex: "none", color: VAL, marginTop: 2 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: VAL, fontSize: 14, fontWeight: 500 }}>{title}</div>
        <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>{sub}</div>
      </span>
      {selected && (
        <span style={{ flex: "none", color: UP, marginTop: 3 }}>
          <CheckIcon />
        </span>
      )}
    </button>
  );
}

/* ---- icons (page-local — not part of the shared glass-button set) ---- */

/** Material Symbols "keyboard_arrow_down" — the "this row opens a picker"
    affordance, single chevron pointing down. */
function ChevronDownIcon({ color = VAL }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" fill={color} />
    </svg>
  );
}

function DollarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2v20M17 6.5c0-1.93-2.24-3.5-5-3.5s-5 1.57-5 3.5S9.24 10 12 10s5 1.57 5 3.5-2.24 3.5-5 3.5-5-1.57-5-3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <ellipse cx="12" cy="6" rx="8" ry="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4 6v6c0 1.77 3.58 3.2 8 3.2s8-1.43 8-3.2V6M4 12v6c0 1.77 3.58 3.2 8 3.2s8-1.43 8-3.2v-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12.5l5.5 5.5L20 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
