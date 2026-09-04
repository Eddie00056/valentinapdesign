import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import "./alert-screen.css";
import { UP, DOWN, LEAD, TRAIL } from "./chart";
import { LiveCandleChart } from "../labs/LiveCandleChart";
import { LiveStats } from "../labs/LiveStats";
import { pxHub, PX_BASE } from "./priceHub";
import type { PriceState } from "./priceHub";
import {
  BackButton,
  WatchlistButton,
  AlertButton,
  FractionalIcon,
} from "../glasslab/GlassButton";
import "../glasslab/glass-button.css";

/* Ported from "Create Alert Prototype.dc.html". A stock-detail screen in an
   iPhone frame: live rolling price, candlestick chart with a draw-in,
   timeframe rail with a sliding indicator, and a toast system. */

const ASSETS = "/prototypes/uploads";
const PHONE = `${ASSETS}/PHONE.png`;

const TFS = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y"];
const PREV_CLOSE = 192.91;
const SYMBOL = "DASH";

type ToastAnim = "drop" | "morph" | "wipe" | "stack";

type Toast = { id: number; born: number; out?: boolean };

type St = {
  active: boolean;
  tf: number;
  phase: "pre" | "draw";
  price: number;
  prev: number;
  dir: number;
  pn: number;
  pos: { left: number; width: number }[];
  total: number;
  n: number;
  toasts: Toast[];
};

const INIT: St = {
  active: false,
  tf: 0, // 1D
  phase: "pre",
  price: PX_BASE,
  prev: PX_BASE,
  dir: 0,
  pn: 0,
  pos: [],
  total: 0,
  n: 0,
  toasts: [],
};

/* "prop: val; prop: val" -> React style object */
function css(str: string): CSSProperties {
  const o: Record<string, string> = {};
  for (const decl of str.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k) continue;
    const key = k.startsWith("--")
      ? k
      : k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    o[key] = v;
  }
  return o as CSSProperties;
}

function modeAnim(mode: string) {
  return (
    (
      {
        drop: "toastDrop 420ms cubic-bezier(.22,.9,.28,1) both",
        morph: "toastMorph 700ms cubic-bezier(.22,1,.36,1) both",
        wipe: "toastWipe 420ms cubic-bezier(.4,0,.2,1) both",
      } as Record<string, string>
    )[mode] || "toastDrop 420ms cubic-bezier(.22,.9,.28,1) both"
  );
}
function modeTextAnim(mode: string) {
  return (
    (
      {
        wipe: "toastWipeText 460ms cubic-bezier(.22,1,.36,1) both",
        morph: "toastMorphText 700ms cubic-bezier(.22,1,.36,1) both",
      } as Record<string, string>
    )[mode] || "none"
  );
}

export function AlertCreationScreen({
  toastAnimation = "stack",
  autoDismiss = true,
  toastDuration = 3200,
  frame = "full",
  fractionalBanner = false,
}: {
  toastAnimation?: ToastAnim;
  autoDismiss?: boolean;
  toastDuration?: number;
  /** "full" = centred on the photo backdrop; "bare" = just the phone. */
  frame?: "full" | "bare";
  /** On landing, show a full-width "fractional shares is available" banner
      that morphs into the header's fractional icon when dismissed. */
  fractionalBanner?: boolean;
}) {
  const [s, setS] = useState<St>(INIT);
  const merge = (p: Partial<St>) => setS((v) => ({ ...v, ...p }));

  const railElRef = useRef<HTMLDivElement | null>(null);
  const btnsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const flashRef = useRef<number | undefined>(undefined);
  const idRef = useRef(0);
  const dirRef = useRef(1);

  /* Fractional-shares "expandable card" (Motion example): shared layoutId
     "frac-card" morphs between the full-width strip and the compact glass
     icon in the header. Soft, near-bounceless spring for the size delta;
     the glass icon fades in late so it never renders at strip size. */
  const [fracOpen, setFracOpen] = useState(fractionalBanner);
  const fracSpring = { type: "spring", visualDuration: 0.28, bounce: 0 } as const;
  /* inline approximation of the glass `light` icon button (glass-button.css
     .dark .btn--light) so the morphing card can *be* the resting icon. */
  // Match the mobile GlassButton (watchlist / alert) exactly: 66deg fill +
  // soft shadow here, and the same 66deg masked 1px rim via `.acs-frac-card`
  // (a plain inset ring reads flat / faded next to the real glass buttons).
  const fracGlass: CSSProperties = {
    background:
      "linear-gradient(66deg, rgba(255,255,255,0.1), rgba(255,255,255,0.045))",
    boxShadow: "0 8px 20px rgba(0,0,0,0.4)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    color: "rgba(255,255,255,0.85)",
  };

  const measure = () => {
    const rail = railElRef.current;
    if (!rail) return;
    const r = rail.getBoundingClientRect();
    const pos = btnsRef.current.map((b) => {
      if (!b) return { left: 0, width: 0 };
      const q = b.getBoundingClientRect();
      return { left: q.left - r.left, width: q.width };
    });
    merge({ total: r.width, pos });
  };

  const tick = (g: PriceState) => {
    merge({ prev: g.prev, price: g.price, dir: g.dir, pn: g.n });
    window.clearTimeout(flashRef.current);
    flashRef.current = window.setTimeout(() => merge({ dir: 0 }), 900);
  };

  useEffect(() => {
    const dT = window.setTimeout(() => merge({ phase: "draw" }), 48);
    const unsub = pxHub().subscribe(tick);
    measure();
    const anyDoc = document as unknown as {
      fonts?: { ready?: Promise<unknown> };
    };
    if (anyDoc.fonts && anyDoc.fonts.ready) anyDoc.fonts.ready.then(measure);
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(dT);
      window.clearTimeout(flashRef.current);
      unsub();
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (i: number) => {
    if (i === s.tf) return;
    dirRef.current = i > s.tf ? 1 : -1;
    merge({ tf: i });
  };

  const onKey = (e: KeyboardEvent, i: number) => {
    const n = TFS.length;
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % n;
    else if (e.key === "ArrowLeft") next = (i - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else return;
    e.preventDefault();
    select(next);
    btnsRef.current[next]?.focus();
  };

  const dismiss = (id: number) => {
    setS((st) => ({
      ...st,
      toasts: st.toasts.map((t) => (t.id === id ? { ...t, out: true } : t)),
    }));
    window.setTimeout(
      () =>
        setS((st) => ({
          ...st,
          toasts: st.toasts.filter((t) => t.id !== id),
        })),
      320,
    );
  };

  const createAlert = () => {
    // no toast — just arm the alert + trigger the bell reaction
    setS((st) => ({ ...st, active: true, n: st.n + 1 }));
  };

  /* ---- derived (renderVals) ---- */
  const { tf, phase } = s;
  const drawn = phase === "draw";
  const goingRight = dirRef.current >= 0;

  const next = "$" + s.price.toFixed(2);
  const prevStr = ("$" + s.prev.toFixed(2)).padStart(next.length, " ");
  const rising = s.price >= s.prev;
  const rollName = rising
    ? s.pn % 2
      ? "rollUpA"
      : "rollUpB"
    : s.pn % 2
      ? "rollDownA"
      : "rollDownB";
  const chars = next.split("").map((ch, i) => {
    const p = prevStr[i] ?? ch;
    const changed = s.pn > 0 && p !== ch;
    const flash = changed && s.dir !== 0;
    return {
      top: rising ? (changed ? p : ch) : ch,
      bottom: rising ? ch : changed ? p : ch,
      color: flash ? (s.dir === 1 ? UP : DOWN) : "#ffffff",
      anim: changed
        ? rollName + " 420ms cubic-bezier(.2,.8,.25,1) both"
        : "none",
    };
  });

  const delta = s.price - PREV_CLOSE;
  const sign = delta >= 0 ? "+" : "−";
  const changeText =
    sign +
    Math.abs(delta).toFixed(2) +
    " (" +
    sign +
    Math.abs((delta / PREV_CLOSE) * 100).toFixed(2) +
    "%)";
  const changeColor = delta >= 0 ? UP : DOWN;

  const target = s.pos[tf];
  const indLeft = target ? target.left.toFixed(2) + "px" : "0px";
  const indRight = target
    ? (s.total - target.left - target.width).toFixed(2) + "px"
    : "100%";
  const indOpacity = target ? 1 : 0;
  const indTransition =
    "left " +
    (goingRight ? TRAIL : LEAD) +
    ",right " +
    (goingRight ? LEAD : TRAIL) +
    ",border-color 320ms ease,background 320ms ease";

  const items = TFS.map((label, i) => ({
    label,
    onClick: () => select(i),
    onKeyDown: (e: KeyboardEvent) => onKey(e, i),
    tabIndex: tf === i ? 0 : -1,
    ariaSelected: tf === i,
    color: tf === i ? "#f2f2f8" : "#8e97ad",
  }));

  const toastList: {
    id: number;
    body: string;
    wrapStyle: string;
    anim: string | null;
    textAnim: string;
  }[] = (() => {
    const mode = toastAnimation;
    const list = mode === "stack" ? s.toasts : s.toasts.slice(0, 1);
    const enter =
      mode === "stack"
        ? "toastStackIn 420ms cubic-bezier(.22,.9,.28,1) both"
        : null;
    return list.map((t, i) => {
      const depth = i;
      const wrap =
        mode === "stack"
          ? `position:absolute;left:0;right:0;top:0;transform-style:preserve-3d;transition:transform 420ms cubic-bezier(.22,.9,.28,1),opacity 300ms ease;transform:translateY(${
              depth * 22
            }px) translateZ(${depth * -40}px) rotateX(${depth * 3}deg);opacity:${
              t.out ? 0 : Math.max(0, 1 - depth * 0.3)
            };z-index:${10 - depth};${
              t.out ? "animation:toastStackOut 200ms ease forwards;" : ""
            }`
          : "position:relative";
      return {
        id: t.id,
        body: "You can see all alerts on My alerts page",
        wrapStyle: wrap,
        anim:
          mode === "stack"
            ? depth === 0 && !t.out
              ? enter
              : "none"
            : modeAnim(mode),
        textAnim: mode === "stack" ? "none" : modeTextAnim(mode),
      };
    });
  })();

  const bellShake = s.n
    ? (s.n % 2 ? "bellShakeA" : "bellShakeB") +
      " 700ms cubic-bezier(.36,.07,.19,.97)"
    : "none";

  const phone = (
    <div
      style={{
        position: "relative",
        width: 406,
        flex: "none",
        filter: "drop-shadow(0 40px 60px rgba(0,0,0,0.35))",
        fontFamily: "'Open Sans', Helvetica, Arial, sans-serif",
        letterSpacing: 0,
      }}
    >
        {/* clip a little off the phone's bottom so the content isn't swimming
            in dead space below the stats; the wrapper re-rounds the corners */}
        <div style={{ borderRadius: 56, overflow: "hidden" }}>
          <img
            src={PHONE}
            alt="iPhone"
            style={{ width: "100%", display: "block", marginBottom: -64 }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            left: "1.8%",
            right: "1.8%",
            top: "0.9%",
            bottom: "0.9%",
            borderRadius: 56,
            overflow: "hidden",
            background: "transparent",
            paddingTop: 52,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: 57,
              background: "#111317",
              zIndex: 1,
              borderRadius: "52px 52px 0 0",
            }}
          />
          <div
            style={{
              position: "absolute",
              zIndex: 2,
              left: 22,
              top: 22,
              height: 34,
              display: "flex",
              alignItems: "center",
              color: "#fff",
              fontFamily: "'Open Sans', Helvetica, Arial, sans-serif",
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: "0.2px",
            }}
          >
            9:41
          </div>

          <div
            style={{
              position: "absolute",
              zIndex: 2,
              right: 22,
              top: 22,
              height: 34,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <svg viewBox="0 0 18 12" style={{ width: 17, height: 11, display: "block" }} fill="#fff">
              <rect x="0" y="8.5" width="3" height="3.5" rx="1" />
              <rect x="4.8" y="6" width="3" height="6" rx="1" />
              <rect x="9.6" y="3.2" width="3" height="8.8" rx="1" />
              <rect x="14.4" y="0" width="3" height="12" rx="1" />
            </svg>
            <svg
              viewBox="0 0 16 12"
              style={{ width: 16, height: 12, display: "block" }}
              fill="none"
              stroke="#fff"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M1.4 4.4a10 10 0 0 1 13.2 0" />
              <path d="M3.9 7.2a6.3 6.3 0 0 1 8.2 0" />
              <path d="M6.5 9.9a2.5 2.5 0 0 1 3 0" />
            </svg>
            <span style={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <span
                style={{
                  display: "block",
                  width: 25,
                  height: 12.5,
                  border: "1.2px solid rgba(255,255,255,0.45)",
                  borderRadius: 3.5,
                  padding: 1.5,
                  boxSizing: "border-box",
                }}
              >
                <span
                  style={{
                    display: "block",
                    width: "100%",
                    height: "100%",
                    background: "#fff",
                    borderRadius: 1.5,
                  }}
                />
              </span>
              <span
                style={{
                  display: "block",
                  width: 1.5,
                  height: 4,
                  borderRadius: "0 1px 1px 0",
                  background: "rgba(255,255,255,0.45)",
                }}
              />
            </span>
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              background: "#111317",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            <div
              className="acs-scroll"
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                padding: "14px 24px 16px",
              }}
            >
              <LayoutGroup>
                {/* header bar — back left; then fractional (compact state of
                    the card, revealed once the banner is dismissed), watchlist,
                    alert on the right */}
                <div className="dark" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <BackButton variant="light" />
                  <span style={{ flex: 1 }} />
                  <div style={{ width: 32, height: 32, flex: "none", position: "relative" }}>
                    {!fracOpen && (
                      <motion.div
                        layoutId="frac-card"
                        className="acs-frac-card"
                        transition={fracSpring}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { duration: 0.2 } }}
                        role="button"
                        tabIndex={0}
                        aria-label="Fractional shares"
                        onClick={() => setFracOpen(true)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setFracOpen(true);
                          }
                        }}
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 999,
                          overflow: "hidden",
                          cursor: "pointer",
                          ...fracGlass,
                        }}
                      >
                        <motion.span
                          layoutId="frac-glyph"
                          className="acs-frac-glyph"
                          style={{ lineHeight: 0, color: "rgba(255,255,255,0.9)" }}
                        >
                          <FractionalIcon />
                        </motion.span>
                      </motion.div>
                    )}
                  </div>
                  <WatchlistButton variant="light" size="mobile" iconOnly />
                  <AlertButton
                    variant="light"
                    size="mobile"
                    iconOnly
                    onClick={createAlert}
                    style={{ animation: bellShake }}
                  />
                </div>

                {/* Motion shared-layout ("expandable card"). Outer slot owns
                    the layout height (collapses fast, so the content below
                    follows immediately); the inner layoutId box floats on top
                    and morphs to / from the header icon. */}
                <AnimatePresence initial={false}>
                  {fracOpen && (
                      <motion.div
                        key="frac-slot"
                        initial={{ height: 0, marginTop: 0 }}
                        animate={{ height: 40, marginTop: 12 }}
                        exit={{ height: 0, marginTop: 0 }}
                        transition={{ duration: 0.17, ease: [0.4, 0, 0.2, 1] }}
                        style={{
                          position: "relative",
                          marginLeft: -24,
                          marginRight: -24,
                        }}
                      >
                        <motion.div
                          layoutId="frac-card"
                          transition={fracSpring}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1, transition: { duration: 0.16 } }}
                          exit={{ opacity: 0, transition: { duration: 0.1 } }}
                          role="button"
                          tabIndex={0}
                          aria-label="Dismiss fractional shares notice"
                          onClick={() => setFracOpen(false)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setFracOpen(false);
                            }
                          }}
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: 0,
                            height: 40,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "0 24px",
                            boxSizing: "border-box",
                            background: "#111317",
                            borderTop: "1px solid #31383f",
                            borderBottom: "1px solid #31383f",
                            borderRadius: 0,
                            color: "#f2f2f8",
                            cursor: "pointer",
                            overflow: "hidden",
                          }}
                        >
                          <motion.span
                            layoutId="frac-glyph"
                            className="acs-frac-glyph"
                            transition={{ layout: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } }}
                            style={{ flex: "none", lineHeight: 0, color: "#f2f2f8" }}
                          >
                            <FractionalIcon />
                          </motion.span>
                          <motion.span
                            data-type="body"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1, transition: { duration: 0.16, delay: 0.06 } }}
                            exit={{ opacity: 0, transition: { duration: 0.06 } }}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              fontSize: 12,
                              fontWeight: 500,
                              lineHeight: 1,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            Fractional shares available for {SYMBOL} market orders
                          </motion.span>
                          <motion.span
                            aria-hidden="true"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.6, transition: { duration: 0.16, delay: 0.06 } }}
                            exit={{ opacity: 0, transition: { duration: 0.06 } }}
                            style={{ flex: "none", lineHeight: 0 }}
                          >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path
                                d="M1.6 1.6l10.8 10.8M12.4 1.6L1.6 12.4"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                              />
                            </svg>
                          </motion.span>
                        </motion.div>
                      </motion.div>
                  )}
                </AnimatePresence>
              </LayoutGroup>

              {/* ticker */}
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", gap: 4, alignItems: "baseline", color: "#f2f2f8" }}>
                  <span data-type="heading" style={{ fontSize: 18, fontWeight: 600 }}>{SYMBOL}</span>
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "flex-end", marginTop: 4 }}>
                    <div
                      data-type="price"
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
                            transition: "color 600ms cubic-bezier(.4,0,.2,1)",
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
                      data-type="body"
                      style={{
                        fontSize: 14,
                        fontWeight: 400,
                        height: 22,
                        display: "flex",
                        alignItems: "flex-end",
                        lineHeight: 1,
                        color: changeColor,
                        transition: "color 400ms ease",
                      }}
                    >
                      {changeText}
                    </span>
                  </div>
                </div>

              {/* chart — tick-driven candlesticks (Robinhood "advanced" style):
                  static session candles, a forming candle that builds on each
                  tick, and a dotted "now" price line + axis pill. */}
              <div style={{ position: "relative", width: "calc(100% + 48px)", margin: "20px -24px 0", minHeight: 168 }}>
                <LiveCandleChart
                  w={393}
                  h={168}
                  pad={18}
                  baselineStroke="rgba(255,255,255,0.14)"
                  drawIn={drawn}
                  price={s.price}
                  prevClose={PREV_CLOSE}
                  upColor={UP}
                  downColor={DOWN}
                  forming={false}
                  coolFade={0.38}
                />
              </div>

              {/* timeframe rail */}
              <div
                ref={railElRef}
                role="tablist"
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", margin: "14px -10px 0" }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    borderRadius: 8,
                    background: "#22282f",
                    left: indLeft,
                    right: indRight,
                    opacity: indOpacity,
                    transition: `${indTransition},opacity 150ms ease`,
                  }}
                />
                {items.map((item, i) => (
                  <button
                    key={item.label}
                    ref={(el) => {
                      btnsRef.current[i] = el;
                    }}
                    role="tab"
                    onClick={item.onClick}
                    onKeyDown={item.onKeyDown}
                    tabIndex={item.tabIndex}
                    aria-selected={item.ariaSelected}
                    style={{
                      position: "relative",
                      zIndex: 1,
                      height: 32,
                      minWidth: 36,
                      padding: "0 10px",
                      boxSizing: "border-box",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "none",
                      borderRadius: 8,
                      background: "transparent",
                      fontFamily: "'Open Sans', Helvetica, Arial, sans-serif",
                      fontSize: 12,
                      fontWeight: 700,
                      lineHeight: 1,
                      cursor: "pointer",
                      color: item.color,
                      transition: "color 150ms ease",
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* stats — Robinhood-style bid/ask depth + stat rows, driven by
                  the shared price clock so the sizes / bar move on the same
                  tick as the price and chart, and on the same UP/DOWN palette */}
              <div style={{ marginTop: 26 }}>
                <LiveStats
                  tick={s.n}
                  bidPrice={"$" + (s.price - 0.01).toFixed(2)}
                  askPrice={"$" + (s.price + 0.01).toFixed(2)}
                  up={UP}
                  down={DOWN}
                />
              </div>
            </div>

            {/* toasts */}
            <div
              style={{
                position: "absolute",
                zIndex: 5,
                left: 8,
                right: 8,
                top: 0,
                perspective: "1200px",
                perspectiveOrigin: "50% -40%",
                pointerEvents: "none",
              }}
            >
              {toastList.map((t) => (
                <div key={t.id} style={css(t.wrapStyle)}>
                  <div
                    style={{
                      background: "#0f2019",
                      border: "1px solid #2f6b52",
                      borderRadius: 10,
                      padding: "13px 15px",
                      transformOrigin: "top right",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.45),0 2px 6px rgba(0,0,0,0.35)",
                      animation: t.anim ?? "none",
                    }}
                  >
                    <div data-type="title" style={{ color: "#48d597", fontSize: 14, fontWeight: 600, marginBottom: 3, animation: t.textAnim }}>
                      Alert created
                    </div>
                    <div data-type="body" style={{ color: "#48d597", fontSize: 12, fontWeight: 400, lineHeight: 1.35, animation: t.textAnim }}>
                      {t.body}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              bottom: 8,
              width: 134,
              height: 5,
              borderRadius: 3,
              background: "#fff",
              opacity: 0.85,
            }}
          />
        </div>
      </div>
  );

  if (frame === "bare") return phone;

  return (
    <div
      className="acs-root"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 28px",
        background: "#0F0F0F",
      }}
    >
      {phone}
    </div>
  );
}
