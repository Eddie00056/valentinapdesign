import type { KeyboardEvent } from "react";
import {
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

  return (
    <div className="he-root">
      <div className="he-card" data-thumb>
        <Scene driftX={driftX} driftY={driftY} reduce={reduce} />

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
              <span className="he-handle" aria-hidden="true" />
              <div className="he-glass" aria-hidden="true">
                <motion.div
                  className="he-glass-view"
                  style={{ x: innerX, y: innerY }}
                >
                  <Scene driftX={driftX} driftY={driftY} reduce={reduce} mirror />
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
  reduce,
  mirror = false,
}: {
  driftX: MotionValue<number>;
  driftY: MotionValue<number>;
  reduce: boolean;
  mirror?: boolean;
}) {
  return (
    <div className={mirror ? "he-scene he-scene--lit" : "he-scene"} inert={mirror || undefined}>
      <motion.div className="he-grid" style={{ x: driftX, y: driftY }}>
        {LOGOS.map((logo, slot) => (
          <div
            key={logo.ticker}
            className="he-tile"
            // Position with left/top: the pop inside owns the transform
            style={{ left: slotX(slot), top: slotY(slot) }}
          >
            <motion.div
              className="he-logo"
              initial={reduce ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={reduce ? INSTANT : { ...popSpring, delay: 0.15 + slot * 0.09 }}
            >
              <img src={logo.src} alt={mirror ? "" : logo.ticker} draggable={false} />
            </motion.div>
          </div>
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

// ── Motion ──────────────────────────────────────────────────────────────

const INSTANT = { duration: 0 };

const popSpring = { type: "spring", stiffness: 420, damping: 20, mass: 0.7 } as const;
