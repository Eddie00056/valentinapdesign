import { useEffect } from "react";
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

  /* ?auto: the glass wanders by itself — one slow, seamless loop that
     drifts in and out of each logo's radius (a closed Catmull-Rom spline
     through points just inside each logo, plus a soft breath sideways),
     walked at constant speed off the frame clock. No springs, no stops:
     the user asked for "moving slowly in and out of the icon radius"
     rather than snapping onto icons. The handle leans a little with the
     direction of travel. */
  const lean = useMotionValue(0);
  useEffect(() => {
    if (reduce || !new URLSearchParams(window.location.search).has("auto")) return;
    // waypoints: each logo's lens position, pulled 6px toward the grid's centre so the glass
    // skims through the logo rather than parking on it, in a figure that visits all four
    const cx = GRID_LEFT + GRID / 2 - R, cy = GRID_TOP + GRID / 2 - R;
    const pts = [0, 1, 3, 2].map((slot) => {
      const x = GRID_LEFT + slotX(slot) - 1, y = GRID_TOP + slotY(slot) - 1;
      return [x + (cx - x) * 0.18, y + (cy - y) * 0.18] as const;
    });
    const n = pts.length;
    const at = (u: number) => {
      const w = ((u % n) + n) % n;
      const i = Math.floor(w) % n;
      const s = w - Math.floor(w);
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const cr = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * s + (2 * a - 5 * b + 4 * c - d) * s * s + (-a + 3 * b - 3 * c + d) * s * s * s);
      return [cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])] as const;
    };
    const t0 = time.get();
    let lastX = lensX.get();
    const unsub = time.on("change", (now) => {
      try {
        const e = now - t0;
        const u = ((((e / WANDER_MS) % 1) + 1) % 1) * n;
        const [x, y] = at(u);
        const breath = Math.sin((e / 4300) * Math.PI * 2) * 4; // the soft in-and-out across the radius
        const nx = x + breath, ny = y + Math.cos((e / 5100) * Math.PI * 2) * 3;
        if (Number.isFinite(nx) && Number.isFinite(ny)) {
          lean.set(Math.max(-8, Math.min(8, (nx - lastX) * 40)));
          lastX = nx;
          lensX.set(nx);
          lensY.set(ny);
        }
      } catch {
        /* a bad frame must never break the loop every animation on the page shares */
      }
    });
    return unsub;
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
/** One slow lap of the glass round the four logos, in ?auto */
const WANDER_MS = 22000;
/** Each logo's own float — periods and phases in ms */
const FLOAT = [7000, 8200, 9400, 10600].map((ms, i) => ({ ms, phase: i * 700 }));

// ── Motion ──────────────────────────────────────────────────────────────

const INSTANT = { duration: 0 };

const popSpring = { type: "spring", stiffness: 420, damping: 20, mass: 0.7 } as const;
