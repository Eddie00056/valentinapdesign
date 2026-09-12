import { useId, useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import "./live-area-chart.css";

/* Full-bleed area chart — the Notive quote screen's 1D/5D/1M/… chart, and
   the third member of the chart set alongside LiveCandleChart (Robinhood
   "advanced") and LiveLineChart (the pulse-dot study). It is the two of
   them merged: LiveLineChart's line treatment — cool body, hot recent
   segment, a pulse ring at "now" — under a gradient wash, positioned by
   LiveCandleChart's parameters so it can be anchored exactly where the
   alert-creation screen anchors its own 1D.
 *
 * Four things make it worth its own component rather than SVG inlined in a
 * screen:
 *
 * 1. **The path morphs between timeframes.** Every series is resampled to
 *    the same `n`, so every `d` string has the same command count and
 *    Motion can interpolate one into the next. Switching 1D -> 1Y flows
 *    instead of cutting. (Mismatched command counts fall back to a hard
 *    swap, which is the whole reason `n` is fixed here and not per-series.)
 *
 * 2. **Two fits, one for each job.** Give it `reference` +
 *    `startFromBottom` and it uses LiveCandleChart's anchored fit: the
 *    reference price sits at a fixed height and the series is scaled to
 *    whichever side runs out of room first. That is what makes a live
 *    session start where alert-creation's starts. Leave them off and it
 *    falls back to fitting min..max into the band, which is what the
 *    historical timeframes want — they have no "now" to anchor to.
 *
 * 3. **The vertical fit is computed from the STATIC series only.** The live
 *    tail shifts the last few points every price tick; if the fit were
 *    recomputed with it, the whole chart would rescale a fraction of a
 *    pixel on every tick and the entire line would shimmer.
 *
 * 4. **The live tail moves in pixels, not in price.** `unitPx` is small and
 *    deliberately unrelated to the series' own px-per-dollar — the same
 *    call LiveCandleChart makes for its "now" line. At the anchored fit's
 *    real scale (~35px/$ on the quote screen) an ordinary tick would throw
 *    the tip clean out of the box; at 6px/$ it nudges and settles.
 *
 * Motion is tick-driven throughout: the tail eases to its new position over
 * ~0.42s and then HOLDS. The only thing that runs continuously is the pulse
 * ring, which is a beacon, not data.
 */

export type LiveAreaChartProps = {
  w?: number;
  h?: number;
  /** Plot inset, top and bottom. Express it as the same FRACTION of `h` the
      chart you're matching uses, not the same number of px — that is what
      lands two differently-sized charts on the same line. */
  padT?: number;
  padB?: number;
  /** The series, in price units (dollars). Resampled to `n` points. */
  series: number[];
  /** Fixed across every series so the path can morph between them. */
  n?: number;
  /** Anchored fit: the price that sits at `startFromBottom`. Usually the
      previous close. Omit for the min..max fit. */
  reference?: number;
  /** Where `reference` sits, as a fraction of the plot height up from its
      bottom. Only meaningful alongside `reference`. */
  startFromBottom?: number;
  /** Fraction of the width the elapsed series spans. 1 = edge to edge (a
      closed historical period); less leaves the rest as unfilled future,
      with "now" at the end of the line. */
  progress?: number;
  /** The line, the dot and the pulse — one colour throughout. An earlier
      version popped the recent segment to a darker green, Robinhood-style;
      on a light ground that just read as the chart getting heavier towards
      "now". The elapsed session is separated by ALPHA instead: the stroke
      carries a horizontal gradient from `lineFade` at the open to full
      strength at the tip, so older is fainter with no seam anywhere. */
  line: string;
  /** Stroke alpha at the left edge of the series.

      This wants to be much closer to 1 than it looks like it should. The
      ramp is read as a *whole line*, not as two ends compared side by side,
      so anything that reads as "faint" at the open reads as a washed-out
      chart overall: 0.22 made the first half of the session vanish and 0.45
      still read as faded. At 0.72 the early session is unmistakably a line
      and the tip still visibly leads it. */
  lineFade?: number;
  /** Area fill, as a bare "r,g,b" triple — the gradient needs its own alpha
      stops, and a hex would have to be parsed to get them. */
  fillRgb: string;
  /** Alpha at the top of the fill; it ramps to 0 at the bottom of the box. */
  fillAlpha?: number;
  strokeWidth?: number;
  /** Dot + pulse ring at "now". Off for historical timeframes, which have
      no "now" to mark. */
  pulse?: boolean;
  /** One full ring cycle, ms. Two rings run half a cycle apart, so a ring
      emerges every `pulseMs / 2` — set this to TWICE the quote's tick
      interval and one ring emerges per price change. */
  pulseMs?: number;
  /** How far into the cycle the rings should already be at mount, ms.
      Applied as a negative `animation-delay`, which is what phase-locks a
      free-running CSS animation to the quote clock: pass the time since the
      last tick and the ring's cycle starts where that tick was. */
  pulseOffset?: number;
  /** Live price. When set, the last `tailPoints` bend toward it, so the tip
      of the line tracks the shared price clock. Leave undefined on the
      historical timeframes, where a live tip would be a lie. */
  price?: number;
  /** The price the static series already ends at — the tail shift is the
      difference between this and `price`. */
  restPrice?: number;
  /** Pixels per $1 of live move. Small on purpose — see note 4. */
  unitPx?: number;
  tailPoints?: number;
  /** Draw the line on from nothing on first mount. */
  drawIn?: boolean;
  /** Bumped by the host to replay the draw-in (e.g. on a manual refresh). */
  drawKey?: number;
};

/* Snap-then-rest, the house ease. Declared as explicit 4-tuples, not
   number[]: Motion's `Easing` union only accepts a tuple for a cubic
   bezier, and a widened array fails the check. */
const EASE_SNAP: [number, number, number, number] = [0.33, 1, 0.68, 1];
const EASE_DRAW: [number, number, number, number] = [0.4, 0, 0.2, 1];

/* The "now" pulse is CSS, in live-area-chart.css — the whole of why is
   written up there. In short: this group re-renders on every price tick,
   and a Motion `repeat` re-evaluated that often reads as a restart. */

/* How the wash stops at "now".

   Two shapes were wrong before this one. A two-stop LINEAR ramp has a corner
   in its alpha curve at each end and the eye finds them: the start of the
   ramp showed up as a vertical Mach band straight down the wash, and at 28px
   it read as a stripe rather than a fade. Plain smoothstep over 64px killed
   the band but spent its whole span fading, so the wash was already half
   gone well before "now" and the chart read washed out.

   So: smoothstep of u SQUARED, over a wider span. Remapping the input keeps
   the curve flat near 1 for the first half — the wash stays full strength
   until ~40px out — and puts the actual fall in the last third, while still
   leaving 1 and arriving at 0 with zero slope at both ends, which is the
   part that has to hold. Sampled densely towards the end, where it moves. */
const FADE = 84;
const FADE_CURVE: [number, number][] = [
  [0, 1],
  [0.2, 0.995],
  [0.35, 0.959],
  [0.5, 0.844],
  [0.62, 0.67],
  [0.72, 0.472],
  [0.8, 0.296],
  [0.87, 0.149],
  [0.93, 0.05],
  [1, 0],
];

/* Two rings, half a cycle apart, so one is always in flight and the eye
   never catches the loop's seam. The phase is a negative animation-delay,
   set inline per ring — the stylesheet's own values are the fallback for a
   caller that doesn't pass `pulseMs`. */
const PULSE_RINGS = ["lac-pulse", "lac-pulse lac-pulse--b"];

/* Resample to a fixed point count with linear interpolation. */
function resample(raw: number[], n: number) {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (raw.length - 1);
    const a = Math.floor(t);
    const b = Math.min(raw.length - 1, a + 1);
    out.push(raw[a] + (raw[b] - raw[a]) * (t - a));
  }
  return out;
}

export function LiveAreaChart({
  w = 386,
  h = 214,
  padT = 6,
  padB = 0,
  series,
  n = 110,
  reference,
  startFromBottom,
  progress = 1,
  line,
  lineFade = 0.72,
  fillRgb,
  fillAlpha = 0.45,
  strokeWidth = 2.3,
  pulse = false,
  pulseMs = 3400,
  pulseOffset = 0,
  price,
  restPrice,
  unitPx = 6,
  tailPoints = 18,
  drawIn = true,
  drawKey = 0,
}: LiveAreaChartProps) {
  const reduce = useReducedMotion();

  /* Static geometry: the resampled series and the value -> y mapping. Both
     depend only on the series, never on the live price (see note 3). */
  const { vals, y } = useMemo(() => {
    const vals = resample(series, n);
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of vals) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }

    if (reference != null && startFromBottom != null) {
      const baselineY = padT + (h - padT - padB) * (1 - startFromBottom);
      const spaceUp = baselineY - padT;
      const spaceDown = h - padB - baselineY;
      const k = Math.min(
        hi - reference > 0 ? spaceUp / (hi - reference) : Infinity,
        reference - lo > 0 ? spaceDown / (reference - lo) : Infinity,
      );
      return { vals, y: (v: number) => baselineY - (v - reference) * k };
    }

    const span = hi - lo || 1;
    const k = (h - padT - padB) / span;
    return { vals, y: (v: number) => padT + (hi - v) * k };
  }, [series, n, h, padT, padB, reference, startFromBottom]);

  /* Live tail. The shift ramps in over the last `tailPoints` so the tip
     bends rather than kinks — a hard step on the final point alone reads as
     a glitch, not a quote — and it is clamped so a long run can't walk the
     tip out through the top of the box. */
  const { linePath, areaPath, nowX, nowY } = useMemo(() => {
    const last = vals.length - 1;
    const endX = w * progress;
    const baseTipY = y(vals[last]);
    const rawShift =
      price != null && restPrice != null ? (price - restPrice) * unitPx : 0;
    const shift = Math.max(
      baseTipY - (h - padB * 0.5),
      Math.min(baseTipY - padT * 0.5, rawShift),
    );

    const pts: [number, number][] = [];
    for (let i = 0; i <= last; i++) {
      const ramp =
        shift === 0 ? 0 : Math.max(0, i - (last - tailPoints)) / tailPoints;
      pts.push([(i / last) * endX, y(vals[i]) - shift * ramp]);
    }
    const d = (from: number) =>
      pts
        .slice(from)
        .map(
          (p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(2) + " " + p[1].toFixed(2),
        )
        .join("");

    const full = d(0);
    return {
      linePath: full,
      areaPath: `${full}L${endX.toFixed(2)} ${h}L0 ${h}Z`,
      nowX: endX,
      nowY: pts[last][1],
    };
  }, [
    vals,
    y,
    w,
    h,
    padT,
    padB,
    progress,
    price,
    restPrice,
    unitPx,
    tailPoints,
  ]);

  /* One id per instance so two charts on a page can't share a gradient.
     useId, not Math.random: these screens are prerendered by Astro and then
     hydrated, and a random id differs between the two passes — the markup
     mismatches and the fill points at a gradient that isn't there. */
  const gid = "lac-" + useId().replace(/:/g, "");
  const fadeId = gid + "-fade";
  const strokeId = gid + "-stroke";

  /* A live chart's wash has to stop at "now", and stopping it leaves a full-
     height alpha cliff right under the dot — at the top of a rising session
     that edge is ~0.4 opaque and reads as a rendering fault. 28px of
     horizontal fade turns it into the session tapering into the present.
     Historical periods run to the edge and need none of it. */
  /* Rendered unconditionally, with the stops ANIMATED. Mounting the mask
     only when `progress < 1` cut 44% of the wash away on the first frame of
     a MAX -> 1D change while the path was still travelling — the wash
     vanished, then the line caught up. Parking every stop at offset 1 is
     the no-op state, and it is a value they can animate to and from. */
  const fadeEnd = progress < 1 ? nowX / w : 1;
  const fadeStart = progress < 1 ? Math.max(0, (nowX - FADE) / w) : 1;
  const fadeStops = FADE_CURVE.map(([u, a]) => ({
    offset: fadeStart + u * (fadeEnd - fadeStart),
    a,
  }));

  /* Reduced motion cuts straight to the new shape — no crawl at all.
     0.55s rather than the tail's own beat: MAX -> 1D is not a nudge, it is
     every point moving in x AND y at once (edge-to-edge becomes 56% wide)
     while the fit swaps from min..max to anchored. At 0.42 that much change
     reads as a jump; the extra 130ms is what turns it into a move. */
  const morph = reduce ? { duration: 0 } : { duration: 0.55, ease: EASE_SNAP };

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      style={{ display: "block", overflow: "visible" }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`rgba(${fillRgb},${fillAlpha})`} />
          <stop offset="100%" stopColor={`rgba(${fillRgb},0)`} />
        </linearGradient>
        {/* Object-bounding-box units, so this spans exactly the elapsed
            series however wide that is — no coordinate to keep in sync with
            `progress`, and it re-maps itself as the path morphs. */}
        <linearGradient id={strokeId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={`rgba(${fillRgb},${lineFade})`} />
          <stop offset="100%" stopColor={`rgba(${fillRgb},1)`} />
        </linearGradient>
        <linearGradient id={`${fadeId}-g`} x1="0" y1="0" x2="1" y2="0">
          {fadeStops.map((st, i) => (
            <motion.stop
              key={i}
              initial={false}
              animate={{ offset: st.offset, stopOpacity: st.a }}
              transition={morph}
              stopColor="#fff"
            />
          ))}
        </linearGradient>
        <mask id={fadeId} maskUnits="userSpaceOnUse" x="0" y="0" width={w} height={h}>
          <rect x="0" y="0" width={w} height={h} fill={`url(#${fadeId}-g)`} />
        </mask>
      </defs>

      {/* The wash stops at "now" with the line — past it is future, and a
          wash under empty space reads as data nobody has yet. */}
      <motion.path
        d={areaPath}
        fill={`url(#${gid})`}
        mask={`url(#${fadeId})`}
        initial={drawIn && !reduce ? { opacity: 0 } : false}
        animate={{ d: areaPath, opacity: 1 }}
        transition={{ ...morph, opacity: { duration: 0.5, delay: 0.15 } }}
      />

      <motion.path
        key={drawKey}
        d={linePath}
        fill="none"
        stroke={`url(#${strokeId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={drawIn && !reduce ? { pathLength: 0 } : false}
        animate={{ d: linePath, pathLength: 1 }}
        transition={{ ...morph, pathLength: { duration: 0.95, ease: EASE_DRAW } }}
      />

      {/* The recent segment, drawn over the body so the join disappears
          under the heavier stroke. It arrives after the draw-in finishes —
          a tail that pops while the line is still drawing reads as two
          charts fighting. */}
      {/* "now". The group carries the position — and nothing else — so the
          rings and the dot travel as one object while each ring keeps its
          own independent CSS loop. */}
      <motion.g
        initial={false}
        animate={{ x: nowX, y: nowY, opacity: pulse ? 1 : 0 }}
        transition={reduce ? { duration: 0 } : { ...morph, opacity: { duration: 0.3 } }}
        style={{ pointerEvents: "none" }}
      >
        {PULSE_RINGS.map((cls, i) => (
          <circle
            key={cls}
            className={cls}
            r={3.6}
            fill={line}
            /* Inline, so both values are constant strings across renders —
               React leaves an unchanged style property alone, and the
               animation is never restarted by a price tick re-rendering
               this subtree. */
            style={{
              animationDuration: `${pulseMs}ms`,
              animationDelay: `-${pulseOffset + (i * pulseMs) / 2}ms`,
            }}
          />
        ))}
        <circle r={3.6} fill={line} />
      </motion.g>
    </svg>
  );
}
