import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import "./notive-quote.css";
import "../glasslab/glass-button.css";
import { PhoneFrame, PhoneStage } from "../alertscreen/PhoneFrame";
import { walk } from "../alertscreen/chart";
import { pxHub, PX_BASE, PX_STEP } from "../alertscreen/priceHub";
import type { PriceState } from "../alertscreen/priceHub";
import { LiveAreaChart } from "../labs/LiveAreaChart";
import { Rolling } from "../shared/RollingNumber";
import { SearchIcon, CloseIcon, FractionalIcon, AppleIcon } from "../glasslab/GlassButton";

/* Notive — "Quote - Fractional".
 *
 * The layout, palette and vertical rhythm are measured off the Figma export
 * (Template/Quote - Fractional.png, a 1080 x 2217 / 360dp artboard); the
 * material is ours. Every value below that reads like a magic number is a
 * measurement, and the ones that matter are annotated with what was
 * measured.
 *
 * Two deliberate departures from the artboard, both because a static frame
 * doesn't have to answer for them:
 *
 * - **The artboard's numbers don't reconcile.** It shows $325.51 with
 *   "+$4.63 (+2.25%) since previous close" over a previous close of
 *   $324.19, and a "Low" above its "High". The dollar change is the one
 *   figure that reads as intentional, so PREV_CLOSE is set to 320.88 —
 *   325.51 - 4.63 — which makes the percentage true (+1.44%) and the stats
 *   block internally consistent.
 * - **The change is relative to the selected timeframe.** The artboard only
 *   ever draws 1D. Switching to 1Y and still reading "since previous close"
 *   would be wrong, so the reference and its label follow the rail.
 */

/* ---- palette, sampled off the artboard ---- */
const BG = "#f2f2f8"; // page ground
const INK = "#262d33"; // every primary label + the Sell button
const MUTED = "#5e6d83"; // stat labels

/* One green for the whole line, its dot and its pulse — the artboard's.
   A darker "recent segment" was tried (LiveLineChart's cool/hot split,
   inverted for a light ground) and read as the chart getting heavier
   towards "now"; the elapsed session is separated by alpha instead. */
const UP_LINE = "#389b3c";
const UP_TEXT = "#087346"; // the change figure
const UP_CHIP_INK = "#227c20"; // selected range label, and the Buy button

/* The artboard never draws a down day. These are the Material tone-40/30
   reds that sit where the greens above sit on their own ramp, so a red
   session is the same design with one hue swapped — not a second style. */
const DOWN_LINE = "#b3261e";
const DOWN_TEXT = "#8c1d18";
const DOWN_CHIP_INK = "#b3261e";

/* Fractional is blue on both prototypes — the order flow's accent, and the
   colour its chip and mark are drawn in. It is deliberately not the
   screen's green: the fractional story is one thing across the two
   screens, and this row is where they meet. */
const FRAC = "#0066db";
const FRAC_TINT = "#eaf1fd";

const UP_RGB = "56,155,60";
const DOWN_RGB = "179,38,30";

/* ---- instrument ---- */
const SYMBOL = "AAPL";
const NAME = "Apple Inc.";
const REST = 325.51; // the artboard's quote — where every series ends
const PREV_CLOSE = 320.88; // REST - 4.63, see the note above
/* The shared price clock walks around PX_BASE (194.29) and every screen on
   the site is subscribed to it, so they all tick on the same beat. Shifting
   it into range keeps that beat rather than starting a second sim. */
const PX_OFFSET = REST - PX_BASE;

type Tf = {
  label: string;
  /** How the change line reads on this timeframe. */
  since: string;
  /** Dollars from the series' low to its high. The historical walks are
      unitless and need it; 1D is already built in dollars, so it has none. */
  amplitude?: number;
  series: number[];
};

/* Map a unitless walk onto dollars: the spread becomes `amplitude`, and the
   final value lands on `endAt` so the resting tip always agrees with the
   quote above it, whichever timeframe is showing. */
function toPrices(raw: number[], endAt: number, amplitude: number) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of raw) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const k = amplitude / (hi - lo || 1);
  const last = raw[raw.length - 1];
  return raw.map((v) => endAt + (v - last) * k);
}

/* 1D is the session the alert-creation screen shows — literally: the same
   `walk(7, 96, 0.22, 3.0)` its candle chart draws, anchored the same way, so
   the two screens are the same stock on the same day in two different skins.

   The walk is unitless, so it is mapped onto dollars by placing the previous
   close at U_REF up the day's range and scaling so the last elapsed value
   lands on REST. U_REF is what decides how much of the day sits below the
   previous close, which in turn is what the chart's anchored fit divides the
   plot height by — keep it just under START_FROM_BOTTOM so the line fills
   the band instead of being squashed into the bottom of it. */
const U_REF = 0.01;
const D1_RAW = walk(7, 96, 0.22, 3.0);

function toSession(raw: number[], now: number, ref: number, uRef: number) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of raw) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo || 1;
  const u = raw.map((v) => (v - lo) / span);
  const scale = (now - ref) / (u[u.length - 1] - uRef);
  return u.map((x) => ref + (x - uRef) * scale);
}

const TFS: Tf[] = [
  { label: "1D", since: "since previous close", series: toSession(D1_RAW, REST, PREV_CLOSE, U_REF) },
  { label: "5D", since: "past 5 days", amplitude: 24, series: walk(19, 90, 0.18, 3.6) },
  { label: "1M", since: "past month", amplitude: 46, series: walk(31, 120, 0.34, 4.4) },
  { label: "6M", since: "past 6 months", amplitude: 104, series: walk(71, 160, 0.22, 7.5) },
  { label: "1Y", since: "past year", amplitude: 158, series: walk(97, 190, 0.3, 9.0) },
  { label: "MAX", since: "all time", amplitude: 262, series: walk(113, 220, 0.26, 11.0) },
].map((t) =>
  t.amplitude == null ? t : { ...t, series: toPrices(t.series, REST, t.amplitude) },
);

/* The session's own figures fall out of the 1D series rather than being
   typed in next to it — the artboard's "Low $327.20 / High $324.19" is
   exactly the drift that happens when they're separate. Low and high also
   take the live quote into account, so the price can never print above a
   high it isn't setting. */
const D1_PRICES = TFS[0].series;
const OPEN = D1_PRICES[0];
const SESSION_LO = Math.min(...D1_PRICES);
const SESSION_HI = Math.max(...D1_PRICES);

/* alert-creation's 1D anchors the previous close 82.3% down its box (its
   LiveCandleChart runs h=188 / pad=14 / startFromBottom=0.12). Keeping that
   RATIO — not the same number of px — is what puts the two charts on the
   same line. The top pad is then opened up well past 14/188: at the matched
   ratio the peak of a rising session lands 16px off the top edge, which
   crowds the change line above it and leaves the pulse ring bleeding out of
   frame. The box grows 30px and the headroom goes to the top, so the anchor
   still sits ~82% down, the tip clears the top by 40, and the whole chart
   extends further down the screen. */
const CHART_H = 244;
const CHART_PAD_T = 40;
const CHART_PAD_B = 18;
const START_FROM_BOTTOM = 0.12;
const PROGRESS = 0.56; // "now" — the constant both house charts already share

/* The header's bare glyphs. 24px box, 44pt hit area via the negative
   inset — the same target glass-button.css gives its own icon buttons. */
const glyphBtn: CSSProperties = {
  position: "relative",
  width: 24,
  height: 24,
  flex: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
};

/* Both panels are the same glass card with a heading, and both carry the
   same two-column label/value grid — so neither is written twice. */
function Panel({
  title,
  marginTop,
  children,
}: {
  title: string;
  marginTop: number;
  children: ReactNode;
}) {
  return (
    <div
      className="nq-glass nq-card"
      style={{
        /* Card inset 8.7dp against the content's 24dp, so it reaches
           15px past the scroller's padding on each side and pulls its own
           16px back in. */
        margin: `${marginTop}px -15px 0`,
        borderRadius: 12,
        padding: "18px 16px 22px",
        boxSizing: "border-box",
      }}
    >
      <span className="inner-stroke inner-stroke--light" />
      {/* The highlight is a positioned element at z-index 3; static content
          paints before it and would sit underneath. z-index 4 is what
          GlassButton gives its own label for exactly this reason. */}
      <div style={{ position: "relative", zIndex: 4 }}>
        <div style={{ fontSize: 19, fontWeight: 600, lineHeight: "26px", color: INK }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

function Facts({
  rows,
  marginTop = 16,
}: {
  rows: [string, string, string, string][];
  marginTop?: number;
}) {
  return (
    <div
      style={{
        marginTop,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        columnGap: 12,
        rowGap: 24,
      }}
    >
      {rows.flatMap(([la, va, lb, vb], r) =>
        [
          [la, va],
          [lb, vb],
        ].map(([label, value], c) => (
          <div key={`${r}-${c}`}>
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: "18px", color: MUTED }}>
              {label}
            </div>
            <div style={{ fontSize: 16, fontWeight: 400, lineHeight: "22px", color: INK, marginTop: 6 }}>
              {value}
            </div>
          </div>
        )),
      )}
    </div>
  );
}

/* Three lines of the blurb at 21px each — the reference truncates there,
   mid-word, with the ellipsis `-webkit-line-clamp` puts in for free. */
const ABOUT_LINE = 21;
const ABOUT_CLAMP = 3;
const ABOUT =
  "Apple, Inc. engages in the design, manufacture, and sale of smartphones, " +
  "personal computers, tablets, wearables and accessories, and other varieties " +
  "of related services. It operates through the following geographical " +
  "segments: Americas, Europe, Greater China, Japan, and Rest of Asia Pacific.";

const ABOUT_FACTS: [string, string, string, string][] = [
  ["CEO", "John Ternus", "Founded", "1976"],
  ["Employees", "166,000", "Headquarters", "Cupertino, California"],
];

const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* Bounce-free throughout. Critical damping is 2*sqrt(stiffness), so
   500/45 moves as fast as 500/35 and stops dead — which is what a control
   that responds to a tap should do. */
const SNAP = { type: "spring", stiffness: 500, damping: 45 } as const;
const MORPH = { type: "spring", visualDuration: 0.34, bounce: 0 } as const;

export function NotiveQuoteScreen({
  fractionalBanner = false,
}: {
  /** Land with the full-width fractional-shares strip already up. Off by
      default — the screen opens on the compact chip, and tapping it is what
      expands the strip. */
  fractionalBanner?: boolean;
}) {
  const reduce = useReducedMotion();

  const [price, setPrice] = useState(REST);
  const [dir, setDir] = useState(0);
  const [tf, setTf] = useState(0);
  const flashRef = useRef<number | undefined>(undefined);
  /* Where in the pulse's cycle to start, so a ring emerges on each price
     change rather than drifting against it. Set once, after mount — doing
     it during render would put a different `animation-delay` in the
     prerendered markup than the one hydration computes. */
  const [pulseOffset, setPulseOffset] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);

  /* One subscription to the shared clock; the tip of the chart, the
     odometer and the change line all move on the same tick, and the price
     colour flashes the direction for ~900ms before settling back to ink. */
  useEffect(() => {
    const unsub = pxHub().subscribe((g: PriceState) => {
      setPrice(+(g.price + PX_OFFSET).toFixed(2));
      setDir(g.dir);
      window.clearTimeout(flashRef.current);
      flashRef.current = window.setTimeout(() => setDir(0), 900);
    });
    const t = pxHub().t ?? Date.now();
    setPulseOffset((Date.now() - t) % (PX_STEP * 2));
    return () => {
      unsub();
      window.clearTimeout(flashRef.current);
    };
  }, []);

  /* ---- fractional card (shared-layout morph, ported from the alert
     screen). One `layoutId` element is both the full-width strip and the
     compact header chip; `settled` stops a fast dismiss from inheriting the
     opening spring's velocity and overshooting on the way back. ---- */
  const [fracOpen, setFracOpen] = useState(fractionalBanner);
  const [fracSettled, setFracSettled] = useState(true);
  const settleRef = useRef<number | undefined>(undefined);
  const fracSpring = {
    type: "spring",
    visualDuration: 0.3,
    bounce: 0,
    borderRadius: { duration: 0 },
  } as const;
  const fracSpringClose = {
    type: "spring",
    visualDuration: 0.26,
    bounce: 0,
    borderRadius: { duration: 0 },
  } as const;
  const fracGlyphPop = { type: "spring", visualDuration: 0.22, bounce: 0, delay: 0.05 } as const;
  const openFrac = () => {
    setFracOpen(true);
    setFracSettled(false);
    /* `onLayoutAnimationComplete` is the fast path out of the guard below,
       but it only fires if Motion actually ran a layout animation — and if
       it doesn't fire, `fracSettled` never returns to true and the dismiss
       is blocked forever. That went unnoticed while the screen opened with
       the strip already up (`fracSettled` started true, so the first
       dismiss worked and nobody reached the second). Opening collapsed
       makes `openFrac` the first thing that runs, and the X stopped
       working. This timer is the open spring's own duration plus a frame,
       so the guard always clears whether the callback arrives or not. */
    window.clearTimeout(settleRef.current);
    settleRef.current = window.setTimeout(() => setFracSettled(true), 340);
  };
  const dismissFrac = () => {
    if (!fracSettled) return;
    window.clearTimeout(settleRef.current);
    setFracOpen(false);
  };
  useEffect(() => () => window.clearTimeout(settleRef.current), []);

  const active = TFS[tf];
  const reference = tf === 0 ? PREV_CLOSE : active.series[0];
  const change = price - reference;
  const up = change >= 0;

  const lineColor = up ? UP_LINE : DOWN_LINE;
  const fillRgb = up ? UP_RGB : DOWN_RGB;
  const changeColor = up ? UP_TEXT : DOWN_TEXT;
  const chipInk = up ? UP_CHIP_INK : DOWN_CHIP_INK;
  const priceColor = dir === 0 ? INK : dir > 0 ? UP_TEXT : DOWN_TEXT;

  const sign = change >= 0 ? "+" : "−";
  const pct = reference ? (Math.abs(change) / reference) * 100 : 0;

  const stats: [string, string, string, string][] = [
    ["Previous close", "$" + money(PREV_CLOSE), "Open", "$" + money(OPEN)],
    [
      "Day low",
      "$" + money(Math.min(SESSION_LO, price)),
      "Day high",
      "$" + money(Math.max(SESSION_HI, price)),
    ],
    ["Volume", "48.2M", "Avg volume", "56.9M"],
    ["Market cap", "4.82T", "P/E ratio", "39.60"],
  ];

  /* Header, taken from the fractional order flow's own
     (/work/fractional-order-flow): "AAPL (Apple Inc.)" on a muted line with
     bare glyphs at its right, then the quote with USD. The Notive change
     line sits under that, and the fractional card's compact state sits at
     its right — which is where the order flow puts its own fractional icon
     too, at the end of the row under the price. (The order flow also
     carries a Bid/Ask readout opposite the price; dropped here on request.) */
  const header = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: 24 }}>
        <span style={{ lineHeight: 0, flex: "none", color: INK }}>
          <AppleIcon size={15} />
        </span>
        <span style={{ fontSize: 14, lineHeight: "22px", color: MUTED }}>
          {SYMBOL} ({NAME})
        </span>
        <span style={{ flex: 1 }} />
        {/* Bare glyphs, as the order flow draws its own close — the glass in
            this header is the fractional card alone. */}
        <button aria-label="Search" style={{ ...glyphBtn, color: INK }}>
          <SearchIcon />
        </button>
        <button aria-label="Close" style={{ ...glyphBtn, color: INK }}>
          <CloseIcon />
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", marginTop: 12 }}>
        <Rolling
          value={"$" + money(price)}
          style={{
            fontSize: 35,
            fontWeight: 400,
            lineHeight: 1,
            color: priceColor,
            transition: "color 760ms cubic-bezier(.4,0,.2,1)",
          }}
        />
        {/* The odometer's digit cells are 1.15em boxes, which puts their
            baseline 6.55px above the box bottom at 35px; "USD" at 14px/1
            sits 1.6px above its own. The 5px lifts it onto the same
            baseline the artboard draws them on. */}
        <span
          style={{
            fontSize: 14,
            fontWeight: 400,
            lineHeight: 1,
            paddingBottom: 5,
            marginLeft: 9,
            color: MUTED,
          }}
        >
          USD
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginTop: 6,
          fontSize: 14,
          lineHeight: "19px",
          color: INK,
          minHeight: 28,
        }}
      >
        <span style={{ color: changeColor, transition: "color 520ms ease" }}>
          {sign}${money(Math.abs(change))}
        </span>
        <span style={{ color: changeColor, transition: "color 520ms ease" }}>
          ({sign}
          {pct.toFixed(2)}%)
        </span>
        <span>{active.since}</span>
        <span style={{ flex: 1 }} />

        {/* The compact half of the fractional card. Fixed 28px slot so the
            row never reflows as the card morphs in and out of it. */}
        <div style={{ width: 30, height: 30, flex: "none", position: "relative" }}>
          {!fracOpen && (
            <motion.div
              layoutId="nq-frac-card"
              className="nq-frac"
              transition={fracSpringClose}
              initial={{ opacity: 0 }}
              /* borderRadius is an explicit animate target, not just a
                 static style: otherwise shared-layout crossfades it
                 continuously alongside width/height and the corner reads as
                 a slow, mushy square -> round instead of an immediate
                 change. */
              animate={{ opacity: 1, borderRadius: 999, transition: { duration: 0.2 } }}
              role="button"
              tabIndex={0}
              aria-label="Fractional shares"
              onClick={openFrac}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openFrac();
                }
              }}
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                isolation: "isolate",
                cursor: "pointer",
              }}
            >
              <span className="inner-stroke inner-stroke--blue" />
              <motion.span
                layoutId="nq-frac-glyph"
                className="nq-frac-glyph"
                style={{ position: "relative", zIndex: 4, lineHeight: 0 }}
              >
                <FractionalIcon />
              </motion.span>
            </motion.div>
          )}
        </div>
      </div>
    </>
  );

  const banner = (
    /* Outer slot owns the layout height so the content below follows the
       collapse immediately; the inner `layoutId` box floats on top of it and
       morphs to / from the header chip. */
    <AnimatePresence initial={false}>
      {fracOpen && (
        <motion.div
          key="nq-frac-slot"
          initial={{ height: 0, marginTop: 0 }}
          animate={{ height: 40, marginTop: 12 }}
          exit={{ height: 0, marginTop: 0, transition: { duration: 0.12, ease: [0.4, 0, 0.2, 1] } }}
          transition={{ duration: 0.17, ease: [0.4, 0, 0.2, 1] }}
          style={{ position: "relative", marginLeft: -24, marginRight: -24 }}
        >
          <motion.div
            layoutId="nq-frac-card"
            transition={fracSpring}
            onLayoutAnimationComplete={() => {
              window.clearTimeout(settleRef.current);
              setFracSettled(true);
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, borderRadius: 0, transition: { duration: 0.16 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            role="button"
            tabIndex={0}
            aria-label="Dismiss fractional shares notice"
            onClick={dismissFrac}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                dismissFrac();
              }
            }}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: 40,
              zIndex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 24px",
              boxSizing: "border-box",
              background: FRAC_TINT,
              color: FRAC,
              cursor: "pointer",
              overflow: "hidden",
            }}
          >
            <motion.span
              layoutId="nq-frac-glyph"
              className="nq-frac-glyph"
              transition={{ layout: fracGlyphPop }}
              style={{ flex: "none", lineHeight: 0 }}
            >
              <motion.span
                initial={{ scale: 0.6, opacity: 0.4 }}
                animate={{ scale: 1, opacity: 1, transition: fracGlyphPop }}
                style={{ display: "block" }}
              >
                <FractionalIcon />
              </motion.span>
            </motion.span>

            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.2, delay: 0.14 } }}
              exit={{ opacity: 0, transition: { duration: 0.06 } }}
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Fractional shares available for {SYMBOL}
            </motion.span>

            <motion.span
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7, transition: { duration: 0.2, delay: 0.14 } }}
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
  );

  const chart = (
    /* Full bleed: the artboard runs the line clean off both edges, so the
       chart cancels the scroller's 24px insets rather than sitting inside
       them. */
    <div style={{ width: "calc(100% + 48px)", margin: "10px -24px 0" }}>
      <LiveAreaChart
        w={386}
        h={CHART_H}
        padT={CHART_PAD_T}
        padB={CHART_PAD_B}
        series={active.series}
        /* Live only on 1D — same rule as alert-creation. A historical
           period has no "now", so it takes the min..max fit, fills the
           width and fades its pulse out. */
        reference={tf === 0 ? PREV_CLOSE : undefined}
        startFromBottom={tf === 0 ? START_FROM_BOTTOM : undefined}
        progress={tf === 0 ? PROGRESS : 1}
        pulse={tf === 0}
        /* Two ticks per cycle, two rings half a cycle apart — so exactly
           one ring emerges per price change, on the beat. */
        pulseMs={PX_STEP * 2}
        pulseOffset={pulseOffset}
        price={tf === 0 ? price : undefined}
        restPrice={REST}
        line={lineColor}
        fillRgb={fillRgb}
        fillAlpha={0.45}
        strokeWidth={2.3}
      />
    </div>
  );

  const rail = (
    <div
      role="tablist"
      aria-label="Chart range"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 36,
      }}
    >
      {TFS.map((t, i) => (
        <button
          key={t.label}
          role="tab"
          aria-selected={tf === i}
          tabIndex={tf === i ? 0 : -1}
          onClick={() => setTf(i)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              setTf((v) => (v + (e.key === "ArrowRight" ? 1 : TFS.length - 1)) % TFS.length);
            }
          }}
          style={{
            position: "relative",
            /* The artboard's selected pill measures 39.7 x 32 with its left
               edge on the 24dp column — so the rail sits in the content
               column, not outdented, and the pill's padding is what gives
               "1D" its 39.7. */
            height: 32,
            minWidth: 38,
            padding: "0 12px",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            background: "transparent",
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1,
            color: tf === i ? chipInk : INK,
            transition: "color 180ms ease",
          }}
        >
          {tf === i && (
            <motion.span
              layoutId="nq-tf-pill"
              className="nq-glass nq-tf-pill"
              aria-hidden="true"
              transition={SNAP}
              style={{ position: "absolute", inset: 0, borderRadius: 999 }}
            >
              <span className="inner-stroke inner-stroke--light" />
            </motion.span>
          )}
          {/* z-index 4, exactly as GlassButton gives its own `.label`. The
              pill is a solid fill and its inner highlight sits at z-index 3;
              a bare text node would paint under both. */}
          <span style={{ position: "relative", zIndex: 4 }}>{t.label}</span>
        </button>
      ))}
    </div>
  );

  const statsCard = (
    <Panel title="Key statistics" marginTop={28}>
      <Facts rows={stats} />
    </Panel>
  );

  const about = (
    <Panel title={`About ${NAME.replace(/ Inc\.$/, "")}`} marginTop={16}>
      {/* Motion animates the box; the clamp is what produces the ellipsis,
          and it flips instantly in both directions so the text is already
          the right shape before the height starts moving. `height: auto`
          on expand lets Motion measure the full blurb itself. */}
      <motion.div
        initial={false}
        animate={{ height: aboutOpen ? "auto" : ABOUT_LINE * ABOUT_CLAMP }}
        transition={reduce ? { duration: 0 } : { duration: 0.34, ease: [0.4, 0, 0.2, 1] }}
        style={{ overflow: "hidden", marginTop: 14 }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 400,
            lineHeight: `${ABOUT_LINE}px`,
            color: INK,
            display: aboutOpen ? "block" : "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: aboutOpen ? undefined : ABOUT_CLAMP,
            overflow: "hidden",
          }}
        >
          {ABOUT}
        </p>
      </motion.div>

      <button
        onClick={() => setAboutOpen((v) => !v)}
        aria-expanded={aboutOpen}
        style={{
          marginTop: 10,
          background: "transparent",
          color: UP_CHIP_INK,
          fontSize: 14,
          fontWeight: 600,
          lineHeight: "20px",
          textDecoration: "underline",
          textUnderlineOffset: 4,
        }}
      >
        {aboutOpen ? "Show less" : "Show more"}
      </button>

      <Facts rows={ABOUT_FACTS} marginTop={22} />
    </Panel>
  );

  /* Buy / Sell float over the content rather than sitting under it — the
     artboard draws them clipping the stats grid, which is a floating action
     bar, not a footer. They go in the frame's overlay slot so the scroller
     keeps running underneath; the scroller carries 96px of extra bottom
     padding so nothing is permanently trapped behind them.

     Solid, not glass: two goes at a translucent pair both washed out over
     the white card and read as unavailable rather than as material. */
  const actions = (
    <div
      style={{
        position: "absolute",
        left: 24,
        right: 24,
        bottom: 28,
        /* The scrim is a child so it can bleed to the screen edges while the
           pills keep their 24px column — hence the negative insets on it. */
        display: "flex",
        gap: 16,
        pointerEvents: "auto",
      }}
    >
      <div className="nq-scrim" aria-hidden="true" />
      {[
        { label: "Buy", cls: "nq-cta--buy" },
        { label: "Sell", cls: "nq-cta--sell" },
      ].map((b) => (
        <motion.button
          key={b.label}
          className={`nq-cta ${b.cls}`}
          style={{ flex: 1 }}
          whileTap={reduce ? undefined : { scale: 0.97 }}
          transition={SNAP}
        >
          {b.label}
        </motion.button>
      ))}
    </div>
  );

  return (
    <PhoneStage>
      <div className="nq-root">
        <PhoneFrame
          fullDevice
          screenBg={BG}
          statusBar="drawn"
          statusColor={INK}
          overlay={actions}
        >
          <div style={{ paddingBottom: 96 }}>
            <LayoutGroup>
              {header}
              {banner}
            </LayoutGroup>
            {chart}
            {rail}
            {statsCard}
            {about}
          </div>
        </PhoneFrame>
      </div>
    </PhoneStage>
  );
}
