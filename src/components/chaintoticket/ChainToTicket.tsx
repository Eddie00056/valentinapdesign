import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { OptionChain } from "../optionchain/OptionChain";
import { WorkspaceShell } from "../workspace/WorkspaceShell";
import type { QuotePick } from "../optionchain/ChainTable";
import {
  OptionsBuilder,
  MAX_LEGS,
  type IncomingQuote,
  type LegSummary,
  type Underlying,
} from "../optionsbuilder/OptionsBuilder";
import "./chain-to-ticket.css";

/**
 * The workspace canvas's dot pitch, in pixels.
 *
 * Stated in both places it is needed — here and as the canvas's
 * `background-size` in workspace-shell.css — because one is a layout
 * constant and the other is a paint. Change one and change the other, or
 * the widgets snap to a grid that is no longer the one being drawn.
 */
const GRID = 24;

/** One quote's identity, shared by the lit pill and the leg it stands for.
 *
 *  The expiry is part of it: the same strike on two different expiries is
 *  two different contracts, and picking one must not light the other. */
const keyOf = (p: {
  strike: number;
  kind: string;
  action?: string;
  side?: string;
  expiry: string;
}) => `${p.strike}:${p.kind}:${p.action ?? p.side}:${p.expiry}`;

/**
 * The chain and the ticket, side by side, with the wire between them.
 *
 * Two widgets that already existed, each gaining props rather than
 * knowledge of the other: the chain takes `onPick` and the set of quotes
 * currently on the ticket; the ticket takes an incoming quote and reports
 * back what it holds. Neither imports the other.
 *
 * A price on a chain is not a number to read — it is an order you have not
 * placed yet, and the distance between those two things should be one
 * click. Which price you click decides the side: the bid is where you
 * sell, the ask is where you buy.
 *
 * The first pick replaces the leg the ticket opens with, which nobody
 * chose. Every pick after that adds one, up to the ticket's own four.
 * Picking a lit quote again takes it back off.
 */
/**
 * A widget you can pick up by its grip and put down on the canvas dots.
 *
 * Both cards use it. It was written inline for the ticket and the chain
 * would have been a second copy of forty lines of measurement — and the
 * two have to snap to the same grid in the same way or the pair stops
 * lining up the moment either one is moved.
 *
 * Returns the props for the element that MOVES, and the handler the
 * widget's own grip calls.
 */
function useCanvasDrag(enabled: boolean) {
  /* `dragListener: false` below means only the grip starts a drag — a
     press anywhere else on the card is still a press on whatever control
     is under it, which is most of the card. */
  const controls = useDragControls();
  /* Where the card has been dragged to, in canvas pixels, snapped. */
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const ref = useRef<HTMLDivElement>(null);
  /* The card's own top-left within the canvas, with the drag offset taken
     back out. Snapping has to happen against THIS, not against the drag
     offset alone: the ticket rests 4px from a 600-wide chain, so its left
     edge starts off the grid, and rounding the offset would only ever
     preserve that. Measured once per drag, because it cannot change while
     one is in progress. */
  const origin = useRef({ x: 0, y: 0 });
  /* The card being moved paints over the one that is not. Without it the
     pair's DOM order decides, and dragging the chain across the ticket
     sends it behind a card it is visibly on top of. */
  const [dragging, setDragging] = useState(false);

  return {
    start: (e: ReactPointerEvent) => controls.start(e),
    props: {
      drag: enabled,
      dragListener: false,
      dragControls: controls,
      /* No constraints: the ask was to put it wherever. No momentum or
         elastic either — this is a panel being placed, not a thing being
         thrown. */
      dragMomentum: false,
      dragElastic: 0,
      ref,
      style: {
        x,
        y,
        position: "relative" as const,
        zIndex: dragging ? 3 : undefined,
      },
      onDragStart: () => {
        setDragging(true);
        const el = ref.current;
        const canvas = el?.closest(".wsp-canvas");
        if (!el || !canvas) return;
        const r = el.getBoundingClientRect();
        const c = canvas.getBoundingClientRect();
        /* The whole screen is drawn at a scale (see WorkspaceShell), so a
           rect measured off it is in screen pixels while `x` and the grid
           are in the canvas's own layout pixels. The canvas's drawn width
           over its layout width IS that scale, read from the element
           itself rather than passed down. */
        const s = c.width / canvas.clientWidth || 1;
        origin.current = {
          x: (r.left - c.left) / s + canvas.scrollLeft - x.get(),
          y: (r.top - c.top) / s + canvas.scrollTop - y.get(),
        };
      },
      onDragEnd: () => setDragging(false),
      /* Snapped to the canvas's own dot grid, every frame rather than on
         release: the card moves in 24px steps under the pointer, so what
         you see while dragging is where it will land. Released-only
         snapping makes the last few pixels of a drag a lie.

         Motion recomputes x and y from the drag origin plus the pointer
         delta on each pointermove, so rounding them here cannot
         accumulate — the next frame starts from the true pointer position
         again, not from the rounded one.

         Snapped against the card's position ON THE CANVAS, not against
         the drag offset — see `origin`. So wherever it starts, the first
         drag puts its top-left corner on a dot. */
      onDrag: () => {
        const o = origin.current;
        const snap = (v: number, base: number) =>
          Math.round((base + v) / GRID) * GRID - base;
        x.set(snap(x.get(), o.x));
        y.set(snap(y.get(), o.y));
      },
    },
  };
}

export function ChainToTicket() {
  const reduce = useReducedMotion();
  const chainDrag = useCanvasDrag(!reduce);
  const ticketDrag = useCanvasDrag(!reduce);
  /* The ticket can be dismissed. Picking a price opens a fresh one — a
     chain with nowhere to send a quote would be a dead end. */
  const [open, setOpen] = useState(true);
  const [incoming, setIncoming] = useState<IncomingQuote | undefined>();
  /* The chain owns the underlying on this page; the ticket is written on
     whatever it is showing. Two widgets about the same trade should not
     disagree about which symbol it is or what it costs. */
  const [underlying, setUnderlying] = useState<Underlying>();
  /* Derived from the ticket, not from the clicks — see onLegsChange. A
     leg removed with the row's own X unlights its pill too. */
  const [pickedKeys, setPickedKeys] = useState<ReadonlySet<string>>(new Set());
  /* The one quote to run a beam around: whichever leg on the ticket the
     pointer is over. The two widgets already agree about which quotes are
     HELD; this is the same fact narrowed to one, so hovering a leg says
     where it came from. */
  const [beamKey, setBeamKey] = useState<string | null>(null);
  /* And the other direction: the quote the pointer is on in the chain,
     as the leg it would be. */
  const [litLeg, setLitLeg] = useState<LegSummary | null>(null);

  /* Whether the reader has chosen anything yet. Not derivable from
     `pickedKeys`: the ticket opens holding a default leg, so that set is
     never empty, and the first pick would read as an addition to a leg
     nobody asked for. */
  const chosen = useRef(false);

  function pick(p: QuotePick) {
    const key = keyOf(p);
    const held = pickedKeys.has(key);

    /* Reopening: the ticket comes back empty of anything you did not just
       ask for, so this quote replaces rather than adds. */
    if (!open) {
      setOpen(true);
      chosen.current = true;
      setIncoming((cur) => ({
        ...p,
        mode: "replace",
        nonce: (cur?.nonce ?? 0) + 1,
      }));
      return;
    }

    /* Full, and this is a new quote: nothing to do. The ticket would
       refuse it anyway; refusing it here keeps the pill from lighting up
       for a leg that was never added. */
    if (chosen.current && !held && pickedKeys.size >= MAX_LEGS) return;

    const mode = !chosen.current ? "replace" : held ? "remove" : "add";
    chosen.current = true;

    setIncoming((cur) => ({
      ...p,
      mode,
      /* Bumped per click. Two clicks on the same ask are two separate
         acts, and the second has to land as surely as the first. */
      nonce: (cur?.nonce ?? 0) + 1,
    }));
  }

  return (
    <WorkspaceShell>
    <div className="ctt">
      {/* The chain moves too. Same grip, same grid, same hook — see
          useCanvasDrag. */}
      <motion.div className="ctt-chain" {...chainDrag.props}>
        <OptionChain
          onPick={pick}
          pickedKeys={pickedKeys}
          beamKey={beamKey}
          onHoverQuote={(q) =>
            setLitLeg(
              q
                ? {
                    strike: q.strike,
                    kind: q.kind,
                    side: q.action,
                    expiry: q.expiry,
                  }
                : null,
            )
          }
          onSpotChange={setUnderlying}
          onGrip={chainDrag.start}
        />
      </motion.div>
      <div className="ctt-ticket">
        <AnimatePresence>
          {open && (
            <motion.div
              /* The DRAG wrapper, and it has to be the outer one.

                 It was inside the morph wrapper below, which clips to its
                 own box (`overflow: hidden`, for the exit's height
                 collapse) — so dragging moved the card straight out of
                 view through the side of its own container. Above the
                 clipper, the transform carries the clipper with it.

                 Drag and the entrance also stay on separate elements:
                 both write to x/y, and sharing a node means the card
                 snaps back to the origin the first time either animation
                 re-runs. */
              {...ticketDrag.props}
            >
              <motion.div
                /* Morphs out rather than vanishing: down to nothing in
                   place, so the eye follows the card away instead of
                   finding a hole where it was. `height` is animated too,
                   so the column closes behind it on a narrow screen.

                   Enters without scale, on purpose. The rows inside carry
                   `layout`, and Motion re-measures those on every render
                   the ticket does — the live price ticks about once a
                   second, so one lands inside almost every entrance.
                   Mid-scale, that measurement reads a row a fraction
                   shorter than the one before, and the layout spring
                   animates the difference away: the slight bounce of the
                   leg line as the card arrives. Opacity and a short lift
                   change no child's measured box, so there is nothing to
                   correct. */
                initial={reduce ? undefined : { opacity: 0, y: -8 }}
                /* NO `height: "auto"` here, and this is load-bearing.

                   Motion does not animate to the word `auto`: it measures
                   what auto resolves to, animates to that NUMBER, and
                   leaves the number on the element. So an `animate` that
                   mentions height pins this wrapper to whatever the
                   ticket happened to measure as it arrived — and since
                   the wrapper also clips (`overflow: hidden`, for the
                   exit below), every leg added after that was added
                   underneath the fold. It looked exactly like the click
                   had not registered, and clicking the same price again
                   toggles the leg back off, so the quote appeared to need
                   several attempts to stick.

                   Without it the wrapper has no height of its own and
                   grows with its content. The exit still collapses: given
                   only a target of 0, Motion reads the current height off
                   the element as its starting point. */
                animate={{ opacity: 1, y: 0 }}
                /* Down and out of focus, and the column closes behind it
                   on the same spring. No scale on the way out either: the
                   card's type would go through sizes it was never hinted
                   for, which is the wobble the note above already learned
                   to avoid on the way in. */
                exit={
                  reduce
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        y: 10,
                        filter: "blur(4px)",
                        height: 0,
                        transition: { duration: 0.16, ease: "easeIn" },
                      }
                }
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 500, damping: 45 }
                }
                style={{ transformOrigin: "top center", overflow: "hidden" }}
              >
              <OptionsBuilder
                underlying={underlying}
                incoming={incoming}
                onGrip={ticketDrag.start}
                litLeg={litLeg}
                onLegHover={(leg: LegSummary | null) =>
                  setBeamKey(leg ? keyOf(leg) : null)
                }
                onLegsChange={(legs: LegSummary[]) =>
                  setPickedKeys(new Set(legs.map(keyOf)))
                }
                onClose={() => {
                  setOpen(false);
                  /* The chain goes back to how it started: nothing lit,
                     and the next pick reads as a first pick again. */
                  setPickedKeys(new Set());
                  chosen.current = false;
                  setIncoming(undefined);
                }}
              />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
    </WorkspaceShell>
  );
}
