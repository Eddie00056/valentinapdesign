import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode, MouseEvent as ReactMouseEvent } from "react";
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
const BORDER_DIM = "#3a3f47"; // resting field outline — visible enough to read as a container
// selected-field treatment: plain white stroke, 1.5x the resting 1px border
const SELECTED = "#ffffff";

// row label — 12px (matches the alert screen's readout); the hierarchy against
// the field value comes mostly from colour (full white vs dim) + the bordered
// box, so the weight only needs a light nudge
const labelStyle: CSSProperties = { color: VAL, fontSize: 12, fontWeight: 500 };
// the value sitting inside a field box — dimmer than the label
const valueStyle: CSSProperties = {
  color: "#c9cdd6",
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
};

function fmt(n: number) {
  return n.toFixed(2);
}

/* SAVED alternate — the unit switcher lives inside the Shares box as a left
   prefix (icon + chevron). The active version (OrderPlacementScreenBoxed) puts
   the chevron next to the "Shares" label instead. Kept so we can switch back. */
export function OrderPlacementScreenBoxedPrefix() {
  const [s, setS] = useState<PriceState>({ price: PX_BASE, prev: PX_BASE, dir: 0, n: 0 });
  const [qty] = useState(2);
  const [qtyType, setQtyType] = useState<"shares" | "dollars">("shares");

  // which field box is currently selected — drives the 2px white border and
  // (for Quantity) the unit switcher. Only one at a time.
  const [activeField, setActiveField] = useState<string | null>(null);
  const qtyMenuOpen = activeField === "quantity";
  const toggleField = (name: string) =>
    setActiveField((f) => (f === name ? null : name));

  const [fracOpen, setFracOpen] = useState(false);

  useEffect(() => {
    const unsub = pxHub().subscribe(setS);
    return unsub;
  }, []);

  useEffect(() => {
    if (!activeField) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setActiveField(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeField]);

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
          // but recoloured (page-scoped) to the same green/red as the Bid/Ask
          // pill (chart UP / DOWN) while keeping the glass treatment.
          <div className="dark opb-actions" style={{ marginTop: 10, display: "flex", gap: 10 }}>
            {/* eslint-disable-next-line react/no-unknown-property */}
            <style>{`
              div.opb-actions .btn--red {
                background: #ff557d; /* exact chart DOWN — the "Ask" colour */
                box-shadow: 0 8px 20px rgba(255, 85, 125, 0.18);
                color: #000;
              }
              div.opb-actions .btn--red::before {
                background: linear-gradient(170.89deg, rgba(255,255,255,0.55) 3.02%, rgba(255,255,255,0.05) 28.94%, rgba(255,255,255,0.28) 108.33%);
              }
              div.opb-actions .btn--green {
                background: #48d597; /* exact chart UP — the "Bid" colour */
                box-shadow: 0 8px 20px rgba(72, 213, 151, 0.18);
                color: #000;
              }
              div.opb-actions .btn--green::before {
                background: linear-gradient(170.89deg, rgba(255,255,255,0.55) 3.02%, rgba(255,255,255,0.05) 28.94%, rgba(255,255,255,0.28) 108.33%);
              }
            `}</style>
            <GlassButton variant="red" size="mobile" block>
              Sell
            </GlassButton>
            <GlassButton variant="green" size="mobile" block>
              Buy
            </GlassButton>
          </div>
        }
      >
        {/* tapping anywhere that isn't a field box clears the selection */}
        <div style={{ position: "relative" }} onClick={() => setActiveField(null)}>
          {/* native iOS drawer handle — this screen presents as a sheet, not
              a pushed page. */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ width: 36, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.3)" }} />
          </div>

          {/* ticker — a straight copy of the quote screen: just the symbol
              (no company name, matching the live page), the fractional-shares
              icon riding along on the right instead of its own icon row. */}
          {/* ticker + price — the fractional-shares icon is centred against the
              whole two-line block, not just the symbol line */}
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <span style={{ fontSize: 18, fontWeight: 600, color: VAL }}>{SYMBOL}</span>

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
            </div>

            <button
              aria-label="Fractional shares"
              onClick={() => setFracOpen((o) => !o)}
              // `acs-frac-card` adds the 66deg masked 1px rim (::before) — the
              // same glass icon-button material as the alert creation screen's
              // header icon (AlertCreationScreen's fracGlass + .acs-frac-card).
              className="opb-frac-btn acs-frac-card"
              style={{
                flex: "none",
                width: 32,
                height: 32,
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                border: "none",
                overflow: "hidden",
                cursor: "pointer",
                background:
                  "linear-gradient(66deg, rgba(255,255,255,0.1), rgba(255,255,255,0.045))",
                boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
                color: fracOpen ? "#fff" : "rgba(255,255,255,0.9)",
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
            <span style={labelStyle}>
              {qtyType === "shares" ? "Shares" : "Amount"}
            </span>
            {/* Quantity box: clicking the value input highlights the WHOLE box
                (2px white stroke, like the other fields); clicking the unit
                prefix rings only the prefix segment and opens the switcher. */}
            <div
              style={{
                ...fieldBoxStyle,
                padding: 0,
                position: "relative",
                boxShadow:
                  activeField === "quantityInput" ? selStroke : restStroke,
              }}
            >
              <button
                type="button"
                aria-label="Switch quantity unit"
                aria-expanded={qtyMenuOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleField("quantity");
                }}
                style={{
                  alignSelf: "stretch",
                  flex: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  padding: "0 10px",
                  background: "transparent",
                  border: "none",
                  borderRadius: "5px 0 0 5px",
                  cursor: "pointer",
                  color: qtyMenuOpen ? VAL : MUTED,
                  // the prefix/input divider is drawn as an inset shadow (not a
                  // border) so the selected stroke sits right on top of it —
                  // white 2px when either side is selected, else the 1px rule
                  boxShadow: qtyMenuOpen
                    ? selStroke
                    : activeField === "quantityInput"
                      ? `inset -1.5px 0 0 0 ${SELECTED}`
                      : `inset -1px 0 0 0 ${BORDER_DIM}`,
                }}
              >
                {qtyType === "shares" ? <DatabaseIcon /> : <DollarIcon />}
                <ChevronDownIcon color="currentColor" />
              </button>

              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveField("quantityInput");
                }}
                style={{
                  alignSelf: "stretch",
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  padding: "0 12px",
                  cursor: "pointer",
                }}
              >
                <span style={valueStyle}>
                  {qtyType === "shares" ? qty : `$${qty}`}
                </span>
              </div>

              {/* switcher — kept mounted and animated open/closed (rather than
                  AnimatePresence-mounted) so the frequent price-tick re-renders
                  can't strand a half-finished exit. */}
              <motion.div
                aria-hidden={!qtyMenuOpen}
                initial={false}
                animate={
                  qtyMenuOpen
                    ? { opacity: 1, y: 0, scale: 1 }
                    : { opacity: 0, y: -6, scale: 0.97 }
                }
                transition={{ type: "spring", visualDuration: 0.22, bounce: 0 }}
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  // anchored to the field's right edge (= the content right
                  // edge) and grows left, so it can't run off the screen
                  right: 0,
                  width: "min(248px, 82vw)",
                  zIndex: 20,
                  background: "#0a0a0c",
                  border: `1px solid ${BORDER_DIM}`,
                  borderRadius: 14,
                  padding: 6,
                  boxShadow: "0 24px 48px rgba(0,0,0,0.55)",
                  transformOrigin: "top right",
                  pointerEvents: qtyMenuOpen ? "auto" : "none",
                }}
              >
                <QtyMenuRow
                  icon={<DatabaseIcon />}
                  title="Share quantity"
                  sub="Buy and sell orders available"
                  selected={qtyType === "shares"}
                  onClick={() => {
                    setQtyType("shares");
                    setActiveField(null);
                  }}
                />
                <QtyMenuRow
                  icon={<DollarIcon />}
                  title="Dollar amount"
                  sub="Buy orders available"
                  selected={qtyType === "dollars"}
                  onClick={() => {
                    setQtyType("dollars");
                    setActiveField(null);
                  }}
                />
              </motion.div>
            </div>

            {(
              [
                ["orderType", "Order type", "Market"],
                ["route", "Route", "NASDAQ"],
                ["specialInstructions", "Special instructions", "None"],
                ["account", "Account", "Individual Margin"],
              ] as const
            ).map(([name, label, value]) => (
              <Field
                key={name}
                label={label}
                value={value}
                caret
                active={activeField === name}
                onSelect={(e) => {
                  e.stopPropagation();
                  toggleField(name);
                }}
              />
            ))}
            <Field
              plain
              label="Estimated order total"
              value={
                <>
                  <motion.span
                    key={Math.round(total * 100)}
                    initial={{ opacity: 0.5 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25 }}
                  >
                    ${fmt(total)}
                  </motion.span>
                  <span style={{ color: MUTED, fontWeight: 400 }}> USD</span>
                </>
              }
            />

            {/* scrim while the quantity-type menu is open — starts right
                below the quantity row (its height + the grid's row gap),
                bleeding past the screen padding like the reference. Kept
                mounted, opacity-toggled, so re-renders can't strand it. */}
            <motion.div
              initial={false}
              animate={{ opacity: qtyMenuOpen ? 1 : 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setActiveField(null)}
              style={{
                position: "absolute",
                top: 54,
                left: -24,
                right: -24,
                bottom: -8,
                zIndex: 10,
                background: "rgba(0,0,0,0.6)",
                pointerEvents: qtyMenuOpen ? "auto" : "none",
              }}
            />
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
        style={{ color: accent, fontSize: 12, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}
      >
        {fmt(price)}
      </motion.span>
    </div>
  );
}

// The field outline is drawn with an inset box-shadow, not a border, so the
// selected state can go 1px -> 2px without nudging the box's content (a real
// border would shrink the content box and shift the icons / values).
const restStroke = `inset 0 0 0 1px ${BORDER_DIM}`;
const selStroke = `inset 0 0 0 1.5px ${SELECTED}`;

const fieldBoxStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  boxSizing: "border-box",
  height: 40,
  padding: "0 12px",
  borderRadius: 6,
  background: "rgba(255,255,255,0.05)",
  boxShadow: restStroke,
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
  active = false,
  onSelect,
  plain = false,
}: {
  label: ReactNode;
  value?: ReactNode;
  right?: ReactNode;
  caret?: boolean;
  active?: boolean;
  onSelect?: (e: ReactMouseEvent) => void;
  plain?: boolean;
}) {
  // `plain` — a computed readout (Estimated order total), not an input: a
  // hairline separates it from the fields above and the value is bare bold
  // text on the right, no box (matches the reference order screen).
  if (plain) {
    return (
      <>
        <div
          style={{
            gridColumn: "1 / -1",
            height: 1,
            background: BORDER_DIM,
            margin: "8px 0",
          }}
        />
        <span style={labelStyle}>{label}</span>
        <span
          style={{
            textAlign: "right",
            color: VAL,
            fontSize: 12,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {right ?? value}
        </span>
      </>
    );
  }

  // Two direct grid children (not a wrapping row) — the parent grid's
  // shared "auto" column is what gives every box the same width.
  return (
    <>
      <span style={labelStyle}>{label}</span>
      <div
        onClick={onSelect}
        style={{
          ...fieldBoxStyle,
          boxShadow: active ? selStroke : restStroke,
          cursor: onSelect ? "pointer" : undefined,
        }}
      >
        {right ?? (
          <>
            <span style={valueStyle}>{value}</span>
            {caret && <ChevronDownIcon color={MUTED} />}
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
        gap: 8,
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
        <div style={{ color: VAL, fontSize: 12, fontWeight: 500 }}>{title}</div>
        <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>{sub}</div>
      </span>
      {selected && (
        <span style={{ flex: "none", color: VAL, marginTop: 3 }}>
          <CheckIcon />
        </span>
      )}
    </button>
  );
}

/* ---- icons (page-local — not part of the shared glass-button set) ---- */

/** Material Symbols "keyboard_arrow_down" — the "this row opens a picker"
    affordance, single chevron pointing down. */
function ChevronDownIcon({ color = VAL, size = 16 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" fill={color} />
    </svg>
  );
}

/** Bold "$" — matches the supplied limit_price icon (heavier weight than a
    text dollar sign, vertical stroke running past the S top and bottom). */
function DollarIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2.2v19.6" />
      <path d="M16.6 6.5c0-1.9-2.06-3.2-4.6-3.2s-4.6 1.4-4.6 3.3S9.46 9.8 12 10.2s4.6 1.5 4.6 3.5-2.06 3.5-4.6 3.5-4.6-1.3-4.6-3.3" />
    </svg>
  );
}

/** Stroked database cylinder — matches the supplied database icon:
    top ellipse + two interior bands + bottom curve (three segments). */
function DatabaseIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 5.4c0 1.6-3.6 2.9-8 2.9S4 7 4 5.4 7.6 2.5 12 2.5s8 1.3 8 2.9Z" />
      <path d="M4 5.4v12.9c0 1.6 3.6 2.9 8 2.9s8-1.3 8-2.9V5.4" />
      <path d="M4 9.7c0 1.6 3.6 2.9 8 2.9s8-1.3 8-2.9" />
      <path d="M4 14c0 1.6 3.6 2.9 8 2.9s8-1.3 8-2.9" />
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
