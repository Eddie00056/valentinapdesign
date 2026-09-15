import { useEffect } from "react";
import type { KeyboardEvent } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTime,
  useTransform,
} from "motion/react";
import type { MotionValue } from "motion/react";

/**
 * Holdings — four circular logos in a 2×2, and a magnifying glass you pick
 * up and move over them. The four are fixed: MSFT, META, AAPL, GOOGL.
 *
 * The logos rest at 10% and the glass is what brings them up. It doesn't
 * magnify: it holds a second copy of the same scene at 1:1, logos at full
 * opacity, clipped to the lens and offset so it lies exactly over the real
 * one. Both copies read one clock, so the drift happens in both in the same
 * frame — and the lens edge is a clean line between dim and lit, cutting
 * straight through a logo it half covers.
 *
 * The glass is a hair bigger than a logo (1px all round) and goes exactly
 * where your hand takes it — no snapping, no easing between hand and glass.
 */
export function HoldingsMagnifier() {
  const reduce = useReducedMotion() ?? false;

  // One drift for the whole unit, off the frame clock rather than a
  // keyframe loop, so the real grid and the lit one can never be a frame
  // apart
  const time = useTime();
  const driftX = useTransform(time, (t) =>
    reduce ? 0 : Math.sin((t / DRIFT_MS) * Math.PI * 2) * 1.5
  );
  const driftY = useTransform(time, (t) =>
    reduce ? 0 : Math.sin((t / DRIFT_MS) * Math.PI * 2 + Math.PI / 2) * 2.5
  );
  // ...and each logo breathes on its own period on top (tcosta.com's
  // per-logo float: ±2 up, ±1.5 across, 7–10s, phased), still off the one clock
  const bob = FLOAT.map(({ ms, phase }) =>
    useTransform(time, (t) => (reduce ? 0 : Math.sin(((t + phase) / ms) * Math.PI * 2) * 2))
  );
  const sway = FLOAT.map(({ ms, phase }) =>
    useTransform(time, (t) => (reduce ? 0 : Math.cos(((t + phase) / ms) * Math.PI * 2) * 1.5))
  );

  // ── The lens ──────────────────────────────────────────────────────────
  // x / y are the glass's top-left in stage px. Drag and arrow keys write
  // them, the lit copy is their negative, and nothing re-renders while it
  // moves — one value, read directly, is what keeps a fast drag glued to
  // the pointer.
  const lensX = useMotionValue(LENS_HOME.x);
  const lensY = useMotionValue(LENS_HOME.y);
  const innerX = useTransform(lensX, (x) => -x);
  const innerY = useTransform(lensY, (y) => -y);

  // Arrow keys move the glass the way a drag does; Shift for bigger steps
  const onLensKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 24 : 6;
    const d =
      e.key === "ArrowLeft" ? [-step, 0]
      : e.key === "ArrowRight" ? [step, 0]
      : e.key === "ArrowUp" ? [0, -step]
      : e.key === "ArrowDown" ? [0, step]
      : null;
    if (!d) return;
    e.preventDefault();
    lensX.set(clamp(lensX.get() + d[0], BOUNDS.left, BOUNDS.right));
    lensY.set(clamp(lensY.get() + d[1], BOUNDS.top, BOUNDS.bottom));
  };

  /* ?auto: the glass moves by itself, the way tcosta.com's holdings logos
     move — one soft spring per hop (his 250 / 24 / 0.8), a randomised dwell
     on each logo (his 1.8–3.4s swap cadence), the handle leaning into the
     move on his snappier 460 / 26 / 0.65 and settling back. Springs, not
     eases: the glass rolls to a stop instead of arriving on a curve. */
  const lean = useMotionValue(0);
  useEffect(() => {
    if (reduce || !new URLSearchParams(window.location.search).has("auto")) return;
    let live = true;
    let slot = -1;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const HOP = { type: "spring", stiffness: 250, damping: 24, mass: 0.8 } as const;
    const LEAN = { type: "spring", stiffness: 460, damping: 26, mass: 0.65 } as const;
    (async () => {
      await wait(1400);
      while (live) {
        let next = Math.floor(Math.random() * 4);
        if (next === slot) next = (next + 1 + Math.floor(Math.random() * 3)) % 4;
        const x = GRID_LEFT + slotX(next) - 1;
        const y = GRID_TOP + slotY(next) - 1;
        const dir = Math.sign(x - lensX.get()) || (Math.random() < 0.5 ? -1 : 1);
        slot = next;
        animate(lean, dir * 9, LEAN);
        await Promise.all([animate(lensX, x, HOP), animate(lensY, y, HOP)]);
        if (!live) return;
        animate(lean, 0, LEAN);
        await wait(1800 + Math.random() * 1600);
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  return (
    <div className="he-root">
      <div className="he-card" data-thumb>
        <Scene driftX={driftX} driftY={driftY} bob={bob} sway={sway} reduce={reduce} />

        <motion.div
          className="he-lens"
          role="group"
          aria-roledescription="magnifying glass"
          aria-label="Magnifying glass. Drag it, or use the arrow keys."
          tabIndex={0}
          drag
          // The card's bounds as numbers in the glass's own x / y. A ref
          // constraint is measured off the element's box and came back
          // offset by wherever the glass already was, pinning it to a strip
          dragConstraints={BOUNDS}
          // No elastic and no momentum: the glass stops where the hand does
          // and never rubber-bands at the card edge
          dragElastic={0}
          dragMomentum={false}
          onKeyDown={onLensKey}
          style={{ x: lensX, y: lensY }}
          // No lift scale: a scaled lens would scale the lit copy with it,
          // and the logos under the glass must stay exactly their size
        >
          {/* Entrance on its own layer, opacity only — for the same reason */}
          <motion.div
            className="he-lens-body"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reduce ? INSTANT : { duration: 0.4, ease: "easeOut", delay: 0.6 }}
          >
            <div className="he-glass-frame">
              <motion.span className="he-lean" style={{ rotate: lean }} aria-hidden="true">
                <span className="he-handle" />
              </motion.span>
              <div className="he-glass" aria-hidden="true">
                <motion.div
                  className="he-glass-view"
                  style={{ x: innerX, y: innerY }}
                >
                  <Scene driftX={driftX} driftY={driftY} bob={bob} sway={sway} reduce={reduce} mirror />
                </motion.div>
                <span className="he-glass-sheen" />
              </div>
              <span className="he-rim" aria-hidden="true" />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

// ── The scene ───────────────────────────────────────────────────────────

/** Everything the lens can see, drawn once for the card and once inside
    the lens. The mirror is inert and out of the accessibility tree. */
function Scene({
  driftX,
  driftY,
  bob,
  sway,
  reduce,
  mirror = false,
}: {
  driftX: MotionValue<number>;
  driftY: MotionValue<number>;
  bob: MotionValue<number>[];
  sway: MotionValue<number>[];
  reduce: boolean;
  mirror?: boolean;
}) {
  return (
    <div className={mirror ? "he-scene he-scene--lit" : "he-scene"} inert={mirror || undefined}>
      <motion.div className="he-grid" style={{ x: driftX, y: driftY }}>
        {LOGOS.map((logo, slot) => (
          <motion.div
            key={logo.ticker}
            className="he-tile"
            // Position with left/top; the float rides on x/y, the pop inside owns its own transform
            style={{ left: slotX(slot), top: slotY(slot), x: sway[slot], y: bob[slot] }}
          >
            <motion.div
              className="he-logo"
              initial={reduce ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={reduce ? INSTANT : { ...popSpring, delay: 0.15 + slot * 0.09 }}
            >
              <img src={logo.src} alt={mirror ? "" : logo.ticker} draggable={false} />
            </motion.div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

// ── Logos ───────────────────────────────────────────────────────────────

// In slot order: top-left, top-right, bottom-left, bottom-right. Each is a
// full-bleed square on the CDN, which is what lets the tile's own radius
// (a circle) be the logo's shape
const LOGOS = [
  ["msft", "xnas"],
  ["meta", "xnas"],
  ["aapl", "xnas"],
  ["googl", "xnas"],
].map(([ticker, mic]) => ({
  ticker: ticker.toUpperCase(),
  src: `https://logos.wealthsimple.com/${ticker}-${mic}.svg`,
}));

// ── Layout ──────────────────────────────────────────────────────────────
// The CSS mirrors these (holdings-magnifier.css says which).

/** The card — just enough room round the grid for the glass to travel.
    Fixed, so the lit copy lays out identically. */
const STAGE = { w: 240, h: 240 };
const TILE = 40;
/** One clearance between tiles, everywhere. */
const GAP = 6;
const GRID = TILE * 2 + GAP;
const GRID_LEFT = (STAGE.w - GRID) / 2;
const GRID_TOP = (STAGE.h - GRID) / 2;

const slotX = (slot: number) => (slot % 2) * (TILE + GAP);
const slotY = (slot: number) => Math.floor(slot / 2) * (TILE + GAP);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The glass: 1px bigger than a logo all round. Its 1px rim sits in that
    extra pixel, so the window inside it is exactly a logo. */
const LENS = TILE + 2;
const R = LENS / 2;
/** Where the glass may go: anywhere its whole circle stays on the card. */
const BOUNDS = { left: 0, top: 0, right: STAGE.w - LENS, bottom: STAGE.h - LENS };

// At rest the glass sits off the top-right logo's outer corner — a lit
// sliver of it invites the reach
const LENS_HOME = { x: GRID_LEFT + GRID + 12 - R, y: GRID_TOP - 5 - R };

const DRIFT_MS = 9000;
/** Each logo's own float — periods and phases in ms */
const FLOAT = [7000, 8200, 9400, 10600].map((ms, i) => ({ ms, phase: i * 700 }));

// ── Motion ──────────────────────────────────────────────────────────────

const INSTANT = { duration: 0 };

const popSpring = { type: "spring", stiffness: 420, damping: 20, mass: 0.7 } as const;
