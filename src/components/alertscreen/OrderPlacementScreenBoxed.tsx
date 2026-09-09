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
import "./order-flow.css";
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
const labelStyle: CSSProperties = {
  color: "#fff",
  fontSize: 14,
  fontWeight: 500,
  letterSpacing: "0.01em",
};
// the value sitting inside a field box — dimmer than the label
const valueStyle: CSSProperties = {
  color: "#c9cdd6",
  fontSize: 14,
  fontVariantNumeric: "tabular-nums",
};

// inline validation message under a field label — reference treatment
// (small, multi-line, sits in the label column), coloured red
const fieldErrorStyle: CSSProperties = {
  display: "block",
  marginTop: 3,
  color: DOWN,
  fontSize: 12,
  fontWeight: 400,
  lineHeight: 1.35,
};

function fmt(n: number) {
  return n.toFixed(2);
}

const money = (n: number) =>
  "$" +
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// shared spring for the button -> panel layout morph — quick
const ORD_SPRING = { type: "spring", visualDuration: 0.26, bounce: 0 } as const;

// review screen chrome
const iconBtnStyle: CSSProperties = {
  width: 24,
  height: 24,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: 0,
};
const reviewRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 12,
  padding: "11px 0",
};

// order-placed confirmation card
const placedInnerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
  padding: "0 18px",
};
const placedRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};
const placedLabelStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 400,
  color: "rgba(255, 255, 255, 0.5)",
  letterSpacing: "0.01em",
};
const placedValueStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 400,
  color: "#fff",
  letterSpacing: "0.01em",
  fontVariantNumeric: "tabular-nums",
};

const ORDER_TYPES = [
  "Market",
  "Limit",
  "Stop",
  "Stop limit",
  "Trailing stop",
  "Trailing stop limit",
  "Limit on open",
  "Limit on close",
] as const;

// optional caption shown under an order type in the picker drawer
const ORDER_TYPE_DESC: Record<string, string> = {
  Market: "Fractional trading available",
};

/* The unit switcher is a chevron next to the "Shares" label; the box holds
   only the value. The earlier "prefix inside the box" take is kept as
   OrderPlacementScreenBoxedPrefix (/work/order-placement-boxed-prefix). */
export function OrderPlacementScreenBoxed({
  singleCta = false,
}: {
  /** One "Place order" button instead of Buy/Sell; tapping it skips the
      Review screen and goes straight into the placing -> placed animation. */
  singleCta?: boolean;
} = {}) {
  const [s, setS] = useState<PriceState>({ price: PX_BASE, prev: PX_BASE, dir: 0, n: 0 });
  const [qtyStr, setQtyStr] = useState("2");
  const qty = parseFloat(qtyStr) || 0;
  const [qtyType, setQtyType] = useState<"shares" | "dollars">("shares");
  const [orderType, setOrderType] = useState("Market");
  const [limitStr, setLimitStr] = useState(() => PX_BASE.toFixed(2));

  // which field box is currently selected — drives the 2px white border and
  // (for Quantity / Order type) its picker drawer. Only one at a time.
  const [activeField, setActiveField] = useState<string | null>(null);
  const qtyMenuOpen = activeField === "quantity";
  const orderTypeMenuOpen = activeField === "orderType";
  const drawerOpen = qtyMenuOpen || orderTypeMenuOpen;

  // the fake on-screen numeric keyboard: which text field it's editing
  const [keyboardTarget, setKeyboardTarget] = useState<
    null | "shares" | "limitPrice"
  >(null);
  const keyboardOpen = keyboardTarget !== null;
  // the first keystroke after focusing a field replaces its value; later
  // ones append (mirrors tapping into a filled iOS field)
  const [kbFresh, setKbFresh] = useState(false);
  const openKeyboard = (target: "shares" | "limitPrice") => {
    setKeyboardTarget(target);
    setActiveField(target === "shares" ? "quantityInput" : "limitPrice");
    setKbFresh(true);
  };
  const closeAll = () => {
    setActiveField(null);
    setKeyboardTarget(null);
  };
  const pressKey = (k: string) => {
    const isShares = keyboardTarget === "shares";
    const cur = isShares ? qtyStr : limitStr;
    const set = isShares ? setQtyStr : setLimitStr;
    const base = kbFresh && k !== "back" ? "" : cur;
    setKbFresh(false);
    let next: string;
    if (k === "back") next = cur.slice(0, -1);
    else if (k === ".") next = base.includes(".") ? base : (base || "0") + ".";
    else next = base === "0" ? k : base + k;
    if (next.replace(".", "").length > 9) return;
    set(next);
  };

  // limit orders can't be dollar-denominated — the quantity is locked to
  // shares and the unit switcher (chevron) is hidden.
  const isLimit = orderType === "Limit";
  const effQtyType = isLimit ? "shares" : qtyType;
  // fractional shares aren't allowed on a limit order
  const qtyFractionalError =
    isLimit && qty % 1 !== 0
      ? "Switch to a market order to trade fractional shares."
      : null;
  const hasError = qtyFractionalError != null;
  const toggleField = (name: string) => {
    setKeyboardTarget(null);
    setActiveField((f) => (f === name ? null : name));
  };

  const [fracOpen, setFracOpen] = useState(false);

  useEffect(() => {
    const unsub = pxHub().subscribe(setS);
    return unsub;
  }, []);

  useEffect(() => {
    if (!activeField && !keyboardTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeField, keyboardTarget]);

  // picking a limit order forces the quantity back to shares
  useEffect(() => {
    if (orderType === "Limit") setQtyType("shares");
  }, [orderType]);

  // ---- ticket -> review -> placing -> placed flow ----
  const [step, setStep] = useState<"ticket" | "review" | "placing" | "placed">(
    "ticket",
  );
  const [side, setSide] = useState<"Buy" | "Sell">("Buy");
  const [lockedPx, setLockedPx] = useState(PX_BASE);

  useEffect(() => {
    if (step !== "placing") return;
    const id = window.setTimeout(() => setStep("placed"), 1700);
    return () => window.clearTimeout(id);
  }, [step]);

  const submit = (dir: "Buy" | "Sell" = "Buy") => {
    if (hasError) return;
    closeAll();
    setSide(dir);
    setLockedPx(s.price);
    setStep(singleCta ? "placing" : "review");
  };

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

  // review screen: shares vs dollar-amount modes resolve differently
  const isDollars = effQtyType === "dollars";
  // in dollar-amount mode the ticket estimates a share count instead of a cost
  const estShares = s.price ? qty / s.price : 0;
  const reviewShares = isDollars ? (lockedPx ? qty / lockedPx : 0) : qty;
  const reviewAmount = isDollars ? qty : qty * lockedPx;
  const reviewRows: Array<[string, string]> = [
    ["Order type", orderType],
    ...(orderType === "Limit"
      ? ([["Limit price", `$${limitStr}`]] as Array<[string, string]>)
      : []),
    ["Route", "Nasdaq"],
    ["Special instructions", "None"],
    ["Account", "Margin"],
    ["Total share quantity", reviewShares.toFixed(3)],
  ];
  const reviewTitle = `${side} ${
    isDollars
      ? money(qty)
      : `${qty} ${qty === 1 ? "share" : "shares"}`
  } of ${SYMBOL}\n@ ${
    orderType === "Limit" ? `Limit ${money(parseFloat(limitStr) || 0)}` : orderType
  }`;

  // order-placed confirmation card — the resolved details of the order.
  // Quantity always reads as a share count (dollar orders resolve to shares).
  const placedShares = Number.isInteger(reviewShares)
    ? String(reviewShares)
    : reviewShares.toFixed(3);
  const placedQty = `${placedShares} ${reviewShares === 1 ? "share" : "shares"}`;
  const placedTotal = isDollars
    ? qty
    : (isLimit ? parseFloat(limitStr) || 0 : lockedPx) * qty;
  const placedRows: Array<[string, string]> = [
    ["Account", "Margin"],
    ["Order type", `${orderType} ${side.toLowerCase()}`],
    ...(isLimit
      ? ([["Limit price", `${money(parseFloat(limitStr) || 0)} USD`]] as Array<
          [string, string]
        >)
      : []),
    ["Quantity", placedQty],
    ["Total cost", `${money(placedTotal)} USD`],
  ];

  // rendered on both order-placed panels. Always mounted (even while the
  // spinner is still running) so it reserves its height and the checkmark
  // never shifts when it fades in.
  const placedCard = (visible: boolean) => (
    <motion.div
      initial={false}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 10 }}
      transition={{ duration: 0.28, delay: visible ? 0.12 : 0, ease: [0.22, 1, 0.36, 1] }}
      style={{
        width: "100%",
        marginTop: 28,
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid rgba(255, 255, 255, 0.11)",
        borderRadius: 14,
        padding: "16px 0",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div style={placedInnerStyle}>
        {placedRows.map(([label, value]) => (
          <div key={label} style={placedRowStyle}>
            <span style={placedLabelStyle}>{label}</span>
            <span style={placedValueStyle}>{value}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );

  // shared body for both order-placed panels (single-CTA + two-button).
  // A flex column: the checkmark + details card sit as one centred block,
  // the buttons pin low. The card and buttons are always mounted (opacity
  // toggled) so nothing reflows when the order resolves to `placed`.
  const placedPanelContent = (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      {/* dismiss — same glass icon-button material as the ticket's header
          controls (66deg masked 1px rim via `.acs-frac-card`) */}
      <motion.button
        aria-label="Dismiss"
        onClick={() => setStep("ticket")}
        className="acs-frac-card"
        initial={false}
        animate={{ opacity: step === "placed" ? 1 : 0 }}
        transition={{ duration: 0.25, delay: step === "placed" ? 0.18 : 0 }}
        style={{
          position: "absolute",
          top: 24,
          right: 24,
          width: 32,
          height: 32,
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
          color: "rgba(255,255,255,0.9)",
          pointerEvents: step === "placed" ? "auto" : "none",
          zIndex: 4,
        }}
      >
        <svg width="11" height="11" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
          <path d="M14 1.41 12.59 0 7 5.59 1.41 0 0 1.41 5.59 7 0 12.59 1.41 14 7 8.41 12.59 14 14 12.59 8.41 7 14 1.41Z" />
        </svg>
      </motion.button>

      <div style={{ flex: 1, minHeight: 8 }} />
      <motion.div
        key="seq"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: 0.08 }}
        style={{
          flex: "none",
          width: "100%",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <PlacedSequence onDone={() => setStep("placed")} />
      </motion.div>
      {placedCard(step === "placed")}
      <div style={{ flex: 1.35, minHeight: 8 }} />
      <motion.div
        initial={false}
        animate={{
          opacity: step === "placed" ? 1 : 0,
          y: step === "placed" ? 0 : 8,
        }}
        transition={{ duration: 0.25, delay: step === "placed" ? 0.15 : 0 }}
        style={{
          flex: "none",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          pointerEvents: step === "placed" ? "auto" : "none",
        }}
      >
        <button className="ofl-btn-outline" onClick={() => setStep("ticket")}>
          Modify order
        </button>
        <button className="ofl-btn-outline" onClick={() => setStep("ticket")}>
          Cancel order
        </button>
      </motion.div>
    </div>
  );

  return (
    <PhoneStage>
      <PhoneFrame
        fullDevice
        footer={
          step === "review" ? (
            <motion.button
              layoutId="ord-surface"
              transition={ORD_SPRING}
              className="ofl-cta"
              style={{ borderRadius: 999 }}
              onClick={() => setStep("placing")}
            >
              Place order
            </motion.button>
          ) : step === "placed" ? (
            // buttons live inside the full-screen panel now
            undefined
          ) : step === "placing" ? undefined : singleCta ? (
            // single-CTA: the button lives in the overlay so it can morph
            // into the full screen (see below)
            undefined
          ) : (
          // pinned to the bottom of the screen area, outside the scrolling
          // content — the site's shared glass-pill buttons (glasslab/GlassButton),
          // but recoloured (page-scoped) to the same green/red as the Bid/Ask
          // pill (chart UP / DOWN) while keeping the glass treatment.
          <motion.div
            className="dark opb-actions"
            initial={false}
            // while the number pad is up, ride just above it (iOS accessory)
            animate={{ y: keyboardOpen ? -212 : 0 }}
            transition={{ type: "spring", visualDuration: 0.3, bounce: 0 }}
            style={{
              marginTop: 10,
              display: "flex",
              gap: 10,
              // only lift above the overlay while the number pad is up — with a
              // drawer open (keyboard closed) the buttons must sit *under* the
              // sheet, so drop back to normal flow
              position: keyboardOpen ? "relative" : "static",
              zIndex: keyboardOpen ? 41 : "auto",
              background: "#000",
              padding: keyboardOpen ? "8px 0" : 0,
            }}
          >
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
              div.opb-actions .btn:disabled {
                opacity: 0.4;
                box-shadow: none;
                cursor: not-allowed;
                pointer-events: none;
              }
            `}</style>
            <GlassButton
              variant="red"
              size="mobile"
              block
              disabled={hasError}
              onClick={() => submit("Sell")}
            >
              Sell
            </GlassButton>
            <GlassButton
              variant="green"
              size="mobile"
              block
              disabled={hasError}
              onClick={() => submit("Buy")}
            >
              Buy
            </GlassButton>
          </motion.div>
          )
        }
        overlay={
          <>
          {singleCta ? (
            // ONE persistent surface: the "Place order" pill at rest, which
            // `layout`-morphs to fill the screen when the order is placed
            // (grows from the pill's box, radius eases 999 -> 22).
            <motion.div
              layout
              initial={false}
              // the box grows on a spring, but the colour flips instantly so
              // it never reads as a "green box" mid-morph
              transition={{ layout: ORD_SPRING, backgroundColor: { duration: 0 } }}
              animate={{
                backgroundColor: step === "ticket" ? "#48d597" : "#0b0b0d",
              }}
              onClick={
                step === "ticket" && !hasError ? () => submit() : undefined
              }
              style={
                step === "ticket"
                  ? {
                      position: "absolute",
                      left: 24,
                      right: 24,
                      bottom: 24,
                      height: 44,
                      borderRadius: 999,
                      zIndex: keyboardOpen ? 0 : "auto",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      cursor: hasError ? "default" : "pointer",
                      opacity: hasError ? 0.4 : 1,
                      pointerEvents: hasError ? "none" : "auto",
                    }
                  : {
                      position: "absolute",
                      inset: 0,
                      borderRadius: 22,
                      zIndex: 3,
                      padding: 24,
                      boxSizing: "border-box",
                      overflow: "hidden",
                      pointerEvents: "auto",
                    }
              }
            >
              {step === "ticket" ? (
                <span
                  style={{
                    color: "#0b0b0d",
                    fontWeight: 400,
                    fontSize: 16,
                    letterSpacing: "0.01em",
                  }}
                >
                  Place order
                </span>
              ) : (
                placedPanelContent
              )}
            </motion.div>
          ) : (step === "placing" || step === "placed") ? (
            // two-button variant: the review "Place order" button morphs
            // (layoutId) into this full-screen panel
            <motion.div
              layoutId="ord-surface"
              transition={ORD_SPRING}
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 3,
                background: "#0b0b0d",
                borderRadius: 22,
                overflow: "hidden",
                padding: 24,
                boxSizing: "border-box",
                pointerEvents: "auto",
              }}
            >
              {placedPanelContent}
            </motion.div>
          ) : null}
          {step === "ticket" ? (
          <>
            {/* scrim — dims the whole screen behind the sheet. Kept mounted,
                opacity-toggled, so price-tick re-renders can't strand it. */}
            <motion.div
              initial={false}
              animate={{ opacity: drawerOpen ? 1 : 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setActiveField(null)}
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.4)",
                pointerEvents: drawerOpen ? "auto" : "none",
              }}
            />
            {/* bottom drawer — slides up from the screen's bottom edge: no
                handle or header, just the two unit rows split by a divider. */}
            <motion.div
              aria-hidden={!qtyMenuOpen}
              initial={false}
              animate={{ y: qtyMenuOpen ? "0%" : "100%" }}
              transition={{ type: "spring", visualDuration: 0.32, bounce: 0 }}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                background: "#15161a",
                borderRadius: "20px 20px 0 0",
                // shadow only while open — otherwise the off-screen sheet's
                // upward shadow bleeds a grey gradient over the CTA buttons.
                boxShadow: qtyMenuOpen ? `inset 0 1px 0 ${BORDER_DIM}` : "none",
                padding: "8px 12px calc(20px + env(safe-area-inset-bottom))",
                pointerEvents: qtyMenuOpen ? "auto" : "none",
              }}
            >
              {/* sheet title — left-aligned, set at the ticker/symbol size */}
              <div
                style={{
                  color: VAL,
                  fontSize: 18,
                  fontWeight: 400,
                  textAlign: "left",
                  padding: "18px 10px 12px",
                }}
              >
                Order type
              </div>
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
              <div style={{ height: 1, background: BORDER_DIM, margin: "0 10px" }} />
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

            {/* order-type drawer — plain left-aligned list, scrolls if the
                eight types don't fit. Picking one closes the sheet. */}
            <motion.div
              aria-hidden={!orderTypeMenuOpen}
              initial={false}
              animate={{ y: orderTypeMenuOpen ? "0%" : "100%" }}
              transition={{ type: "spring", visualDuration: 0.32, bounce: 0 }}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                maxHeight: "78%",
                display: "flex",
                flexDirection: "column",
                background: "#15161a",
                borderRadius: "20px 20px 0 0",
                boxShadow: orderTypeMenuOpen ? `inset 0 1px 0 ${BORDER_DIM}` : "none",
                pointerEvents: orderTypeMenuOpen ? "auto" : "none",
              }}
            >
              <div
                style={{
                  color: VAL,
                  fontSize: 18,
                  fontWeight: 400,
                  textAlign: "left",
                  padding: "18px 22px 12px",
                }}
              >
                Order type
              </div>
              <div style={{ overflowY: "auto", padding: "0 12px calc(16px + env(safe-area-inset-bottom))" }}>
                {ORDER_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setOrderType(t);
                      setActiveField(null);
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "13px 10px",
                      background: "transparent",
                      border: "none",
                      borderRadius: 10,
                      cursor: "pointer",
                      textAlign: "left",
                      color: VAL,
                      fontSize: 14,
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      {t}
                      {ORDER_TYPE_DESC[t] && (
                        <span
                          style={{
                            display: "block",
                            marginTop: 3,
                            color: MUTED,
                            fontSize: 12,
                          }}
                        >
                          {ORDER_TYPE_DESC[t]}
                        </span>
                      )}
                    </span>
                    {t === orderType && (
                      <span style={{ flex: "none", color: VAL }}>
                        <CheckIcon />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* fake native iOS number pad — slides up when a text field is
                tapped; keys drive the field's value directly. Pixel offset
                (keypad is ~224 tall) rather than "100%" — percentage y on a
                sheet with a measured child wasn't animating reliably here. */}
            <motion.div
              aria-hidden={!keyboardOpen}
              initial={{ y: 280 }}
              animate={{ y: keyboardOpen ? 0 : 280 }}
              transition={{ type: "spring", visualDuration: 0.3, bounce: 0 }}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 2,
                pointerEvents: keyboardOpen ? "auto" : "none",
              }}
            >
              <IosKeypad onKey={pressKey} />
            </motion.div>
          </>
          ) : null}
          </>
        }
      >
        {/* tapping anywhere that isn't a field box clears the selection /
            dismisses the keyboard (min-height so taps in the empty area
            below the form still count) */}
        <div
          style={{ position: "relative", minHeight: "100%" }}
          onClick={step === "ticket" ? closeAll : undefined}
        >
          {step === "ticket" && (
          <>
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
          <div style={{ marginTop: 16, height: 26, display: "flex", borderRadius: 6, overflow: "hidden" }}>
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
              gridTemplateColumns: "1fr 120px",
              alignItems: "center",
              rowGap: 10,
              columnGap: 12,
            }}
          >
            <div>
              {isLimit ? (
                // limit orders: units locked to shares, no switcher
                <span style={{ ...labelStyle, display: "inline-block" }}>Shares</span>
              ) : (
                <span
                  role="button"
                  tabIndex={0}
                  aria-expanded={qtyMenuOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleField("quantity");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleField("quantity");
                    }
                  }}
                  style={{
                    ...labelStyle,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    cursor: "pointer",
                    color: qtyMenuOpen ? "#fff" : labelStyle.color,
                  }}
                >
                  {effQtyType === "shares" ? "Shares" : "Dollar amount"}
                  <ChevronDownIcon color={qtyMenuOpen ? "#fff" : MUTED} />
                </span>
              )}
            </div>
            {/* Quantity box — holds only the value; the whole box gets the 2px
                white stroke when the value is selected, or a red stroke on
                an error. */}
            <div
              style={{
                ...fieldBoxStyle,
                padding: 0,
                position: "relative",
                boxShadow: qtyFractionalError
                  ? errStroke
                  : activeField === "quantityInput"
                    ? selStroke
                    : restStroke,
              }}
            >
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  openKeyboard("shares");
                }}
                style={{
                  alignSelf: "stretch",
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  padding: "0 10px",
                  cursor: "text",
                }}
              >
                {effQtyType === "shares" ? (
                  <input
                    value={qtyStr}
                    readOnly
                    inputMode="none"
                    // size=1 so the input's intrinsic width doesn't inflate
                    // the grid's shared "auto" box column (was widening every
                    // field on the shares/dollar toggle)
                    size={1}
                    style={{
                      ...valueStyle,
                      width: "100%",
                      minWidth: 0,
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      padding: 0,
                      cursor: "text",
                    }}
                  />
                ) : (
                  <span style={valueStyle}>{`$${qtyStr}`}</span>
                )}
              </div>
            </div>
            {/* error message — sits directly under the quantity box, in the
                box's own grid column so it aligns with the field and wraps
                within its width. width:0 + minWidth:100% keeps its text from
                widening the shared "auto" box column. */}
            {qtyFractionalError && (
              <div
                style={{
                  ...fieldErrorStyle,
                  gridColumn: "2",
                  marginTop: -4,
                  width: 0,
                  minWidth: "100%",
                }}
              >
                {qtyFractionalError}
              </div>
            )}

            {/* Order type — opens its own picker drawer */}
            <Field
              label="Order type"
              value={orderType}
              caret
              active={activeField === "orderType"}
              onSelect={(e) => {
                e.stopPropagation();
                toggleField("orderType");
              }}
            />
            {/* Limit price — only shown once a limit-style type is picked.
                Wrapped so it eases in/out (subgrid keeps the box aligned with
                the shared column) instead of hard-popping the layout. */}
            <AnimatePresence initial={false}>
              {orderType === "Limit" && (
                <motion.div
                  key="limit-price-row"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
                  style={{
                    gridColumn: "1 / -1",
                    display: "grid",
                    gridTemplateColumns: "subgrid",
                    alignItems: "center",
                    overflow: "hidden",
                  }}
                >
                  <span style={{ ...labelStyle, display: "block" }}>Limit price</span>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      openKeyboard("limitPrice");
                    }}
                    style={{
                      ...fieldBoxStyle,
                      boxShadow:
                        activeField === "limitPrice" ? selStroke : restStroke,
                      cursor: "text",
                    }}
                  >
                    <span style={valueStyle}>{`$${limitStr}`}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {(
              [
                ["route", "Route", "Nasdaq"],
                ["specialInstructions", "Special instructions", "None"],
                ["account", "Account", "Margin"],
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
              label={
                isDollars ? "Est. share quantity" : "Est. order total"
              }
              value={
                isDollars ? (
                  <motion.span
                    key={Math.round(estShares * 10000)}
                    initial={{ opacity: 0.5 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25 }}
                  >
                    {estShares.toFixed(3)}
                  </motion.span>
                ) : (
                  <>
                    <motion.span
                      key={Math.round(total * 100)}
                      initial={{ opacity: 0.5 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.25 }}
                    >
                      ${fmt(total)}
                    </motion.span>
                    <span style={{ color: VAL, fontWeight: 400 }}> USD</span>
                  </>
                )
              }
            />
          </div>
          </>
          )}

          {step === "review" && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{ color: VAL }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 6,
                  height: 24,
                }}
              >
                <button
                  aria-label="Back"
                  onClick={() => setStep("ticket")}
                  style={iconBtnStyle}
                >
                  <svg width="8" height="13" viewBox="0 0 8 13" fill="none" aria-hidden="true">
                    <path
                      d="M6.5 1 L1 6.5 L6.5 12"
                      stroke={VAL}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <span style={{ fontSize: 15, fontWeight: 600 }}>Review order</span>
                <button
                  aria-label="Close"
                  onClick={() => setStep("ticket")}
                  style={iconBtnStyle}
                >
                  <svg width="13" height="13" viewBox="0 0 14 14" fill={VAL} aria-hidden="true">
                    <path d="M14 1.41 12.59 0 7 5.59 1.41 0 0 1.41 5.59 7 0 12.59 1.41 14 7 8.41 12.59 14 14 12.59 8.41 7 14 1.41Z" />
                  </svg>
                </button>
              </div>

              <div
                style={{
                  whiteSpace: "pre-line",
                  textAlign: "center",
                  fontSize: 22,
                  lineHeight: "30px",
                  fontWeight: 500,
                  margin: "40px 0 24px",
                }}
              >
                {reviewTitle}
              </div>

              <div style={{ display: "flex", flexDirection: "column" }}>
                {reviewRows.map(([label, value]) => (
                  <div key={label} style={reviewRowStyle}>
                    <span style={{ fontSize: 12, color: MUTED }}>{label}</span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: VAL,
                        textAlign: "right",
                      }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
                <div
                  style={{
                    height: 1,
                    background: BORDER_DIM,
                    opacity: 0.5,
                    margin: "6px 0",
                  }}
                />
                <div style={{ ...reviewRowStyle, alignItems: "flex-start" }}>
                  <span>
                    <span style={{ display: "block", fontSize: 12, color: MUTED }}>
                      Estimated total
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 12,
                        color: MUTED,
                        marginTop: 4,
                      }}
                    >
                      {`${reviewShares.toFixed(3)} @ ${money(lockedPx)}`}
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: VAL,
                      textAlign: "right",
                    }}
                  >
                    {money(reviewAmount)}{" "}
                    <span style={{ color: MUTED, fontWeight: 400 }}>USD</span>
                  </span>
                </div>
                <div style={reviewRowStyle}>
                  <span style={{ fontSize: 12, color: MUTED }}>
                    Commission &amp; fees
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: VAL }}>
                    $0.00 <span style={{ color: MUTED, fontWeight: 400 }}>USD</span>
                  </span>
                </div>
              </div>
            </motion.div>
          )}

        </div>
      </PhoneFrame>
    </PhoneStage>
  );
}

/* ---- pieces ---- */

/** Full-screen "Submitting order -> Order sent" beat: a spinner that
    resolves into a drawn circle + fill pop + 3D pop + drawn check + glow
    + two out-rippling rings; the status text blur-crossfades. All CSS
    (order-flow.css, `.lc-*`). `onDone` fires once the check has settled. */
function PlacedSequence({
  durationMs = 1600,
  onDone,
}: {
  durationMs?: number;
  onDone?: () => void;
}) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t1 = window.setTimeout(() => setDone(true), durationMs);
    const t2 = window.setTimeout(() => onDone?.(), durationMs + 750);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className={"lc-container" + (done ? " completed" : "")}>
      <div className="lc-status">
        <span className="lc-status-from">Placing order</span>
        <span className="lc-status-to">{SYMBOL} order placed</span>
      </div>
      <div className="lc-circle-wrap">
        <svg className="lc-main-svg" viewBox="0 0 120 120" aria-hidden="true">
          <circle className="lc-track" cx="60" cy="60" r="48" />
          <circle className="lc-fill" cx="60" cy="60" r="46.25" />
          <circle className="lc-complete" cx="60" cy="60" r="48" />
          <circle className="lc-spinner" cx="60" cy="60" r="48" />
        </svg>
        <svg className="lc-checkmark" viewBox="0 0 50 50" aria-hidden="true">
          <path className="lc-check-path" d="M12 26 L22 36 L38 16" />
        </svg>
        <div className="lc-glow" />
        <div className="lc-ripple" />
        <div className="lc-ripple-2" />
      </div>
    </div>
  );
}

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
      <span style={{ color: accent, fontSize: 14, lineHeight: 1 }}>{label}</span>
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

// The field outline is drawn with an inset box-shadow, not a border, so the
// selected state can go 1px -> 2px without nudging the box's content (a real
// border would shrink the content box and shift the icons / values).
const restStroke = "inset 0 0 0 1px rgba(58, 63, 71, 0.5)";
const selStroke = `inset 0 0 0 1.5px ${SELECTED}`;
const errStroke = `inset 0 0 0 1.5px ${DOWN}`;

const fieldBoxStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 4,
  boxSizing: "border-box",
  height: 40,
  padding: "0 10px",
  borderRadius: 6,
  background: "rgba(30, 33, 35, 0.8)",
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
  error,
}: {
  label: ReactNode;
  value?: ReactNode;
  right?: ReactNode;
  caret?: boolean;
  active?: boolean;
  onSelect?: (e: ReactMouseEvent) => void;
  plain?: boolean;
  /** Inline validation message shown under the label — same treatment as the
      reference (small, multi-line, sits in the label column), coloured red. */
  error?: ReactNode;
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
            opacity: 0.5,
            margin: "8px 0",
          }}
        />
        <span style={labelStyle}>{label}</span>
        <span
          style={{
            textAlign: "right",
            color: VAL,
            fontSize: 14,
            fontWeight: 400,
            letterSpacing: "0.01em",
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
      <span style={{ ...labelStyle, display: "block" }}>
        {label}
        {error != null && <span style={fieldErrorStyle}>{error}</span>}
      </span>
      <div
        onClick={onSelect}
        style={{
          ...fieldBoxStyle,
          boxShadow: error != null ? errStroke : active ? selStroke : restStroke,
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
        <div style={{ color: VAL, fontSize: 14, fontWeight: 500 }}>{title}</div>
        <div style={{ color: MUTED, fontSize: 12, marginTop: 8 }}>{sub}</div>
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

/** The two unit glyphs are the exact PNGs supplied for this screen
    (public/prototypes/uploads), painted via CSS mask so they take
    `currentColor` and scale cleanly instead of being re-drawn by hand. */
function MaskGlyph({ src, size = 18 }: { src: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        background: "currentColor",
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
      }}
    />
  );
}

function DollarIcon({ size = 18 }: { size?: number }) {
  return <MaskGlyph src="/prototypes/uploads/limit_price-24px.png" size={size} />;
}

function DatabaseIcon({ size = 18 }: { size?: number }) {
  return <MaskGlyph src="/prototypes/uploads/database.png" size={size} />;
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12.5l5.5 5.5L20 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---- fake iOS number pad ---- */

const KEYPAD_KEYS: { digit: string; sub?: string }[] = [
  { digit: "1" },
  { digit: "2", sub: "ABC" },
  { digit: "3", sub: "DEF" },
  { digit: "4", sub: "GHI" },
  { digit: "5", sub: "JKL" },
  { digit: "6", sub: "MNO" },
  { digit: "7", sub: "PQRS" },
  { digit: "8", sub: "TUV" },
  { digit: "9", sub: "WXYZ" },
];

const keypadFlatKeyStyle: CSSProperties = {
  height: 44,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  cursor: "pointer",
};

/** Portrait dark iOS phone-pad — three columns, 1-9 then [+ * #][0][⌫].
    The "+ * #" key doubles as a decimal point for this number-entry use. */
function IosKeypad({ onKey }: { onKey: (k: string) => void }) {
  return (
    <div style={{ background: "#353537", padding: "8px 3px 0", userSelect: "none" }}>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <style>{`.opb-key:active { background:#8b8b8d !important; }`}</style>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {KEYPAD_KEYS.map(({ digit, sub }) => (
          <KeypadKey key={digit} onClick={() => onKey(digit)}>
            <span style={{ fontSize: 24, lineHeight: 1.05, color: "#fff" }}>{digit}</span>
            {sub && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 2,
                  color: "#fff",
                  marginTop: 1,
                }}
              >
                {sub}
              </span>
            )}
          </KeypadKey>
        ))}
        <button
          type="button"
          onClick={() => onKey(".")}
          style={keypadFlatKeyStyle}
          aria-label="Decimal point"
        >
          <span style={{ fontSize: 18, letterSpacing: 4, color: "#fff" }}>+ * #</span>
        </button>
        <KeypadKey onClick={() => onKey("0")}>
          <span style={{ fontSize: 24, lineHeight: 1.05, color: "#fff" }}>0</span>
        </KeypadKey>
        <button
          type="button"
          onClick={() => onKey("back")}
          style={keypadFlatKeyStyle}
          aria-label="Delete"
        >
          <BackspaceIcon />
        </button>
      </div>
      <div style={{ display: "flex", justifyContent: "center", padding: "9px 0 8px" }}>
        <div style={{ width: 134, height: 5, borderRadius: 3, background: "#fff" }} />
      </div>
    </div>
  );
}

function KeypadKey({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className="opb-key"
      onClick={onClick}
      style={{
        height: 44,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#6c6c6e",
        border: "none",
        borderRadius: 9,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function BackspaceIcon() {
  return (
    <svg width="27" height="20" viewBox="0 0 27 20" fill="none" aria-hidden="true">
      <path
        d="M9 1.5h14.5A2.5 2.5 0 0 1 26 4v12a2.5 2.5 0 0 1-2.5 2.5H9L1 10 9 1.5Z"
        stroke="#fff"
        strokeWidth="1.6"
      />
      <path
        d="M12.5 7l7 6M19.5 7l-7 6"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
