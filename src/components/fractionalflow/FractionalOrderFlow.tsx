import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import "./FractionalOrderFlow.css";

/* Fractional Order Flow — a four-screen fractional-share order ticket
   (entry -> review -> sending -> done), ported 1:1 from the standalone
   Design Canvas artboard.

   - The AAPL quote ticks on its own (`livePrice`); the order's conversion
     rate is LOCKED at $300, so the share count never twitches mid-entry.
   - Tapping "Total amount" raises an iOS decimal pad that also takes
     physical-keyboard input; the primary CTA rides above it.
   - The order-type pill opens a menu. A limit order adds a Limit price
     field that shares the same pad (Bid / Ask fill it from the quote);
     its price is seeded once from the quote and never tracks it, so —
     like the market rate — the share count only moves when you move it.
   - Every pixel value below is straight from the artboard's 402 x 871
     screen box inside the 440.55 x 909.3 device frame. */

const P = "/prototypes/uploads";
const RATE = 300; // locked $/share conversion for the order

type Screen = "entry" | "review" | "sending" | "done";
type OrderType = "Market" | "Limit";
type Focus = "amount" | "limit";

const ORDER_TYPES: Array<{ id: OrderType; label: string; hint: Record<"Buy" | "Sell", string> }> = [
  {
    id: "Market",
    label: "Market order",
    hint: { Buy: "Fills now at the best available price", Sell: "Fills now at the best available price" },
  },
  {
    id: "Limit",
    label: "Limit order",
    hint: { Buy: "Fills only at your price or lower", Sell: "Fills only at your price or higher" },
  },
];

/* One spring for everything that moves because of a choice you made. */
const SPRING = { type: "spring", visualDuration: 0.3, bounce: 0 } as const;

type Props = {
  /** Photo behind the phone: 0 = washed white, 1 = full strength. */
  bgOpacity?: number;
  /** Let the AAPL quote tick while on the entry screen. */
  livePrice?: boolean;
  /** ms between quote ticks. */
  priceInterval?: number;
  /** ms the "Placing your order" spinner holds before "done". */
  sendDelay?: number;
};

const num = (s: string) => {
  const n = parseFloat(String(s).replace(/[^0-9.]/g, ""));
  return isFinite(n) ? n : 0;
};
const money = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SLAB: CSSProperties = {
  fontFamily: "'Roboto Slab', serif",
  fontWeight: 400,
  fontSize: 22,
  lineHeight: "30px",
  color: "#262D33",
  whiteSpace: "pre-line",
};

/* The quote number: each glyph sits in its own clipped cell over a "0"
   ghost, so the width never shifts; changed digits roll out/in in the
   direction of the move. */
function RollingPrice({ price }: { price: number }) {
  const txt = "$" + price.toFixed(2);
  const prevRef = useRef(txt);
  const bumpRef = useRef(0);
  const prev = prevRef.current;
  if (prev !== txt) bumpRef.current += 1;
  const bump = bumpRef.current;
  const prevNum = parseFloat(prev.replace(/[^0-9.]/g, "")) || 0;
  const dir = price > prevNum ? 1 : price < prevNum ? -1 : 0;
  useEffect(() => {
    prevRef.current = txt;
  });

  const glyph: CSSProperties = {
    fontFamily: "'Roboto Slab', serif",
    fontWeight: 400,
    fontSize: 22,
    lineHeight: "30px",
    whiteSpace: "pre",
    fontVariantNumeric: "tabular-nums",
    fontFeatureSettings: "'tnum' 1",
    color: "#262D33",
  };
  const up = dir >= 0;
  const animIn = up ? "fof-digitInUp" : "fof-digitInDown";
  const animOut = up ? "fof-digitOutUp" : "fof-digitOutDown";
  const ease = "0.32s cubic-bezier(0.22,0.68,0.3,1)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        height: 30,
        minHeight: 30,
        maxHeight: 30,
        lineHeight: "30px",
        flex: "0 0 auto",
        contain: "layout paint style",
      }}
    >
      {txt.split("").map((ch, i) => {
        const moved = prev !== txt && prev[i] !== ch && dir !== 0;
        return (
          <span
            key={"w" + i}
            style={{
              position: "relative",
              display: "block",
              overflow: "hidden",
              height: 30,
              minHeight: 30,
              maxHeight: 30,
              flex: "0 0 auto",
              contain: "layout paint style",
            }}
          >
            <span style={{ ...glyph, visibility: "hidden", display: "block" }}>
              {ch >= "0" && ch <= "9" ? "0" : ch}
            </span>
            {moved && (
              <span
                key={"o" + bump + "-" + i}
                style={{
                  ...glyph,
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  textAlign: "center",
                  animation: animOut + " " + ease + " both",
                }}
              >
                {prev[i] || ""}
              </span>
            )}
            <span
              key={moved ? "m" + bump + "-" + i : "s" + i}
              style={{
                ...glyph,
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                textAlign: "center",
                animation: moved ? animIn + " " + ease + " both" : "none",
              }}
            >
              {ch}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function StatusBar() {
  return (
    <div style={{ position: "absolute", left: 30, top: 20, width: 344.5, height: 18, zIndex: 5 }}>
      <div style={{ position: "absolute", left: 0, top: 0, height: 18, display: "flex", alignItems: "center" }}>
        <span
          style={{
            fontFamily: "-apple-system,'SF Pro Text',BlinkMacSystemFont,sans-serif",
            fontWeight: 600,
            fontSize: 15,
            lineHeight: "100%",
            letterSpacing: "-0.17px",
            color: "#000",
          }}
        >
          09:41
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 278,
          top: 3,
          width: 66.5,
          height: 12,
          display: "flex",
          flexDirection: "row",
          gap: 5,
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "row", gap: 1.5, alignItems: "flex-end", width: 16.5, height: 11 }}>
          {[4, 6, 8].map((h) => (
            <div key={h} style={{ width: 3, height: h, background: "#000", borderRadius: 0.5 }} />
          ))}
          <div style={{ width: 3, height: 11, background: "rgba(0,0,0,0.2)", borderRadius: 0.5 }} />
        </div>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none" style={{ color: "#000", flexShrink: 0 }} aria-hidden="true">
          <path
            d="M 5.33 8.427 C 6.583 7.344 8.418 7.344 9.671 8.427 C 9.734 8.485 9.771 8.568 9.772 8.654 C 9.774 8.741 9.74 8.824 9.68 8.885 L 7.718 10.907 C 7.66 10.966 7.582 11 7.5 11 C 7.418 11 7.34 10.966 7.282 10.907 L 5.32 8.885 C 5.26 8.824 5.227 8.741 5.229 8.654 C 5.23 8.567 5.267 8.485 5.33 8.427 Z M 2.712 5.729 C 5.411 3.165 9.592 3.165 12.291 5.729 C 12.352 5.789 12.387 5.872 12.388 5.958 C 12.389 6.044 12.355 6.128 12.295 6.189 L 11.161 7.36 C 11.044 7.48 10.855 7.481 10.735 7.365 C 9.849 6.546 8.696 6.092 7.5 6.092 C 6.305 6.092 5.153 6.546 4.268 7.365 C 4.148 7.481 3.959 7.48 3.842 7.36 L 2.708 6.189 C 2.648 6.128 2.616 6.045 2.616 5.959 C 2.617 5.873 2.651 5.79 2.712 5.729 Z M 0.095 3.039 C 4.235 -1.013 10.765 -1.013 14.905 3.039 C 14.965 3.099 15 3.182 15 3.268 C 15 3.353 14.967 3.436 14.908 3.497 L 13.772 4.667 C 13.655 4.787 13.466 4.788 13.348 4.67 C 11.77 3.138 9.676 2.284 7.5 2.284 C 5.324 2.284 3.231 3.138 1.653 4.67 C 1.535 4.788 1.344 4.787 1.228 4.667 L 0.092 3.497 C 0.033 3.436 0 3.353 0 3.268 C 0.001 3.182 0.035 3.099 0.095 3.039 Z"
            fill="currentColor"
            fillRule="nonzero"
          />
        </svg>
        <div style={{ position: "relative", width: 25, height: 12, flexShrink: 0 }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 22.608,
              height: 12,
              borderRadius: 2.6666667,
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.6)",
            }}
          />
          <svg
            width="1.365"
            height="4.235"
            viewBox="0 0 1.365 4.235"
            fill="rgba(0,0,0,0.6)"
            style={{ position: "absolute", left: 23.635, top: 3.882 }}
            aria-hidden="true"
          >
            <path d="M 0 0 L 0 4.235 C 0.827 3.877 1.365 3.042 1.365 2.118 C 1.365 1.193 0.827 0.359 0 0" />
          </svg>
          <div
            style={{
              position: "absolute",
              left: 2.055,
              top: 2.118,
              width: 18.497,
              height: 7.765,
              borderRadius: 1.3333334,
              background: "#000",
            }}
          />
        </div>
      </div>
    </div>
  );
}

const Chevron = ({ size = 16, color = "#262D33", w = 1.6 }: { size?: number; color?: string; w?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, display: "block" }} aria-hidden="true">
    <path d="M 4.5 6.25 L 8 9.75 L 11.5 6.25" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Close = ({ fill = "#262D33" }: { fill?: string }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill={fill} aria-hidden="true">
    <path d="M 14 1.41 L 12.59 0 L 7 5.59 L 1.41 0 L 0 1.41 L 5.59 7 L 0 12.59 L 1.41 14 L 7 8.41 L 12.59 14 L 14 12.59 L 8.41 7 L 14 1.41 Z" />
  </svg>
);

/* Field edge: hairline at rest, brand green while the pad is typing into it. */
const ring = (active: boolean) =>
  active
    ? "0 0 0 1px #227C20, 0px 4px 26px 0px rgba(0,0,0,0.05)"
    : "0 0 0 1px #E4E4E4, 0px 4px 26px 0px rgba(0,0,0,0.05)";

/* "$" + the typed figure + a blinking caret. `selected` tints the figure as
   a select-all, meaning the next key replaces it. */
function FieldValue({ value, caret, selected = false }: { value: string; caret: boolean; selected?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", height: 24, cursor: "text" }}>
      <span style={{ fontWeight: 400, fontSize: 16, lineHeight: "24px", color: "#262D33" }}>$</span>
      <span
        style={{
          fontWeight: 600,
          fontSize: 16,
          lineHeight: "24px",
          color: "#262D33",
          borderRadius: 2,
          background: selected ? "rgba(34,124,32,0.18)" : "transparent",
        }}
      >
        {value}
      </span>
      {caret && !selected && (
        <span
          style={{
            display: "inline-block",
            width: 2,
            height: 19,
            marginLeft: 1,
            background: "#227C20",
            animation: "fof-blink 1.06s step-end infinite",
          }}
        />
      )}
    </div>
  );
}

export function FractionalOrderFlow({
  bgOpacity = 0.3,
  livePrice = true,
  priceInterval = 1900,
  sendDelay = 1600,
}: Props) {
  const [screen, setScreen] = useState<Screen>("entry");
  const [side, setSide] = useState<"Buy" | "Sell">("Buy");
  const [amount, setAmount] = useState("");
  const [keyboard, setKeyboard] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>("Market");
  const [menu, setMenu] = useState(false);
  const [limit, setLimit] = useState("");
  const [focus, setFocus] = useState<Focus>("amount");
  /* A field you have just tapped into is "selected": the first key
     replaces it rather than appending, as iOS does with a select-all. */
  const [fresh, setFresh] = useState(false);
  const reduced = useReducedMotion();
  const spring = reduced ? { duration: 0 } : SPRING;
  const [pressed, setPressed] = useState<string | null>(null);
  const [price, setPrice] = useState(300);
  const [spread, setSpread] = useState(0.04);
  const [spreadUp, setSpreadUp] = useState(0.02);

  const screenRef = useRef(screen);
  screenRef.current = screen;
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const freshRef = useRef(fresh);
  freshRef.current = fresh;
  const timers = useRef<number[]>([]);
  const pressTimer = useRef<number | undefined>(undefined);

  const at = (ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  };
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    if (!livePrice) return;
    const id = window.setInterval(() => {
      if (screenRef.current !== "entry") return;
      setPrice((p) => {
        const drift = (Math.random() - 0.45) * 0.5;
        return Math.max(1, Math.round((p + drift) * 100) / 100);
      });
      const half = () => Math.round((0.01 + Math.random() * 0.05) * 100) / 100;
      setSpread(half());
      setSpreadUp(half());
    }, priceInterval);
    return () => clearInterval(id);
  }, [livePrice, priceInterval]);

  const tap = (ch: string) => {
    const onLimit = focusRef.current === "limit";
    const replace = freshRef.current;
    const edit = (a: string) => {
      if (replace) a = "";
      if (ch === "del") return a.slice(0, -1);
      if (ch === "." && a.includes(".")) return a;
      if (a.replace(".", "").length > (onLimit ? 6 : 8)) return a;
      /* a price has cents, not fractions of them */
      if (onLimit && a.includes(".") && a.split(".")[1].length >= 2) return a;
      return (a === "" && ch === "." ? "0" : "") + a + ch;
    };
    if (onLimit) setLimit(edit);
    else setAmount(edit);
    setFresh(false);
    setPressed(ch);
    window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => setPressed(null), 130);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (screenRef.current !== "entry") return;
      if (e.key === "Escape") {
        setMenu(false);
        closePad();
      } else if (!keyboard) return;
      else if (e.key >= "0" && e.key <= "9") tap(e.key);
      else if (e.key === ".") tap(".");
      else if (e.key === "Backspace") tap("del");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyboard]);

  useEffect(
    () => () => {
      clearTimers();
      window.clearTimeout(pressTimer.current);
    },
    [],
  );

  const amt = num(amount);
  const isLimit = orderType === "Limit";
  const limitPx = num(limit);
  /* the price the order converts at: locked market rate, or your limit */
  const rate = isLimit ? limitPx : RATE;
  const shares = rate > 0 ? amt / rate : 0;
  const ready = amt > 0 && rate > 0;
  const bid = price - spread;
  const ask = price + spreadUp;
  const isEntry = screen === "entry";
  const isReview = screen === "review";
  const isSending = screen === "sending";
  const isDone = screen === "done";
  const shellBg = isDone || isSending ? "#EBF7EB" : "#F9F9F9";
  const veil = 1 - bgOpacity;

  /* Leaving the limit field tidies it to cents ("299.5" -> "299.50"). */
  const settleLimit = () => setLimit((l) => (num(l) > 0 ? num(l).toFixed(2) : ""));
  const closePad = () => {
    setKeyboard(false);
    setFresh(false);
    settleLimit();
  };
  const focusField = (f: Focus) => {
    if (f !== focusRef.current) settleLimit();
    setFocus(f);
    setKeyboard(true);
    setMenu(false);
    /* a filled price is replaced by the next key; an amount is appended to */
    setFresh(f === "limit" && limit !== "");
  };
  const pickOrderType = (t: OrderType) => {
    setMenu(false);
    if (t === orderType) return;
    setOrderType(t);
    if (t === "Limit") {
      /* seed once from the side of the book you would trade against */
      if (!limit) setLimit((side === "Buy" ? ask : bid).toFixed(2));
    } else if (focus === "limit") {
      setFocus("amount");
      setFresh(false);
    }
  };
  const fillFromQuote = (px: number) => {
    setLimit(px.toFixed(2));
    setFocus("limit");
    setFresh(true);
  };

  const goEntry = () => {
    clearTimers();
    setScreen("entry");
    setAmount("");
    setKeyboard(false);
    setMenu(false);
    setFocus("amount");
    setFresh(false);
    setPressed(null);
  };
  const goReview = () => {
    if (ready) {
      setScreen("review");
      setKeyboard(false);
      setMenu(false);
      settleLimit();
    }
  };
  const sendOrder = () => {
    setScreen("sending");
    setKeyboard(false);
    at(sendDelay, () => setScreen("done"));
  };

  const keyStyle = (id: string): CSSProperties => {
    const bare = id === "del" || id === ".";
    const held = pressed === id;
    const bg = bare ? (held ? "#FFFFFF" : "transparent") : held ? "#B9BEC7" : "#FFFFFF";
    return {
      height: 46,
      borderRadius: 5,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "-apple-system,'SF Pro Display','SF Pro Text',BlinkMacSystemFont,sans-serif",
      fontWeight: 400,
      fontSize: 25,
      letterSpacing: 0,
      color: "#000",
      cursor: "pointer",
      padding: 0,
      WebkitTapHighlightColor: "transparent",
      transition: "background 0.08s linear",
      boxShadow: bare || held ? "none" : "0 1px 0 0 rgba(0,0,0,0.35)",
      background: bg,
    };
  };
  const keys: Array<{ id: string; label: string }> = [
    ..."123456789".split("").map((k) => ({ id: k, label: k })),
    { id: ".", label: "." },
    { id: "0", label: "0" },
    { id: "del", label: "" },
  ];

  const fieldBase: CSSProperties = {
    position: "relative",
    height: 62,
    borderRadius: 12,
    background: "#fff",
    padding: "8px 16px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    alignItems: "flex-start",
  };
  const fieldLabel: CSSProperties = { fontSize: 12, lineHeight: "18px", color: "#262D33" };
  const fieldValue: CSSProperties = { fontWeight: 600, fontSize: 16, lineHeight: "24px", color: "#262D33" };

  const rows: Array<[string, string]> = [
    ["Order type", isLimit ? "Limit" : "Market"],
    ...(isLimit ? ([["Limit price", money(limitPx)]] as Array<[string, string]>) : []),
    ["Order duration", "Until cancelled"],
    ["Account", "Margin - 12345678"],
    ["Total share quantity", shares.toFixed(3)],
  ];
  const reviewTitle =
    side +
    " " +
    (amt % 1 === 0 ? "$" + amt.toLocaleString("en-US") : money(amt)) +
    " of AAPL \n@ " +
    (isLimit ? "Limit " + money(limitPx) : "Market");
  const summaryCell: CSSProperties = {
    background: "#F9F9F9",
    padding: "8px 24px",
    boxSizing: "border-box",
    alignSelf: "stretch",
  };

  return (
    <div
      className="fof-stage"
      style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,${veil}), rgba(255,255,255,${veil})), url("${P}/fof-bg.jpg")`,
      }}
    >
      <div className="fof-frame" style={{ width: 440.55, height: 909.3 }}>
        <img
          src={`${P}/iphone-fractional-flow.png`}
          alt="iPhone"
          style={{ position: "absolute", left: 0, top: 0, width: 440.55, height: 909.3, pointerEvents: "none" }}
        />

        <div
          className="fof-screen"
          style={{
            position: "absolute",
            left: 19.27,
            top: 19.27,
            width: 402,
            height: 871,
            borderRadius: 50,
            overflow: "hidden",
            background: shellBg,
            zIndex: 10,
          }}
        >
          <StatusBar />

          {isEntry && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "#F9F9F9",
                animation: "fof-scrIn 0.32s cubic-bezier(0.22,1,0.36,1) both",
              }}
            >
              {/* ticker row */}
              <div
                style={{
                  position: "absolute",
                  left: 25,
                  top: 60,
                  width: 349,
                  height: 26,
                  display: "flex",
                  padding: "1px 0",
                  justifyContent: "space-between",
                  alignItems: "center",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-end",
                    flexGrow: 1,
                    height: 24,
                  }}
                >
                  <span style={{ fontSize: 14, lineHeight: "22px", color: "#5E6D83" }}>AAPL (Apple Inc.)</span>
                  <div style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <Close />
                  </div>
                </div>
              </div>

              {/* price row */}
              <div
                style={{
                  position: "absolute",
                  left: 25,
                  top: 90,
                  width: 349,
                  height: 30,
                  contain: "layout paint style",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ position: "absolute", left: 0, top: 0, height: 30, display: "flex", alignItems: "flex-start", flexShrink: 0 }}>
                  <RollingPrice price={price} />
                  <span style={{ position: "relative", top: 8.5, marginLeft: 4, fontSize: 14, lineHeight: "18px", color: "#5E6D83", whiteSpace: "pre", flexShrink: 0 }}>
                    USD
                  </span>
                </div>
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 8.5,
                    height: 18,
                    display: "flex",
                    gap: 4,
                    alignItems: "center",
                    flexShrink: 0,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  <span style={{ fontSize: 12, lineHeight: "18px", color: "#5E6D83", whiteSpace: "pre" }}>
                    {"Bid " + (price - spread).toFixed(2)}
                  </span>
                  <div style={{ width: 3, height: 3, borderRadius: "50%", background: "#5E6D83", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, lineHeight: "18px", color: "#5E6D83", whiteSpace: "pre" }}>
                    {"Ask " + (price + spreadUp).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* toolbar */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 122,
                  width: 402,
                  height: 56,
                  background: "#F9F9F9",
                  zIndex: 14,
                  display: "flex",
                  padding: "6px 23px",
                  justifyContent: "space-between",
                  alignItems: "center",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button
                    onClick={() => setSide((s) => (s === "Buy" ? "Sell" : "Buy"))}
                    style={{
                      height: 32,
                      borderRadius: 100,
                      background: "#EFEFEF",
                      boxShadow: "0px 1px 4px 0px #FFFFFF, inset 0px -0.5px 0px 0px rgba(0,0,0,0.04)",
                      display: "flex",
                      gap: 4,
                      padding: "5px 8px 5px 12px",
                      justifyContent: "center",
                      alignItems: "center",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 12, lineHeight: "16px", color: "#262D33" }}>{side}</span>
                    <Chevron />
                  </button>
                  <div style={{ position: "relative" }}>
                    <motion.button
                      layout
                      transition={spring}
                      onClick={() => {
                        if (!menu) closePad();
                        setMenu((m) => !m);
                      }}
                      aria-haspopup="menu"
                      aria-expanded={menu}
                      style={{
                        height: 32,
                        boxSizing: "border-box",
                        borderRadius: 100,
                        background: "#EFEFEF",
                        boxShadow: "0px 1px 4px 0px #FFFFFF, inset 0px -0.5px 0px 0px rgba(0,0,0,0.1)",
                        display: "flex",
                        gap: 4,
                        padding: "5px 8px 5px 12px",
                        justifyContent: "center",
                        alignItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <motion.span
                        layout="position"
                        transition={spring}
                        style={{ fontWeight: 600, fontSize: 12, lineHeight: "16px", color: "#262D33", whiteSpace: "pre" }}
                      >
                        {isLimit ? "Limit order" : "Market order"}
                      </motion.span>
                      <motion.span
                        layout="position"
                        transition={spring}
                        style={{ display: "block", rotate: menu ? 180 : 0, transition: reduced ? "none" : "rotate 0.24s cubic-bezier(0.22,1,0.36,1)" }}
                      >
                        <Chevron />
                      </motion.span>
                    </motion.button>

                    <AnimatePresence>
                      {menu && (
                        <motion.div
                          role="menu"
                          aria-label="Order type"
                          initial={{ opacity: 0, scale: 0.96, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96, y: -4 }}
                          transition={reduced ? { duration: 0 } : { type: "spring", visualDuration: 0.22, bounce: 0 }}
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 38,
                            width: 256,
                            padding: 4,
                            boxSizing: "border-box",
                            borderRadius: 16,
                            background: "#fff",
                            boxShadow: "0 0 0 1px #E4E4E4, 0px 12px 32px 0px rgba(0,0,0,0.10)",
                            transformOrigin: "16px 0px",
                            zIndex: 2,
                          }}
                        >
                          {ORDER_TYPES.map((t) => {
                            const on = t.id === orderType;
                            return (
                              <button
                                key={t.id}
                                role="menuitemradio"
                                aria-checked={on}
                                onClick={() => pickOrderType(t.id)}
                                className="fof-menu-item"
                                style={{
                                  width: "100%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 12,
                                  padding: "8px 12px",
                                  boxSizing: "border-box",
                                  borderRadius: 12,
                                  textAlign: "left",
                                  cursor: "pointer",
                                }}
                              >
                                <span style={{ display: "flex", flexDirection: "column" }}>
                                  <span style={{ fontWeight: 600, fontSize: 14, lineHeight: "22px", color: "#262D33" }}>{t.label}</span>
                                  <span style={{ fontSize: 12, lineHeight: "18px", color: "#5E6D83" }}>{t.hint[side]}</span>
                                </span>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0, opacity: on ? 1 : 0 }}>
                                  <path d="M 3.5 8.25 L 6.5 11.25 L 12.5 4.75" stroke="#227C20" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <div
                  style={{
                    position: "relative",
                    width: 30,
                    height: 30,
                    flexShrink: 0,
                    borderRadius: 15,
                    isolation: "isolate",
                    overflow: "hidden",
                    boxSizing: "border-box",
                    contain: "paint",
                    cursor: "pointer",
                    background: "rgba(255,255,255,0.5)",
                    backgroundImage: "linear-gradient(rgba(0,102,219,0.10), rgba(0,102,219,0.10))",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    boxShadow: "0 4px 8px rgba(0,0,0,0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "inherit",
                      zIndex: 2,
                      opacity: 0.5,
                      padding: 1,
                      background: "linear-gradient(273.75deg, #6C9BE6 3.96%, #B2E1F5 34.23%, #6291DC 98.29%)",
                      WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                      WebkitMaskComposite: "xor",
                      maskComposite: "exclude",
                      pointerEvents: "none",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: 1,
                      right: 1,
                      top: 1,
                      bottom: 1,
                      borderRadius: "inherit",
                      zIndex: 3,
                      boxSizing: "border-box",
                      padding: 1,
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 25.12%, rgba(255,255,255,0.6) 102.08%)",
                      WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                      WebkitMaskComposite: "xor",
                      maskComposite: "exclude",
                      pointerEvents: "none",
                    }}
                  />
                  <img
                    src={`${P}/fof-fractional-icon.png`}
                    alt="Fractional shares"
                    style={{ position: "relative", zIndex: 4, width: 13, height: 13, display: "block", flexShrink: 0 }}
                  />
                </div>
              </div>

              {/* a tap anywhere outside the open menu closes it */}
              {menu && <div onClick={() => setMenu(false)} style={{ position: "absolute", inset: 0, zIndex: 13 }} />}

              {/* fields */}
              <div style={{ position: "absolute", left: 24, top: 186, width: 354, display: "flex", flexDirection: "column", gap: 8 }}>
                <AnimatePresence initial={false} mode="popLayout">
                  {isLimit && (
                    <motion.div
                      key="limit"
                      onClick={() => focusField("limit")}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={spring}
                      style={{
                        ...fieldBase,
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        boxShadow: ring(keyboard && focus === "limit"),
                        transition: "box-shadow 0.18s ease",
                        cursor: "text",
                        zIndex: 5,
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                        <span style={fieldLabel}>Limit price</span>
                        <FieldValue value={limit} caret={keyboard && focus === "limit"} selected={keyboard && focus === "limit" && fresh} />
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {([["Bid", bid], ["Ask", ask]] as const).map(([label, px]) => (
                          <button
                            key={label}
                            onClick={(e) => {
                              e.stopPropagation();
                              fillFromQuote(px);
                              setKeyboard(true);
                            }}
                            aria-label={`Set limit to the ${label.toLowerCase()}, ${px.toFixed(2)}`}
                            className="fof-quote-chip"
                            style={{
                              height: 28,
                              boxSizing: "border-box",
                              borderRadius: 100,
                              background: "#EFEFEF",
                              boxShadow: "0px 1px 4px 0px #FFFFFF, inset 0px -0.5px 0px 0px rgba(0,0,0,0.1)",
                              padding: "0 10px",
                              fontWeight: 600,
                              fontSize: 12,
                              lineHeight: "16px",
                              color: "#262D33",
                              cursor: "pointer",
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* amount + quantity travel as one block, with the swap between them */}
                <motion.div layout="position" transition={spring} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div
                    onClick={() => focusField("amount")}
                    style={{
                      ...fieldBase,
                      boxShadow: ring(keyboard && focus === "amount"),
                      transition: "box-shadow 0.18s ease",
                      cursor: "text",
                      zIndex: 4,
                    }}
                  >
                    <span style={fieldLabel}>Total amount</span>
                    <FieldValue value={amount} caret={keyboard && focus === "amount"} />
                  </div>

                  <div style={{ ...fieldBase, boxShadow: "0 0 0 1px #E4E4E4, 0px 4px 26px 0px rgba(0,0,0,0.05)" }}>
                    <span style={fieldLabel}>Share quantity</span>
                    <div style={{ display: "flex", alignItems: "center", height: 24 }}>
                      <span style={fieldValue}>{amt ? shares.toFixed(3) : ""}</span>
                    </div>
                  </div>

                  <div
                    onClick={() => (keyboard ? closePad() : focusField("amount"))}
                    style={{
                      position: "absolute",
                      left: 298,
                      top: 45.3,
                      width: 41.399,
                      height: 41.399,
                      zIndex: 9,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      borderRadius: "50%",
                    }}
                  >
                    <img
                      src={`${P}/fof-swap.png`}
                      alt="Swap amount and quantity"
                      style={{ position: "absolute", left: -4.01, top: -4.14, width: 49.68, height: 49.68, display: "block", pointerEvents: "none" }}
                    />
                    {keyboard && focus === "amount" && (
                      <svg width="43.399" height="43.399" viewBox="-1 -1 43.399 43.399" fill="none" style={{ position: "absolute", left: -1, top: -1, overflow: "visible" }} aria-hidden="true">
                        <path d="M 0.39 16.7 A 20.7 20.7 0 0 1 41.01 16.7" stroke="#227C20" strokeWidth="1" fill="none" />
                      </svg>
                    )}
                  </div>
                </motion.div>

                <motion.div
                  layout="position"
                  transition={spring}
                  style={{
                    ...fieldBase,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "4px 16px",
                    boxShadow: "0 0 0 1px #E4E4E4, 0px 7px 26px 0px rgba(0,0,0,0.05)",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 12, lineHeight: "22px", color: "#262D33" }}>Vacation margin</span>
                    <span style={{ fontSize: 12, lineHeight: "18px", color: "#262D33" }}>$14,200.00 USD</span>
                  </div>
                  <div style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="7.41" height="12" viewBox="0 0 7.41 12" fill="#000" style={{ transform: "rotate(-90deg)", display: "block" }} aria-hidden="true">
                      <path d="M 7.41 1.41 L 6 0 L 0 6 L 6 12 L 7.41 10.59 L 2.83 6 L 7.41 1.41 Z" />
                    </svg>
                  </div>
                </motion.div>
              </div>

              {/* primary CTA — rides above the keyboard */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  bottom: keyboard ? 259 : 28,
                  width: 402,
                  height: 72,
                  background: keyboard ? "#F9F9F9" : "transparent",
                  zIndex: 12,
                  transition: "bottom 0.38s cubic-bezier(0.22,1,0.36,1), background 0.2s ease",
                }}
              >
                <button
                  onClick={goReview}
                  style={{
                    position: "absolute",
                    left: 24.738,
                    top: 15,
                    width: 352.523,
                    height: 44,
                    borderRadius: 100,
                    background: ready ? "#227C20" : "#A9C3A8",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 16,
                    lineHeight: "24px",
                    cursor: "pointer",
                    transition: "background 0.2s ease",
                  }}
                >
                  Review order
                </button>
              </div>

              {/* iOS decimal pad */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  bottom: 0,
                  width: 402,
                  background: "#D1D3D9",
                  padding: "8px 3px 0",
                  boxSizing: "border-box",
                  transform: keyboard ? "translateY(0)" : "translateY(100%)",
                  transition: "transform 0.38s cubic-bezier(0.22,1,0.36,1)",
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "11px 6px" }}>
                  {keys.map((k) => (
                    <button key={k.id} onClick={() => tap(k.id)} style={keyStyle(k.id)}>
                      {k.id === "del" ? (
                        <svg width="26" height="19" viewBox="0 0 26 19" fill="none" aria-hidden="true">
                          <path
                            d="M8.2 0.75 H23.1 A2.15 2.15 0 0 1 25.25 2.9 V16.1 A2.15 2.15 0 0 1 23.1 18.25 H8.2 A2.15 2.15 0 0 1 6.63 17.57 L0.9 10.2 A1.1 1.1 0 0 1 0.9 8.8 L6.63 1.43 A2.15 2.15 0 0 1 8.2 0.75 Z"
                            fill="#000"
                          />
                          <path d="M11.6 6.3 L18.4 12.7 M18.4 6.3 L11.6 12.7" stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" />
                        </svg>
                      ) : (
                        k.label
                      )}
                    </button>
                  ))}
                </div>
                <div style={{ height: 34 }} />
              </div>
            </div>
          )}

          {isReview && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "#F9F9F9",
                animation: "fof-scrIn 0.34s cubic-bezier(0.22,1,0.36,1) both",
              }}
            >
              <div style={{ position: "absolute", left: 0, top: 0, width: 402, height: 220, background: "#EBF7EB" }} />

              <div
                style={{
                  position: "absolute",
                  left: 30,
                  top: 60,
                  width: 344,
                  height: 24,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div onClick={goEntry} style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <svg width="7.41" height="12" viewBox="0 0 7.41 12" fill="#262D33" aria-hidden="true">
                    <path d="M 7.41 10.58 L 2.83 6 L 7.41 1.41 L 6 0 L 0 6 L 6 12 L 7.41 10.58 Z" />
                  </svg>
                </div>
                <span style={{ fontWeight: 600, fontSize: 16, lineHeight: "24px", color: "#262D33" }}>Review order</span>
                <div onClick={goEntry} style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <Close />
                </div>
              </div>

              <div style={{ ...SLAB, position: "absolute", left: 1, top: 118, width: 401, textAlign: "center" }}>{reviewTitle}</div>

              <div style={{ position: "absolute", left: 6, top: 228, width: 390, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                {rows.map(([label, value]) => (
                  <div key={label} style={{ ...summaryCell, height: 36 }}>
                    <div style={{ height: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <span style={{ fontSize: 12, lineHeight: "18px", color: "#262D33" }}>{label}</span>
                      <div style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
                        <span style={{ fontWeight: 600, fontSize: 12, lineHeight: "18px", textAlign: "right", color: "#262D33" }}>{value}</span>
                        <div style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="8.333" height="4.167" viewBox="0 0 8.333 4.167" fill="#5E6D83" aria-hidden="true">
                            <path d="M 0 0 L 4.167 4.167 L 8.333 0 L 0 0 Z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div style={{ ...summaryCell, height: 56 }}>
                  <div style={{ position: "relative", height: 40 }}>
                    <span style={{ position: "absolute", left: 0, top: 0, fontSize: 12, lineHeight: "18px", color: "#262D33" }}>Estimated total</span>
                    <span style={{ position: "absolute", left: 0, top: 22, fontSize: 12, lineHeight: "18px", color: "#5E6D83" }}>
                      {shares.toFixed(3) + " @ " + money(rate)}
                    </span>
                    <div style={{ position: "absolute", right: 0, top: 11, display: "flex", gap: 4, alignItems: "baseline" }}>
                      <span style={{ fontWeight: 600, fontSize: 12, lineHeight: "18px", textAlign: "right", color: "#262D33" }}>{money(amt)}</span>
                      <span style={{ fontSize: 12, lineHeight: "18px", color: "#5E6D83" }}>USD</span>
                    </div>
                  </div>
                </div>

                <div style={{ ...summaryCell, height: 34 }}>
                  <div style={{ height: 18, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 12, lineHeight: "18px", color: "#262D33" }}>Commission &amp; fees*</span>
                    <div style={{ display: "flex", gap: 4, alignItems: "baseline" }}>
                      <span style={{ fontWeight: 600, fontSize: 12, lineHeight: "18px", textAlign: "right", color: "#262D33" }}>$0.00</span>
                      <span style={{ fontSize: 12, lineHeight: "18px", color: "#5E6D83" }}>USD</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ position: "absolute", left: 0, top: 771, width: 402, height: 72 }}>
                <button
                  onClick={sendOrder}
                  style={{
                    position: "absolute",
                    left: 24.738,
                    top: 15,
                    width: 352.523,
                    height: 44,
                    borderRadius: 100,
                    background: "#227C20",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 16,
                    lineHeight: "24px",
                    cursor: "pointer",
                  }}
                >
                  Send order
                </button>
              </div>
            </div>
          )}

          {isSending && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "#EBF7EB",
                animation: "fof-scrIn 0.3s cubic-bezier(0.22,1,0.36,1) both",
              }}
            >
              <div style={{ ...SLAB, position: "absolute", left: 0, top: 119, width: 402, textAlign: "center" }}>{"Placing your\norder"}</div>
              <div style={{ position: "absolute", left: 30, top: 251, width: 342, height: 342, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="72" height="72" viewBox="0 0 72 72" fill="none" style={{ animation: "fof-spin 0.9s linear infinite" }} aria-hidden="true">
                  <circle cx="36" cy="36" r="31" stroke="rgba(34,124,32,0.18)" strokeWidth="5" />
                  <path d="M 36 5 A 31 31 0 0 1 67 36" stroke="#227C20" strokeWidth="5" strokeLinecap="round" fill="none" />
                </svg>
              </div>
            </div>
          )}

          {isDone && (
            <div style={{ position: "absolute", inset: 0, background: "#EBF7EB" }}>
              <div
                style={{
                  ...SLAB,
                  position: "absolute",
                  left: 0,
                  top: 119,
                  width: 402,
                  textAlign: "center",
                  animation: "fof-riseIn 0.5s cubic-bezier(0.22,1,0.36,1) 0.42s both",
                }}
              >
                {"Your order has\nbeen placed"}
              </div>

              <div style={{ position: "absolute", left: 30, top: 251, width: 342, height: 342, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div
                  style={{
                    position: "absolute",
                    width: 150,
                    height: 150,
                    borderRadius: "50%",
                    background: "#227C20",
                    opacity: 0,
                    animation: "fof-ringOut 1.1s cubic-bezier(0.22,1,0.36,1) 0.24s both",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    width: 150,
                    height: 150,
                    borderRadius: "50%",
                    background: "#227C20",
                    opacity: 0,
                    animation: "fof-ringOut 1.1s cubic-bezier(0.22,1,0.36,1) 0.46s both",
                  }}
                />
                <div
                  style={{
                    position: "relative",
                    width: 150,
                    height: 150,
                    borderRadius: "50%",
                    background: "#227C20",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    animation: "fof-discIn 0.62s cubic-bezier(0.34,1.56,0.64,1) 0.06s both",
                  }}
                >
                  <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true">
                    <path
                      d="M 20 37.5 L 31.5 49 L 52 26"
                      stroke="#FFFFFF"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="64"
                      style={{ animation: "fof-checkDraw 0.44s cubic-bezier(0.65,0,0.35,1) 0.42s both" }}
                    />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* home indicator */}
          <div
            style={{
              position: "absolute",
              left: 131.5,
              bottom: 8,
              width: 139,
              height: 5,
              borderRadius: 100,
              background: "#000",
              opacity: 0.85,
              pointerEvents: "none",
              zIndex: 15,
            }}
          />
        </div>

        {/* Dynamic Island */}
        <div
          style={{
            position: "absolute",
            left: 156.48,
            top: 32.58,
            width: 127.58,
            height: 37.17,
            borderRadius: 100,
            background: "#000",
            pointerEvents: "none",
            zIndex: 20,
          }}
        />
      </div>
    </div>
  );
}
