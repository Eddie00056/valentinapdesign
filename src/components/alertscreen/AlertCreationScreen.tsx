import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import "./alert-screen.css";
import { candles, SERIES, UP, DOWN, LEAD, TRAIL } from "./chart";
import { pxHub, PX_BASE } from "./priceHub";
import type { PriceState } from "./priceHub";
import {
  BackButton,
  WatchlistButton,
  AlertButton,
} from "../glasslab/GlassButton";
import "../glasslab/glass-button.css";

/* Ported from "Create Alert Prototype.dc.html". A stock-detail screen in an
   iPhone frame: live rolling price, candlestick chart with a draw-in,
   timeframe rail with a sliding indicator, and a toast system. */

const ASSETS = "/prototypes/uploads";
const PHONE = `${ASSETS}/PHONE.png`;
const BG = `${ASSETS}/sindy-sussengut-ZUEcf_Ng2gw-unsplash-4569b038.jpg`;

const TFS = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y"];
const PREV_CLOSE = 192.91;

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
  tf: 2,
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

const muted: CSSProperties = { color: "#8e97ad", fontSize: 12, fontWeight: 400 };
const val: CSSProperties = { color: "#f2f2f8", fontSize: 12, fontWeight: 400 };
const rangeBar: CSSProperties = {
  height: 2,
  background: "#31383f",
  borderRadius: 1,
  position: "relative",
  margin: "14px 0 12px",
};

export function AlertCreationScreen({
  toastAnimation = "stack",
  autoDismiss = true,
  toastDuration = 3200,
  frame = "full",
}: {
  toastAnimation?: ToastAnim;
  autoDismiss?: boolean;
  toastDuration?: number;
  /** "full" = centred on the photo backdrop; "bare" = just the phone. */
  frame?: "full" | "bare";
}) {
  const [s, setS] = useState<St>(INIT);
  const merge = (p: Partial<St>) => setS((v) => ({ ...v, ...p }));

  const railElRef = useRef<HTMLDivElement | null>(null);
  const btnsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const flashRef = useRef<number | undefined>(undefined);
  const idRef = useRef(0);
  const dirRef = useRef(1);

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
    const id = ++idRef.current;
    setS((st) => ({
      ...st,
      active: true,
      n: st.n + 1,
      toasts: [{ id, born: Date.now() }, ...st.toasts].slice(0, 3),
    }));
    if (autoDismiss) window.setTimeout(() => dismiss(id), toastDuration);
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

  const chartCandles = candles(SERIES[TFS[tf]], 30).map((k, i) => ({
    ...k,
    color: k.up ? "#48d597" : "#ff557d",
    style:
      "opacity:" +
      (drawn ? 1 : 0) +
      ";transform-box:fill-box;transform-origin:center;transform:scaleY(" +
      (drawn ? 1 : 0.2) +
      ");transition:opacity 220ms ease " +
      (drawn ? i * 12 : 0) +
      "ms,transform 320ms cubic-bezier(.22,.9,.28,1) " +
      (drawn ? i * 12 : 0) +
      "ms",
  }));

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

  const groups = [
    {
      rows: [
        { a: "Bid size", b: "3", c: "Ask size", d: "1" },
        { a: "Open", b: "$191.78", c: "Prev close", d: "$194.70" },
      ],
    },
    {
      rows: [
        { a: "Volume", b: "68M", c: "Avg volume", d: "79M" },
        { a: "Market cap", b: "1.62T", c: "Shares", d: "506.44M" },
        { a: "Dividends", b: "$5.34", c: "Yield", d: "1.24%" },
        { a: "EPS", b: "24.00", c: "P/E", d: "78.00" },
      ],
    },
    {
      rows: [
        { a: "Ex-date", b: "06 Nov 2020", c: "Earnings date", d: "26 May 2021" },
      ],
    },
  ].map((g, i, arr) => ({
    ...g,
    style: "padding:6px 0" + (i < arr.length - 1 ? ";border-bottom:1px solid #1d2328" : ""),
  }));

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
        <img src={PHONE} alt="iPhone" style={{ width: "100%", display: "block" }} />
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
                padding: "14px 24px 28px",
              }}
            >
              {/* header bar — back left, watchlist + alert right */}
              <div className="dark" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <BackButton variant="light" />
                <span style={{ flex: 1 }} />
                <WatchlistButton variant="light" size="mobile" iconOnly />
                <AlertButton
                  variant="light"
                  size="mobile"
                  iconOnly
                  onClick={createAlert}
                  style={{ animation: bellShake }}
                />
              </div>

              {/* ticker */}
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", color: "#f2f2f8" }}>
                  <span data-type="heading" style={{ fontSize: 14, fontWeight: 600 }}>DASH</span>
                  <span data-type="heading-regular" style={{ fontSize: 14, fontWeight: 400 }}>DoorDash, Inc.</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 4 }}>
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

              {/* chart */}
              <div style={{ position: "relative", width: "calc(100% + 48px)", margin: "24px -24px 0", height: 124 }}>
                <svg viewBox="0 0 393 124" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: "100%" }}>
                  <defs>
                    <linearGradient id="areaUp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#48d597" stopOpacity="0.30" />
                      <stop offset="62%" stopColor="#48d597" stopOpacity="0.06" />
                      <stop offset="100%" stopColor="#48d597" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="areaDown" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ff557d" stopOpacity="0.24" />
                      <stop offset="62%" stopColor="#ff557d" stopOpacity="0.05" />
                      <stop offset="100%" stopColor="#ff557d" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <line
                    x1="0"
                    x2="393"
                    y1="80.68"
                    y2="80.68"
                    style={{
                      stroke: "rgba(255,255,255,0.14)",
                      strokeWidth: 1,
                      strokeDasharray: "1 4",
                      strokeLinecap: "round",
                      opacity: drawn ? 1 : 0,
                      transition: "opacity 500ms ease 200ms",
                    }}
                  />
                  {chartCandles.map((k, i) => (
                    <g key={i} style={css(k.style)}>
                      <line x1={k.cx} x2={k.cx} y1={k.hi} y2={k.lo} stroke={k.color} strokeWidth={1.6} strokeLinecap="round" />
                      <rect x={k.x} y={k.y} width={k.w} height={k.h} rx={1} fill={k.color} />
                    </g>
                  ))}
                </svg>
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

              {/* bid / ask */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 26 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#22282e", borderRadius: 8, height: 35, padding: "0 14px" }}>
                  <span data-type="body-muted" style={muted}>Bid</span>
                  <span data-type="body" style={val}>$194.28</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#22282e", borderRadius: 8, height: 35, padding: "0 14px" }}>
                  <span data-type="body-muted" style={muted}>Ask</span>
                  <span data-type="body" style={val}>$194.30</span>
                </div>
              </div>

              {/* ranges */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 14 }}>
                <div>
                  <div data-type="body-muted" style={muted}>Day range</div>
                  <div style={rangeBar}>
                    <span style={{ position: "absolute", left: "56%", top: -2, width: 3, height: 6, background: "#48d597", borderRadius: 1 }} />
                  </div>
                  <div data-type="body" style={{ display: "flex", justifyContent: "space-between", ...val }}>
                    <span>$191.11</span>
                    <span>$196.25</span>
                  </div>
                </div>
                <div>
                  <div data-type="body-muted" style={muted}>52 week range</div>
                  <div style={rangeBar}>
                    <span style={{ position: "absolute", left: "24%", top: -2, width: 3, height: 6, background: "#48d597", borderRadius: 1 }} />
                  </div>
                  <div data-type="body" style={{ display: "flex", justifyContent: "space-between", ...val }}>
                    <span>$166.19</span>
                    <span>$402.67</span>
                  </div>
                </div>
              </div>

              {/* stat groups */}
              <div style={{ marginTop: 16, borderTop: "1px solid #1d2328" }}>
                {groups.map((g, gi) => (
                  <div key={gi} style={css(g.style)}>
                    {g.rows.map((row, ri) => (
                      <div key={ri} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: "8px 0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <span data-type="body-muted" style={muted}>{row.a}</span>
                          <span data-type="body" style={val}>{row.b}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <span data-type="body-muted" style={muted}>{row.c}</span>
                          <span data-type="body" style={val}>{row.d}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
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
        background: `#0F0F0F url('${BG}') center/cover no-repeat`,
      }}
    >
      {phone}
    </div>
  );
}
