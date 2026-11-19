import { forwardRef, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";

/**
 * The controls an order ticket is built from.
 *
 * Extracted from OptionsBuilder.tsx when the stock ticket arrived — the
 * same reason WidgetShell, TickerPill and RollingNumber were: the user
 * checks these two cards against each other a field at a time, and two
 * copies of a dropdown drift the moment one of them is touched.
 *
 * They still emit `ob-` class names, and that is deliberate: the ticket
 * design system lives in options-builder.css, on an `.ob-stage` root, and
 * every consumer wears that root so a control renders identically
 * wherever it is dropped. The prefix names the system, not the page.
 */

/* ---- crossfading label (Motion) ---- */

export function Swap({ k, children }: { k: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span
        key={k}
        initial={{ y: reduce ? 0 : "0.7em", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: reduce ? 0 : "-0.7em", opacity: 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.24, ease: [0.33, 1, 0.68, 1] }}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  );
}

/**
 * A box that springs to its content's height, clipping what has not been
 * uncovered yet.
 *
 * This is the whole add-a-leg animation. Motion's own `layout` would do
 * the same job by scaling the box and correcting its children, and that
 * is exactly what must not happen here: the type inside is 12px and any
 * scale on the way puts it through sizes it was never hinted for, which
 * reads as the text wobbling. Measuring the content and animating the
 * real `height` keeps every glyph at its natural size for the whole
 * transition; `overflow: hidden` on the outer box turns that into a
 * top-to-bottom reveal.
 *
 * It starts at `auto` so the server-rendered card is the right size
 * before any of this runs, and only ever animates between two measured
 * pixel heights after that.
 */
export function AutoHeight({
  children,
  className,
  transition,
  enabled = true,
}: {
  children: ReactNode;
  className?: string;
  transition: Transition;
  /** Off under reduced motion: the box just takes its content's size. */
  enabled?: boolean;
}) {
  const inner = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | "auto">("auto");

  useEffect(() => {
    const el = inner.current;
    if (!el || !enabled) return;
    /* A ResizeObserver, not a dependency on the rows: the height changes
       for reasons this component cannot see — a leg arriving, a label
       rewrapping, the card being resized — and all of them are the same
       event as far as the box is concerned. */
    /* A zero reading is a box that is not being rendered (a deck preloads
       the page in a hidden slide) — never a height to animate from: taking
       it collapsed the panel, which then sprang open when the slide showed
       ("the bracket and special instructions come in late"). */
    const measure = () => {
      const hh = el.offsetHeight;
      if (hh > 0) setH(hh);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [enabled]);

  return (
    <motion.div
      className={className}
      /* Never an entrance of its own — the first commit is already the
         right height, so there is nothing to animate from. */
      initial={false}
      animate={{ height: enabled ? h : "auto" }}
      transition={transition}
      style={{ overflow: "hidden" }}
    >
      {/* The measured box. It must be a plain div: anything that
          transforms it would feed its own animation back into the
          observer. */}
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}

/**
 * A block that unrolls into place and folds away — the user's card-morph
 * reference (2026-11-19). Its real HEIGHT springs from 0 to auto (and
 * back), so everything below it slides with it rather than jumping, and
 * the content is revealed top-down by the clip instead of being scaled
 * (Motion's `layout` would squish the type). In: the opacity over 0.15s.
 * Out: the same spring closing, the opacity gone in 0.14 and a 3px blur.
 *
 * `gap` is the flex gap of the column it sits in. A collapsed block would
 * still own that gap, so its top margin runs from −gap to 0 with the
 * height: at rest it is spaced like any other row, folded it takes up
 * nothing, and neither end snaps.
 */
export const MORPH: Transition = { type: "spring", stiffness: 560, damping: 27, mass: 0.5 };
/* Folding, the same spring at critical damping (2√(560 × 0.5) ≈ 33.5).
   The reference's 27 overshoots — fine opening past full height, but
   closing it carries the height below 0, which CSS refuses: the block
   froze at its last positive height (2px here) until the spring ran out,
   then snapped shut after everything else had settled. */
const MORPH_FOLD: Transition = { type: "spring", stiffness: 560, damping: 34, mass: 0.5 };

type UnrollProps = {
  children: ReactNode;
  className?: string;
  gap?: number;
  /**
   * This block is trading places with another in the same slot (Limit ↔
   * Stop: one row out, one in, the same height). Then it does not unroll
   * or fold — the two crossfade in place (the user, 2026-11-19: "I don't
   * like the animation when going from limit to stop"; filmed, the
   * incoming row unrolled above the outgoing one as that folded below it,
   * the two labels squeezed over each other). The outgoing one is lifted
   * out of the flow where it stands and fades with a slight blur; the
   * incoming one is there at full height and fades in under it. While
   * swapping, give the AnimatePresence `custom={swap}` (so the block on
   * its way OUT hears it — its own props are from the render before) and
   * `mode="popLayout"` (which does the lifting, before the frame paints).
   */
  swap?: boolean;
};

export const Unroll = forwardRef<HTMLDivElement, UnrollProps>(function Unroll({
  children,
  className,
  gap = 0,
  swap = false,
}: UnrollProps, ref) {
  const reduce = useReducedMotion();
  const own = useRef<HTMLDivElement | null>(null);
  const top = useRef(0);
  useLayoutEffect(() => {
    if (own.current) top.current = own.current.offsetTop;
  });
  const setRef = (el: HTMLDivElement | null) => {
    own.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };
  if (reduce) return <div ref={setRef} className={className}>{children}</div>;
  return (
    <motion.div
      ref={setRef}
      className={className}
      custom={swap}
      variants={{
        /* a swap mounts the incoming block at 0 too — set before the first
           paint — so for the frame before anything animates it takes no
           room while the outgoing one still stands; on the next frame it
           snaps to full height as the outgoing one lifts out (below), in
           the same frame. Never both in the flow: no jump. */
        enter: () => ({ height: 0, opacity: 0, marginTop: -gap }),
        /* the SAME spring opening as folding (the user, 2026-11-19: "the
           animation should be the same when going from market to limit to
           stop to stop limit… and for adding or removing a bracket").
           Recorded, opening on the reference's 27 (ζ≈0.8) and folding on
           34 (critical) did not match: a row folding while another opened
           (Stop ↔ Limit) summed two different springs, so the card swelled
           3.7px past its size and came back; Market → Stop reversed three
           times; adding overshot where removing did not. One critically
           damped spring both ways — same stiffness and mass, no overshoot —
           gives every change one curve. */
        rest: (sw: boolean) => ({
          height: "auto",
          opacity: 1,
          marginTop: 0,
          transition: sw
            ? { height: { duration: 0 }, marginTop: { duration: 0 }, opacity: { duration: 0.16, ease: "easeOut" } }
            : { height: MORPH_FOLD, marginTop: MORPH_FOLD, opacity: { duration: 0.15, ease: "easeOut" } },
        }),
        leave: (sw: boolean) =>
          sw
            ? {
                /* lifted out where it stands (its last offsetTop in the
                   rows' column), in the same frame the incoming block
                   takes the room; invisible while it finishes leaving and
                   never in the way of a click */
                position: "absolute",
                top: top.current,
                left: 0,
                right: 0,
                pointerEvents: "none",
                opacity: 0,
                filter: "blur(3px)",
                transition: { opacity: { duration: 0.12, ease: "easeIn" }, filter: { duration: 0.12 } },
              }
            : {
                height: 0,
                opacity: 0,
                marginTop: -gap,
                filter: "blur(3px)",
                transition: {
                  height: MORPH_FOLD,
                  marginTop: MORPH_FOLD,
                  opacity: { duration: 0.14, ease: "easeOut" },
                  filter: { duration: 0.12 },
                },
              },
      }}
      initial="enter"
      animate="rest"
      exit="leave"
      style={{ overflow: "hidden" }}
    >
      {children}
    </motion.div>
  );
});

/* Solid triangle, up or down — the stepper's affordance in the reference
   asset. Measured off it: 22 x 11 at a 4x export is 5.5 x 2.75, so the
   shape is 2:1 and drawn on an 8 x 4 grid at 6 x 3. Filled, not stroked —
   the export shows a solid wedge, not a chevron. */
export function Caret({ dir }: { dir: "up" | "down" }) {
  return (
    <svg width="6" height="3" viewBox="0 0 8 4" aria-hidden="true">
      <path d={dir === "up" ? "M4 0 8 4H0z" : "M4 4 0 0h8z"} fill="currentColor" />
    </svg>
  );
}

/**
 * A figure whose changed characters roll — the user's stepper reference
 * (2026-11-19). Only characters that differ move: the new one enters from
 * below when the value went up (from above when it went down), the old
 * one leaves the other way, each on a stiff spring (600 / 35 / 0.4) with
 * a 0.12s fade and a 2px blur that clears in 0.15s.
 *
 * Each character keeps its NATURAL width — an invisible copy of itself
 * sizes its slot — so at rest this sets exactly like plain text. (The old
 * `Rolling` odometer centred every digit in a fixed 0.58em cell, which
 * moved the figure off the field's text line and was removed for it.)
 *
 * It rolls only when `arm` was set just before the change (a caret press).
 * Anything else — a typed value, a limit following the quote — swaps
 * without motion, so the ticket does not animate on every tick.
 */
export function RollText({
  text,
  arm,
}: {
  text: string;
  arm: { current: boolean };
}) {
  const reduce = useReducedMotion();
  const prev = useRef(text);
  const dir = useRef(0);
  if (prev.current !== text) {
    const a = parseFloat(prev.current.replace(/[^\d.-]/g, ""));
    const b = parseFloat(text.replace(/[^\d.-]/g, ""));
    dir.current = arm.current && !reduce && Number.isFinite(a) && Number.isFinite(b) ? (b >= a ? 1 : -1) : 0;
    prev.current = text;
  }
  useEffect(() => {
    arm.current = false;
  });
  const d = dir.current;
  return (
    <span className="ob-roll" aria-hidden="true">
      {text.split("").map((ch, i) => (
        <span key={i} className="ob-roll-slot">
          <span className="ob-roll-ghost">{ch}</span>
          {/* `custom` carries THIS change's direction to the character
              leaving, whose own props are from the render before the
              press — without it the old digit left with no direction
              and simply vanished */}
          <AnimatePresence initial={false} mode="popLayout" custom={d}>
            <motion.span
              key={`${i}-${ch}`}
              className="ob-roll-ch"
              custom={d}
              variants={ROLL_V}
              initial="enter"
              animate="rest"
              exit="leave"
              transition={ROLL}
            >
              {ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

const ROLL_V = {
  enter: (d: number) => (d ? { y: `${d * 100}%`, opacity: 0, filter: "blur(2px)" } : {}),
  rest: { y: "0%", opacity: 1, filter: "blur(0px)" },
  leave: (d: number) =>
    d
      ? { y: `${-d * 100}%`, opacity: 0, filter: "blur(2px)" }
      : { opacity: 0, transition: { duration: 0 } },
};

const ROLL = {
  y: { type: "spring" as const, stiffness: 600, damping: 35, mass: 0.4 },
  opacity: { duration: 0.12 },
  filter: { duration: 0.15 },
};

/* The prefix's motion (StepperField) — the user's affix reference. */
const AFFIX_SLIDE: Transition = { type: "spring", duration: 0.32, bounce: 0 };
const AFFIX_FADE: Transition = { duration: 0.1, ease: [0.4, 0, 1, 1] };
const AFFIX_OUT = { opacity: 0, x: -8, filter: "blur(4px)" };
const AFFIX_IN = { opacity: 1, x: 0, filter: "blur(0px)" };
const AFFIX_T = { opacity: AFFIX_FADE, filter: AFFIX_FADE, x: AFFIX_SLIDE };

/** A unit change for the figure beside a cycling prefix: which unit it now
    reads in, and the side that unit "lives" on ($ left, % right). */
export type UnitMorph = { key: string; side: "prefix" | "suffix" };

/* The figure's crossover, quicker than the affix motion it came from (the
   user, 2026-11-19: "make it faster a bit"): the slide on a 0.22s spring
   (0.32), the fade and blur in 0.08s (0.1). Same shape, same distances. */
const MORPH_T = {
  x: { type: "spring" as const, duration: 0.22, bounce: 0 },
  opacity: { duration: 0.08, ease: [0.4, 0, 1, 1] as [number, number, number, number] },
  filter: { duration: 0.08, ease: [0.4, 0, 1, 1] as [number, number, number, number] },
};
/* …and the incoming figure on an EASE-OUT (the user, 2026-11-19: "a small
   flicker"). Measured frame by frame, with both numbers on the ease-in the
   field's ink fell to ~40% mid-switch — the old number gone fast, the new
   one barely started — then the new one jumped to full in a single frame.
   Coming in fast and settling soft, the two overlap instead of leaving a
   gap: the outgoing keeps its quick ease-in, the incoming takes the out. */
const MORPH_IN_T = {
  x: { type: "spring" as const, duration: 0.22, bounce: 0 },
  opacity: { duration: 0.12, ease: [0, 0, 0.2, 1] as [number, number, number, number] },
  filter: { duration: 0.12, ease: [0, 0, 0.2, 1] as [number, number, number, number] },
};

/**
 * The figure crossing over when its unit changes (the user, 2026-11-19:
 * "I want this transition for the value", their inset-switch reference's
 * affix motion, put on the number). The outgoing number leaves toward its
 * old unit's side — 8px left for $, 10 right for % — fading in 0.1s on an
 * ease-in with a 4px blur riding the fade; the incoming one arrives from its
 * own unit's side on the 0.32s no-bounce spring. Keyed on the unit, so a
 * price ticking or a caret press does not trigger it.
 */
function MorphFigure({
  morph,
  enter,
  from,
  children,
}: {
  morph?: UnitMorph;
  enter?: boolean;
  /** With `enter`: the figure this field REPLACED (Quantity's shares field
      and dollars field are different fields), played out as the exit the
      old field never got to — so the swap is the same two-way crossover. */
  from?: { text: string; side: "prefix" | "suffix" };
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  /* captured once, at mount: the live price re-renders the ticket on every
     tick, and the flag that hands this over is cleared on the next render —
     so it is held here until its exit has played, then dropped */
  const [ghost, setGhost] = useState(() => (enter ? from : undefined));
  if (!morph || reduce) return <>{children}</>;
  const off = (side: "prefix" | "suffix") => (side === "prefix" ? -8 : 10);
  return (
    <span className="ob-morph">
      {ghost && (
        <motion.span
          className="ob-morph-ghost"
          aria-hidden="true"
          initial={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          animate={{ opacity: 0, x: off(ghost.side), filter: "blur(4px)" }}
          transition={MORPH_T}
          onAnimationComplete={() => setGhost(undefined)}
        >
          {ghost.text}
        </motion.span>
      )}
      <AnimatePresence initial={!!enter} mode="popLayout" custom={morph.side}>
        <motion.span
          key={morph.key}
          className="ob-morph-in"
          custom={morph.side}
          variants={{
            /* the incoming figure arrives SHARP — no blur. Filmed, 12px
               type coming out of a blur held soft for a few frames and then
               snapped crisp in one (the browser dropping the filter's layer
               and re-rasterising), which is the flicker. The outgoing one
               keeps its blur: it is on its way to nothing. */
            in: (side: "prefix" | "suffix") => ({ opacity: 0, x: off(side) }),
            rest: { opacity: 1, x: 0, transition: MORPH_IN_T },
            /* leaving toward ITS side: the outgoing unit is the other one */
            out: (side: "prefix" | "suffix") => ({
              opacity: 0,
              x: off(side === "prefix" ? "suffix" : "prefix"),
              filter: "blur(4px)",
              transition: MORPH_T,
            }),
          }}
          initial="in"
          animate="rest"
          exit="out"
          transition={MORPH_T}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * A value and a caret stepper — the field shape the limit price takes,
 * with its label lifted out onto the row beside it.
 */
export function StepperField({
  value,
  onChange,
  onStep,
  ariaLabel,
  reduce,
  spring,
  prefix,
  prefixOptions,
  onPrefixSelect,
  prefixLabel,
  prefixIcon,
  prefixHint,
  prefixAria,
  prefixRollIn,
  morphFrom,
  unitMorph,
  prefixCycle,
  steppable = true,
  unitSwitch,
}: {
  value: string;
  onChange: (raw: string) => void;
  onStep: (delta: number) => void;
  ariaLabel: string;
  reduce: boolean | null;
  spring: Transition;
  /** See PriceField — the same cell, on a field that holds a count. */
  prefix?: string;
  prefixOptions?: readonly string[];
  onPrefixSelect?: (v: string) => void;
  prefixLabel?: ReactNode;
  prefixIcon?: (v: string) => ReactNode;
  prefixHint?: string;
  prefixAria?: string;
  /** See PriceField. */
  /** See Prefix `cycle`: a click picks the next unit, no menu. */
  /** With `prefixCycle`: roll the mark in on mount. */
  prefixRollIn?: boolean;
  /** See PriceField. */
  /** See MorphFigure `from`. */
  morphFrom?: { text: string; side: "prefix" | "suffix" };
  unitMorph?: UnitMorph;
  prefixCycle?: boolean;
  steppable?: boolean;
  /** See PriceField — the unit as a switch docked on the right, its mark
      set before the figure. */
  unitSwitch?: UnitSwitchSpec;
}) {
  /* A <label> when the field is only an input: clicking anywhere in it
     then puts the caret in the number, which is the right affordance for
     a box that holds one value. A <div> once there is a prefix, because a
     button inside a label activates the label too — every click on the
     picker would also focus the input behind the menu. */
  /* Always a <div> now. It was a <label> without a prefix and a <div>
     with one — and a field whose prefix comes and goes (Quantity's unit
     exists only on a market order) changed element type, so React threw
     the whole field away and the prefix could only snap. The label's one
     job — a press anywhere in the box puts the caret in the number — is
     done by hand instead, leaving the prefix, the input and the arrows to
     handle their own presses. */
  const arm = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();
  const unit = unitSwitch?.options.find((o) => o.id === unitSwitch.value);

  return (
    <div
      className={`ob-field ob-stepper${unitSwitch ? " ob-field--switch-unit" : ""}`}
      onMouseDown={(e) => {
        const t = e.target as HTMLElement;
        if (t.closest("button, input")) return;
        e.preventDefault();
        inputRef.current?.focus();
      }}
    >
      {/* The prefix arriving and leaving — the user's affix reference
          (2026-11-19). It drops out of the flow at once (popLayout) and
          slides 8px toward its edge as it fades in 0.1s on an ease-in, a
          4px blur riding the fade; the value beside it slides into the
          freed room on one 0.32s spring (layout="position" below), the
          same spring as the prefix's slide, so the two read as one move. */}
      {/* With a unit switch the unit is a mark set before the figure —
          the same affix motion as the prefix cell's, on the mark. */}
      <AnimatePresence initial={false} mode="popLayout">
        {unit && unitSwitch?.showMark && (
          <motion.span
            key={`m-${unit.markKey ?? unit.id}`}
            className="ob-unit ob-unit--lead"
            initial={reduceMotion ? false : AFFIX_OUT}
            animate={AFFIX_IN}
            exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : AFFIX_OUT}
            transition={AFFIX_T}
          >
            {unit.mark ?? unit.glyph}
          </motion.span>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false} mode="popLayout">
        {prefix && !unitSwitch && (
          <motion.span
            key="prefix"
            className="ob-field-k-slot"
            /* a cycling plate sits at the field's RIGHT end, so it slides
               toward that edge, not the left */
            initial={reduceMotion ? false : prefixCycle ? { ...AFFIX_OUT, x: 8 } : AFFIX_OUT}
            animate={AFFIX_IN}
            exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : prefixCycle ? { ...AFFIX_OUT, x: 8 } : AFFIX_OUT}
            transition={AFFIX_T}
          >
            <Prefix
              value={prefix}
              label={prefixLabel}
              options={prefixOptions}
              onSelect={onPrefixSelect}
              icon={prefixIcon}
              hint={prefixHint}
              ariaLabel={prefixAria ?? `${ariaLabel} unit`}
              cycle={prefixCycle}
              rollIn={prefixRollIn}
            />
          </motion.span>
        )}
      </AnimatePresence>
      {/* The input keeps the value; while it is not being typed in, its
          own text is hidden under the same figure drawn as RollText, so a
          caret press can roll it (an input's text cannot animate). Focused,
          the overlay goes and the input is itself again. */}
      <motion.span
        className="ob-roll-wrap"
        layout={reduceMotion ? false : "position"}
        transition={{ layout: AFFIX_SLIDE }}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          aria-label={ariaLabel}
          size={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="ob-roll-over">
          <MorphFigure morph={unitMorph} enter={prefixRollIn} from={morphFrom}>
            <RollText text={value} arm={arm} />
          </MorphFigure>
        </span>
      </motion.span>
      {steppable && (
      <div className="ob-stepper-hit" onClick={(e) => e.stopPropagation()}>
        <div className="ob-stepper-btns">
          {([1, -1] as const).map((d) => (
            <motion.button
              key={d}
              type="button"
              aria-label={`${d > 0 ? "Increase" : "Decrease"} ${ariaLabel}`}
              onClick={() => {
                arm.current = true;
                onStep(d);
              }}
              whileTap={reduce ? undefined : { scale: 0.82 }}
              transition={spring}
            >
              <Caret dir={d > 0 ? "up" : "down"} />
            </motion.button>
          ))}
        </div>
      </div>
      )}
      {/* The switch leaves and arrives with its unit (Quantity's exists
          only on a market order): toward the field's right edge, the
          affix motion; the figure takes the room on its own spring. */}
      <AnimatePresence initial={false} mode="popLayout">
        {unitSwitch && (
          <motion.div
            key="uswitch"
            className="ob-uswitch-slot"
            initial={reduceMotion ? false : { ...AFFIX_OUT, x: 10 }}
            animate={AFFIX_IN}
            exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { ...AFFIX_OUT, x: 10 }}
            transition={AFFIX_T}
          >
            <UnitSwitch {...unitSwitch} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * The same field holding a PRICE: a currency mark set against the figure,
 * a stepper beside it, and the figure itself editable in place.
 *
 * The editing state is the field's own — nothing outside it needs to know
 * whether the caret is in the box. What the owner supplies is the value,
 * what a caret press is worth (`onStep` reports ±1, so the call site
 * decides whether that is a cent or a dollar), and where a typed number
 * lands, which is also where the owner clamps it.
 */
export function PriceField({
  value,
  onCommit,
  onStep,
  ariaLabel,
  reduce,
  spring,
  prefix,
  prefixOptions,
  onPrefixSelect,
  prefixLabel,
  prefixIcon,
  prefixHint,
  prefixAria,
  prefixRollIn,
  morphFrom,
  decimals = 2,
  unitMorph,
  prefixCycle,
  steppable = true,
  unitSwitch,
}: {
  value: number;
  /** A typed number, committed on Enter or blur. Clamp it here. */
  onCommit: (v: number) => void;
  /** ±1 per caret press. */
  onStep: (delta: number) => void;
  ariaLabel: string;
  reduce: boolean | null;
  spring: Transition;
  /**
   * Given, the field opens with a prefix box — the Atlas input field's
   * "Label as Prefix": its own cell at the head of the field, divided
   * from the value by a hairline. It takes over saying what the number
   * is, so the inline currency mark is dropped: a field cannot state its
   * unit twice.
   */
  prefix?: string;
  /** Given with `onPrefixSelect`, the prefix becomes a picker. */
  prefixOptions?: readonly string[];
  onPrefixSelect?: (v: string) => void;
  /** What the cell shows, when that is not the chosen option itself. */
  prefixLabel?: ReactNode;
  /** A leading glyph per menu row. */
  prefixIcon?: (v: string) => ReactNode;
  /** The popover shown after a moment's hover. */
  prefixHint?: string;
  prefixAria?: string;
  /**
   * False drops the caret pair — the spec's "suffix". A field without one
   * is typed into rather than nudged, and the ticket uses that to keep a
   * single stepper on screen at a time.
   */
  /** See Prefix `cycle`: a click picks the next unit, no menu. */
  /** With `prefixCycle`: roll the mark in on mount. */
  prefixRollIn?: boolean;
  /** The figure crosses over when this unit changes (MorphFigure). */
  /** See MorphFigure `from`. */
  morphFrom?: { text: string; side: "prefix" | "suffix" };
  /** Places shown and kept — 0 for a whole-number percentage. */
  decimals?: number;
  unitMorph?: UnitMorph;
  prefixCycle?: boolean;
  steppable?: boolean;
  /**
   * A variation on the prefix picker, for a field whose unit is one of two
   * (the user's inset-switch reference, 2026-11-19): no prefix cell — the
   * unit is set with the number, a "$" before it or a "%" after it — and a
   * small segmented switch docked on the field's right edge picks it.
   * Given, `prefix` and its picker are not used.
   */
  unitSwitch?: UnitSwitchSpec;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const noun = ariaLabel.toLowerCase();
  const arm = useRef(false);
  const reduceMotion = useReducedMotion();
  const unit = unitSwitch?.options.find((o) => o.id === unitSwitch.value);
  /* The figure with its unit set beside it. With a unit switch the mark
     slides in and out as the unit changes (the reference's affix motion:
     8px toward the field's edge for a prefix, 10 for a suffix, a 0.1s
     ease-in fade with a 4px blur riding it) and the figure slides into
     the room it leaves on the 0.32s spring. Without one, the plain "$". */
  const withUnit = (figure: ReactNode) =>
    unitSwitch ? (
      <>
        <AnimatePresence initial={false} mode="popLayout">
          {unitSwitch.showMark && unit?.place === "prefix" && (
            <motion.span
              key={`p-${unit.markKey ?? unit.id}`}
              className="ob-unit"
              initial={reduceMotion ? false : { ...AFFIX_OUT, x: -8 }}
              animate={AFFIX_IN}
              exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { ...AFFIX_OUT, x: -8 }}
              transition={AFFIX_T}
            >
              {unit.mark ?? unit.glyph}
            </motion.span>
          )}
        </AnimatePresence>
        <motion.span
          className="ob-unit-figure"
          layout={reduceMotion ? false : "position"}
          transition={{ layout: AFFIX_SLIDE }}
        >
          {figure}
        </motion.span>
        <AnimatePresence initial={false} mode="popLayout">
          {unitSwitch.showMark && unit?.place === "suffix" && (
            <motion.span
              key={`s-${unit.markKey ?? unit.id}`}
              className="ob-unit ob-unit--suffix"
              initial={reduceMotion ? false : { ...AFFIX_OUT, x: 10 }}
              animate={AFFIX_IN}
              exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { ...AFFIX_OUT, x: 10 }}
              transition={AFFIX_T}
            >
              {unit.mark ?? unit.glyph}
            </motion.span>
          )}
        </AnimatePresence>
      </>
    ) : (
      <>
        {!prefix && <span className="ob-unit">$</span>}
        {figure}
      </>
    );


  function commit(text: string) {
    setEditing(false);
    const parsed = parseFloat(text);
    if (Number.isFinite(parsed)) onCommit(+parsed.toFixed(decimals));
  }

  return (
    <div className={`ob-field ob-stepper${unitSwitch ? " ob-field--switch-unit" : ""}`}>
      {prefix && !unitSwitch && (
        <Prefix
          value={prefix}
          label={prefixLabel}
          options={prefixOptions}
          onSelect={onPrefixSelect}
          icon={prefixIcon}
          hint={prefixHint}
          ariaLabel={prefixAria ?? `${ariaLabel} unit`}
          cycle={prefixCycle}
          rollIn={prefixRollIn}
        />
      )}
      {editing ? (
        <span className="ob-stepper-num ob-stepper-num--editing">
          {/* The unit, outside the editable text. It is not something you
              type or delete — the field holds a price, and it says so
              whether or not there is a number in it yet. Unless a prefix
              box is already saying it. */}
          {withUnit(
            <input
              type="text"
              inputMode="decimal"
              aria-label={ariaLabel}
              /* An <input> with no `size` carries a default intrinsic width
                 of ~20 characters, which fed straight into the card's
                 max-content pass and jumped the widget wider the moment
                 this field was clicked into. */
              size={1}
              /* hugging its text with a unit switch, so a "%" sits right
                 after the figure rather than at the far end of the field */
              style={unitSwitch ? { width: `${Math.max(draft.length, 1) * 0.62 + 0.2}em`, flex: "none" } : undefined}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, "").slice(0, 9))}
              onBlur={(e) => commit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
                if (e.key === "Escape") setEditing(false);
              }}
            />
          )}
        </span>
      ) : (
        <button
          type="button"
          className="ob-stepper-num"
          onClick={() => {
            setDraft(value.toFixed(decimals));
            setEditing(true);
          }}
          aria-label={`Edit ${noun}`}
        >
          {withUnit(
            <MorphFigure morph={unitMorph} enter={prefixRollIn} from={morphFrom}>
              <RollText text={value.toFixed(decimals)} arm={arm} />
            </MorphFigure>,
          )}
        </button>
      )}
      {/* Invisible padding + matching negative margin — a bigger hit
          target than the visible square without growing the field's own
          layout. */}
      {steppable && (
      <div className="ob-stepper-hit" onClick={(e) => e.stopPropagation()}>
        <div className="ob-stepper-btns">
          {([1, -1] as const).map((d) => (
            <motion.button
              key={d}
              type="button"
              aria-label={`${d > 0 ? "Increase" : "Decrease"} ${noun}`}
              onClick={() => {
                arm.current = true;
                onStep(d);
              }}
              whileTap={reduce ? undefined : { scale: 0.82 }}
              transition={spring}
            >
              <Caret dir={d > 0 ? "up" : "down"} />
            </motion.button>
          ))}
        </div>
      </div>
      )}
      {unitSwitch && <UnitSwitch {...unitSwitch} />}
    </div>
  );
}

export type UnitSwitchSpec = {
  options: readonly {
    id: string;
    /** What the segment shows. */
    glyph: ReactNode;
    label: string;
    /** Where the unit sits beside the figure. */
    place: "prefix" | "suffix";
    /** The unit beside the figure, when it is not the segment's glyph
        (Follow bid / ask: segments "Bid" / "Ask", the figure an offset "%"). */
    mark?: ReactNode;
    /** Options sharing a key share the mark — switching between them
        leaves it in place rather than swapping it out and back in. */
    markKey?: string;
  }[];
  value: string;
  onSelect: (id: string) => void;
  ariaLabel: string;
  /** Set the unit's mark beside the figure ("$204.00", "1.00%"). Off by
      default — the switch says the unit (the user, 2026-11-19: "remove
      the dollar and % in front and behind the value"). */
  showMark?: boolean;
  /** A stable name for the switch's plate, when the field holding it is
      swapped for another as the unit changes (Quantity: a count field for
      shares, a price field for dollars) — the plate slides across the
      swap instead of being drawn fresh in its new place. */
  id?: string;
};

/**
 * The unit switch docked on a field's right edge (the user's inset-switch
 * reference, 2026-11-19), in the ticket's own parts: two segments the
 * field's height less its inset, the active one on a raised plate — the
 * field's hover step, a lit top edge, a short drop — that slides between
 * them (a shared layoutId, 0.4s spring) and leans 5% toward a segment
 * under the pointer (0.6s), the glyph pressing in to 85% on pointer-down.
 * The keyboard moves along the pair with the arrows, Home and End.
 */
function UnitSwitch({ options, value, onSelect, ariaLabel, id: stable }: UnitSwitchSpec) {
  const autoId = useId();
  const id = stable ?? autoId;
  const reduce = useReducedMotion();
  const [peek, setPeek] = useState(false);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const idx = options.findIndex((o) => o.id === value);
  const pick = (to: string) => {
    setPeek(false);
    if (to !== value) onSelect(to);
  };
  return (
    <LayoutGroup id={id}>
      <div
        className="ob-uswitch"
        role="radiogroup"
        aria-label={ariaLabel}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {options.map((o, i) => {
          const on = o.id === value;
          return (
            <button
              key={o.id}
              ref={(el) => {
                refs.current[o.id] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={o.label}
              tabIndex={on ? 0 : -1}
              className="ob-uswitch-seg"
              onClick={() => pick(o.id)}
              onMouseEnter={() => setPeek(!on)}
              onMouseLeave={() => setPeek(false)}
              onKeyDown={(e) => {
                let n = -1;
                if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % options.length;
                else if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (i - 1 + options.length) % options.length;
                else if (e.key === "Home") n = 0;
                else if (e.key === "End") n = options.length - 1;
                if (n < 0) return;
                e.preventDefault();
                pick(options[n].id);
                refs.current[options[n].id]?.focus();
              }}
            >
              {on && (
                <motion.span
                  layoutId="ob-uswitch-pill"
                  className="ob-uswitch-pill"
                  style={{ originX: idx === 0 ? 0 : 1 }}
                  animate={{ scaleX: peek && !reduce ? 1.05 : 1 }}
                  transition={
                    reduce
                      ? { duration: 0 }
                      : {
                          layout: { type: "spring", duration: 0.4, bounce: 0 },
                          scaleX: { type: "spring", duration: 0.6, bounce: 0 },
                        }
                  }
                />
              )}
              <span className="ob-uswitch-label">{o.glyph}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

/**
 * The add-a-row glyph, on the house 16px grid at a 1.6 round-capped
 * stroke. Drawn 4→12, so its INK starts 0.8 units outside that — which
 * is what `.ob-add button svg`'s −2.8px pull cancels, and why the gap to
 * its label is 1.2 and not 4. See the bearing rule.
 */
export function Plus({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      aria-hidden
      focusable={false}
    >
      <path d="M8 4v8M4 8h8" />
    </svg>
  );
}

/** Locked to a quote — the spec's icon on the two "Follow" rows. On the
    same 16px grid and 1.6 stroke as the rest of the set. */
export function Lock({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
    >
      <rect x="3.4" y="7" width="9.2" height="6.4" rx="1.6" />
      <path d="M5.8 7V5.2a2.2 2.2 0 0 1 4.4 0V7" />
    </svg>
  );
}

/** Marks the chosen row in an open menu. */
export function Check() {
  return (
    <svg width="10" height="8" viewBox="0 0 12 10" fill="none" aria-hidden="true">
      <path
        d="M1 5.2 4.4 8.6 11 1.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Where a menu opens, measured off its own trigger.
 *
 * The menu is `position: fixed` and placed from the trigger's viewport
 * rect, rather than absolutely inside it. Both containers on these
 * tickets clip their contents to a 6px radius and the card clips to 12 —
 * an absolutely positioned menu would be cut off by whichever it opened
 * inside. Fixed escapes all three.
 */
function useMenuAnchor<T extends HTMLElement>(
  /* Anchor to the whole field the trigger sits in, not the trigger. A
     prefix picker is a cell of its field, and its list belongs to the
     field: the same left edge and the same width as every other dropdown
     on the card (the user, 2026-11-19: "the prefix dropdowns should be
     the same width as the input fields"). */
  opts: { field?: boolean } = {},
) {
  const ref = useRef<T | null>(null);
  const [at, setAt] = useState<{ top: number; left: number; minWidth: number }>({
    top: 0,
    left: 0,
    minWidth: 0,
  });

  function place() {
    const el = opts.field ? (ref.current?.closest(".ob-field") ?? ref.current) : ref.current;
    const r = el?.getBoundingClientRect();
    if (!r) return;
    /* 4 below the trigger, per the Atlas doc's own gap. */
    setAt({ top: r.bottom + 4, left: r.left, minWidth: r.width });
  }

  return { ref, at, place };
}

/**
 * The list itself.
 *
 * Portalled to <body>, not left in place. It is `position: fixed` at
 * coordinates read off the trigger's viewport rect, and that only holds
 * while no ancestor is transformed — these tickets can be dragged, which
 * puts a transform on a wrapper above them and turns `fixed` into
 * `absolute` against that wrapper. The menu would then be offset by
 * exactly however far the card had been moved. Out at the body there is
 * no such ancestor and the viewport coordinates mean what they say.
 */
/**
 * The list's entrance and exit, from the user's dropdown reference
 * (2026-11-19). In: the opacity over 0.1s, and the panel out of a slight
 * fold — 96% scale, 4px high, tipped back 4° on an 800px perspective —
 * settling on an overshooting spring curve over 0.2s, hinged at its top
 * left like a sheet dropped from the field. Out: quicker and plain, 0.08s
 * opacity and 0.1s back into the fold, easing in — a list you have
 * finished with should get out of the way, not perform.
 */
const MENU_FOLD = { opacity: 0, scale: 0.96, y: -4, rotateX: -4 };
export const MENU_MOTION = {
  initial: MENU_FOLD,
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    rotateX: 0,
    transition: {
      default: { duration: 0.2, ease: [0.22, 1.6, 0.36, 1] as const },
      opacity: { duration: 0.1, ease: "easeOut" as const },
    },
  },
  exit: {
    ...MENU_FOLD,
    transition: {
      default: { duration: 0.1, ease: "easeIn" as const },
      opacity: { duration: 0.08, ease: "easeIn" as const },
    },
  },
};
/** Reduced motion: the list still appears and goes, but only fades. */
export const MENU_MOTION_REDUCED = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.1 } },
  exit: { opacity: 0, transition: { duration: 0.08 } },
};

function Menu<T extends string | number>({
  open,
  at,
  value,
  options,
  format,
  icon,
  onSelect,
  onClose,
  anchor,
}: {
  open: boolean;
  at: { top: number; left: number; minWidth: number };
  value: T;
  options: readonly T[];
  format: (v: T) => string;
  /** Given, each row opens with this — the spec's "$" and padlocks. */
  icon?: (v: T) => ReactNode;
  onSelect: (v: T) => void;
  onClose: () => void;
  /** The trigger. A press on it is left to its own onClick (which
      toggles), so it is not an "outside" press. */
  anchor: { current: HTMLElement | null };
}) {
  const reduce = useReducedMotion();
  const listRef = useRef<HTMLDivElement | null>(null);

  /* Closing from outside, without covering the page.

     This was a transparent scrim over the whole viewport, which caught the
     closing click — and every hover with it: with a prefix's list open,
     the value half of the same field could not light under the pointer
     (the user, 2026-11-19). Document listeners leave the page live: a
     press anywhere but the list or its trigger closes it, as does a
     scroll (the list is placed once and must not outlive one) or Escape.
     Capture phase, so it runs before the pressed control's own handlers. */
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      const t = e.target as Node;
      if (listRef.current?.contains(t) || anchor.current?.contains(t)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("wheel", away, { capture: true, passive: true });
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("wheel", away, true);
      document.removeEventListener("keydown", key);
    };
  }, [open, onClose, anchor]);

  return portal(
    <AnimatePresence>
      {open && (
          <motion.div
            ref={listRef}
            className="ob-dd-menu"
            role="listbox"
            style={{
              top: at.top,
              left: at.left,
              minWidth: at.minWidth,
              transformOrigin: "top left",
              transformPerspective: 800,
            }}
            {...(reduce ? MENU_MOTION_REDUCED : MENU_MOTION)}
          >
            {options.map((o) => (
              <button
                key={String(o)}
                type="button"
                role="option"
                aria-selected={o === value}
                className="ob-dd-item"
                onClick={() => {
                  onSelect(o);
                  onClose();
                }}
              >
                <span className="ob-dd-label">
                  {icon && <span className="ob-dd-lead">{icon(o)}</span>}
                  {format(o)}
                </span>
                {o === value && <Check />}
              </button>
            ))}
          </motion.div>
      )}
    </AnimatePresence>,
  );
}

/**
 * A field that opens a list.
 */
export function Dropdown<T extends string | number>({
  value,
  options,
  onSelect,
  format = (v) => String(v),
  className,
  ariaLabel,
  disabled,
}: {
  value: T;
  options: readonly T[];
  onSelect: (v: T) => void;
  format?: (v: T) => string;
  className: string;
  ariaLabel: string;
  /**
   * Shown, dimmed, and inert. A control the order has decided for you
   * still occupies its line, so the ticket's shape does not change with
   * its own answers.
   */
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [kick, setKick] = useState(0);
  const close = useCallback(() => setOpen(false), []);
  const { ref, at, place } = useMenuAnchor<HTMLButtonElement>();

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={className}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        data-open={(open && !disabled) || undefined}
        onClick={() => {
          place();
          setKick((k) => k + 1);
          setOpen((o) => !o);
        }}
      >
        {format(value)}
        <Chevron kick={kick} />
      </button>

      <Menu
        open={open && !disabled}
        at={at}
        value={value}
        options={options}
        format={format}
        onSelect={onSelect}
        onClose={close}
        anchor={ref}
      />
    </>
  );
}

/**
 * The head of a field: what the number in it is, and — where there is
 * something to choose — the control that changes it.
 *
 * Atlas draws these as two states of one part: "Label as Prefix", which
 * is a cell and nothing more, and "Clickable Prefix", which lights under
 * the pointer and opens a list. Given `options` this renders the second:
 * a button wearing the same cell, with a chevron that appears on hover
 * the way every other trigger on these cards reveals its own.
 */
function Prefix({
  value,
  label,
  options,
  onSelect,
  icon,
  hint,
  ariaLabel,
  cycle,
  rollIn,
}: {
  /** What the cell says, and what the menu marks as chosen. */
  value: string;
  /** What the cell shows, if that is not the value itself — a mark or a
      glyph as readily as a word. */
  label?: ReactNode;
  options?: readonly string[];
  onSelect?: (v: string) => void;
  icon?: (v: string) => ReactNode;
  /** The spec's "Hover with popover": what this control is for. */
  hint?: string;
  ariaLabel: string;
  /**
   * A click picks the NEXT option outright — no menu (the user's third
   * variation, 2026-11-19). The mark rolls to the new unit and the
   * dropdown chevron becomes an up/down pair, the "cycles" affordance.
   */
  cycle?: boolean;
  /** With `cycle`: roll the mark in on mount (see CycleMark). */
  rollIn?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [kick, setKick] = useState(0);
  const close = useCallback(() => setOpen(false), []);
  const [tip, setTip] = useState(false);
  const tipT = useRef<number | undefined>(undefined);
  const { ref, at, place } = useMenuAnchor<HTMLButtonElement>({ field: true });
  const [tipAt, setTipAt] = useState({ left: 0, bottom: 0 });

  if (!options || !onSelect) {
    return <span className="ob-field-k">{label ?? value}</span>;
  }

  /* The popover waits. It explains a control that is also perfectly
     usable without reading it, so it must not fire on a pointer merely
     crossing the field on its way somewhere else. */
  function armTip() {
    const r = ref.current?.getBoundingClientRect();
    if (r) setTipAt({ left: r.left, bottom: window.innerHeight - r.top + 6 });
    window.clearTimeout(tipT.current);
    tipT.current = window.setTimeout(() => setTip(true), 420);
  }

  function dropTip() {
    window.clearTimeout(tipT.current);
    setTip(false);
  }

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={cycle ? "ob-field-k ob-cycle-chip" : "ob-field-k"}
        aria-haspopup={cycle ? undefined : "listbox"}
        aria-expanded={cycle ? undefined : open}
        aria-label={cycle ? `${ariaLabel}: ${value}. Click to switch` : ariaLabel}
        title={undefined}
        data-open={open || undefined}
        onPointerEnter={armTip}
        onPointerLeave={dropTip}
        onClick={() => {
          dropTip();
          setKick((k) => k + 1);
          if (cycle) {
            const i = options.indexOf(value);
            onSelect(options[(i + 1) % options.length]);
            return;
          }
          place();
          setOpen((o) => !o);
        }}
      >
        {cycle ? <CycleMark k={value} rollIn={rollIn}>{label ?? value}</CycleMark> : label ?? value}
        {/* cycling: the cell is a single toggle plate (the user: "looks like
            the toggle, but when you click it switches") — no chevron */}
        {!cycle && <Chevron kick={kick} />}
      </button>

      {hint &&
        portal(
          <AnimatePresence>
            {tip && !open && (
              <motion.span
                className="ob-tip"
                role="tooltip"
                style={{ left: tipAt.left, bottom: tipAt.bottom }}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 3 }}
                transition={{ duration: 0.14, ease: [0.33, 1, 0.68, 1] }}
              >
                {hint}
              </motion.span>
            )}
          </AnimatePresence>,
        )}

      <Menu
        open={open}
        at={at}
        value={value}
        options={options}
        format={(v) => v}
        icon={icon}
        onSelect={onSelect}
        onClose={close}
        anchor={ref}
      />
    </>
  );
}

/**
 * Render into <body>, or nowhere until the client has it.
 *
 * These widgets are server-rendered by Astro before they hydrate, so
 * `document` does not exist on the first pass. Nothing here is visible
 * until a menu is opened, which cannot happen before hydration, so
 * skipping the portal server-side costs nothing.
 */
export function portal(node: ReactNode): ReactNode {
  return typeof document === "undefined" ? null : createPortal(node, document.body);
}

/**
 * `kick` — a count of clicks on the control that owns it. Each new value
 * remounts the mark and plays its press: down 1.5px in 80ms, then back on
 * an overshooting spring (the user's dropdown reference, 2026-11-19: "the
 * click on the chevron to trigger the dropdown"). 0 never plays, so the
 * mark is still on first paint.
 */
/** The chevron's press for a mark drawn by another widget (the option
    chain's own chevron): the same dip and spring, on a wrapper. */
export function Press({ kick, children }: { kick: number; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      key={kick}
      style={{ display: "inline-flex" }}
      initial={false}
      animate={kick && !reduce ? { y: [0, 1.5, 0] } : undefined}
      transition={PRESS}
    >
      {children}
    </motion.span>
  );
}

const PRESS = {
  duration: 0.28,
  times: [0, 0.29, 1],
  ease: [
    [0.33, 1, 0.68, 1],
    [0.34, 1.4, 0.64, 1],
  ] as [number, number, number, number][],
};

/** The cycling prefix's mark — swapped instantly (the user, 2026-11-19,
    after a roll and then a 0.35s blur crossfade: "it feels delayed… try
    this instead", a shadcn / Radix Toggle, which animates nothing but its
    colours). The click's answer is on screen in the same frame. (`k` and
    `rollIn` are kept so the call sites stay put.) */
function CycleMark({ children }: { k: string; children: ReactNode; rollIn?: boolean }) {
  return (
    <span className="ob-cycle-mark">
      <span className="ob-cycle-mark-in">{children}</span>
    </span>
  );
}

/** An up/down pair in place of the dropdown chevron — the cycling prefix's
    affordance (the user's reference: a stepper's ⇕ beside the mark). Same
    stroke and ink as the chevron, the same press on a click. */
export function UpDown({ kick = 0 }: { kick?: number }) {
  return (
    <Press kick={kick}>
      <svg
        className="ob-chevron ob-updown"
        width="8"
        height="11"
        viewBox="0 0 14 19"
        fill="none"
        aria-hidden="true"
      >
        <path d="M3.5 7.25 7 3.75l3.5 3.5M3.5 11.75 7 15.25l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Press>
  );
}

export function Chevron({ kick = 0 }: { kick?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.svg
      key={kick}
      className="ob-chevron"
      width="8"
      height="8"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      initial={false}
      animate={kick && !reduce ? { y: [0, 1.5, 0] } : undefined}
      transition={PRESS}
    >
      <path
        d="M3.5 5.25 7 8.75l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </motion.svg>
  );
}
