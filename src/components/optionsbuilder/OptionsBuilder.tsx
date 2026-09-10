import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "motion/react";
import type { Transition } from "motion/react";
import { pxHub, PX_BASE } from "../alertscreen/priceHub";
import type { PriceState } from "../alertscreen/priceHub";
import { UP, DOWN } from "../alertscreen/chart";
import { WidgetShell } from "../shared/WidgetShell";
import { TickerPill } from "../shared/TickerPill";
import "./options-builder.css";

/**
 * Options strategy builder — the "Order entry" card from the Wealthsimple
 * playground, rebuilt as a live interaction study in *forming a multi-leg
 * options strategy*:
 *
 *  - the underlying ticks off the shared pxHub clock (same one the
 *    alert-creation screen uses), so the header price, every leg's mark and
 *    the net debit / bid-ask are always moving
 *  - each leg you add animates into the stack and a connector bracket grows
 *    down the left gutter to bind the legs into one order
 *  - the leg stack is the whole statement now: the strategy chip that used
 *    to name it (Long call -> Call spread -> Iron condor …) has been
 *    removed, so what you are building reads off the legs themselves
 *  - the depth bar under the net leans bid vs ask on every tick
 *
 * Instrument is locked to Options. All motion is Motion (motion.dev) and
 * everything collapses to instant under prefers-reduced-motion.
 */

type Side = "buy" | "sell";
type Kind = "call" | "put" | "stock";
type Leg = { id: number; side: Side; qty: number; kind: Kind; strike: number };

const EXPIRY = "24 May 2024"; // Figma: full month name, 4-digit year
const MAX_LEGS = 4;

/** The underlying this ticket is written on — the same one the alert and
    order-placement screens use, which is why it shares their pxHub clock
    and why the default leg strikes sit either side of $195. */
const SYMBOL = "DASH";

/** Yesterday's close. Set so the ticket opens at a familiar +$2.63. */
const PREV_CLOSE = 191.66;

let uid = 0;
const mk = (side: Side, kind: Kind, strike: number): Leg => ({
  id: uid++,
  side,
  qty: 1,
  kind,
  strike,
});

const TEMPLATES: { name: string; make: () => Leg[] }[] = [
  { name: "Long call", make: () => [mk("buy", "call", 195)] },
  {
    name: "Call debit spread",
    make: () => [mk("buy", "call", 195), mk("sell", "call", 205)],
  },
  {
    name: "Long straddle",
    make: () => [mk("buy", "call", 195), mk("buy", "put", 195)],
  },
  {
    name: "Iron condor",
    make: () => [
      mk("sell", "put", 185),
      mk("buy", "put", 180),
      mk("sell", "call", 205),
      mk("buy", "call", 210),
    ],
  },
];

function legMark(l: Leg, S: number, n: number): number {
  if (l.kind === "stock") return S;
  const intrinsic =
    l.kind === "call" ? Math.max(0, S - l.strike) : Math.max(0, l.strike - S);
  const moneyness = Math.abs(S - l.strike);
  const wob = Math.sin(n * 1.3 + l.strike) * 0.05;
  const timeValue = Math.max(0.12, 3.1 - moneyness * 0.13) + wob;
  return Math.max(0.01, intrinsic + timeValue);
}

const money = (x: number) => `$${Math.abs(x).toFixed(2)}`;

/* ---- crossfading label (Motion) ---- */

function Swap({ k, children }: { k: string; children: ReactNode }) {
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

export function OptionsBuilder() {
  const reduce = useReducedMotion();
  const spring: Transition = reduce
    ? { duration: 0 }
    : { type: "spring", stiffness: 460, damping: 40 };
  const snap: Transition = reduce
    ? { duration: 0 }
    : { duration: 0.3, ease: [0.33, 1, 0.68, 1] };
  // Leg row enter/exit + layout reflow — fast/subtle fade+lift, not a
  // manually-animated height. The rest of the stack repositions via its
  // own `layout` spring as a row mounts/unmounts.
  const rowTransition: Transition = reduce
    ? { duration: 0 }
    : {
        duration: 0.18,
        ease: "easeOut",
        layout: { type: "spring", stiffness: 500, damping: 35 },
      };

  const [px, setPx] = useState<PriceState>({
    price: PX_BASE,
    prev: PX_BASE,
    dir: 0,
    n: 0,
  });

  useEffect(() => {
    const hub = pxHub();
    const unsub = hub.subscribe((h) => {
      setPx({ price: h.price, prev: h.prev, dir: h.dir, n: h.n });
    });
    return unsub;
  }, []);

  // Always start with a leg on the ticket — there's no empty state.
  const [legs, setLegs] = useState<Leg[]>(() => TEMPLATES[0].make());
  /* `activeTpl` outlives the strategy dropdown that used to display it:
     the leg editors still mark the ticket "Custom" as soon as you touch
     one, which is what keeps a template from claiming edits it did not
     make if the picker ever comes back. */
  const [, setActiveTpl] = useState(TEMPLATES[0].name);
  const [orderType, setOrderType] = useState<"Limit" | "Market">("Limit");
  const [tif, setTif] = useState<"Day" | "GTC">("Day");
  const [limitPx, setLimitPx] = useState(1.75);
  const [limitEditing, setLimitEditing] = useState(false);
  const [limitDraft, setLimitDraft] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const subT = useRef<number | undefined>(undefined);

  const S = px.price;
  const n = px.n;

  let net = 0;
  for (const l of legs) {
    if (l.kind === "stock") continue;
    net += (l.side === "buy" ? 1 : -1) * legMark(l, S, n) * l.qty;
  }
  // Bid and Ask read the same figure — matches the playground mock (both
  // boxes show "7.02"), differentiated only by colour, not by an
  // artificial spread.
  const bid = net;
  const ask = net;

  const showNet = legs.length >= 2;

  function addLeg(kind: Kind) {
    setLegs((cur) => {
      if (cur.length >= MAX_LEGS) return cur;
      // Stock legs get a fixed entry price (today's live price at add-time,
      // rounded to a cent) — same idea as an option's strike, never S live.
      const strike = kind === "stock" ? Math.round(S * 100) / 100 : Math.round(S / 5) * 5;
      return [...cur, mk("buy", kind, strike)];
    });
    setActiveTpl("Custom");
  }
  function removeLeg(id: number) {
    // Never drop below one leg — there's no empty state for this widget.
    if (legs.length <= 1) return;
    setLegs((cur) => cur.filter((l) => l.id !== id));
    setActiveTpl("Custom");
  }
  function patchLeg(id: number, patch: Partial<Leg>) {
    setLegs((cur) => cur.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    setActiveTpl("Custom");
  }
  function bumpQty(id: number, delta: number) {
    setLegs((cur) =>
      cur.map((l) =>
        l.id === id ? { ...l, qty: Math.min(99, Math.max(0, l.qty + delta)) } : l,
      ),
    );
    setActiveTpl("Custom");
  }
  function submit() {
    if (submitted) return;
    setSubmitted(true);
    window.clearTimeout(subT.current);
    subT.current = window.setTimeout(() => setSubmitted(false), 1900);
  }

  function bumpLimit(delta: number) {
    setLimitPx((v) => Math.min(999.99, Math.max(0, +(v + delta).toFixed(2))));
  }
  function startEditingLimit() {
    if (orderType === "Market") return;
    setLimitDraft(limitPx.toFixed(2));
    setLimitEditing(true);
  }
  function commitLimit(text: string) {
    setLimitEditing(false);
    const parsed = parseFloat(text);
    if (Number.isFinite(parsed)) {
      setLimitPx(Math.min(999.99, Math.max(0, +parsed.toFixed(2))));
    }
  }

  return (
    <div className="ob-stage">
      <LayoutGroup>
        <WidgetShell title="Order entry" className="ob-shell">
        <div className="ob-card">
          {/* ---- the underlying this ticket is written on ---- */}
          <div className="ob-ticker">
            <TickerPill
              symbol={SYMBOL}
              price={px.price}
              change={px.price - PREV_CLOSE}
              changePct={(px.price - PREV_CLOSE) / PREV_CLOSE}
            />

            {/* The instrument, as one chip rather than a switcher.

                This ticket is options only, so a two-sided control was
                offering a choice that does not exist — it showed Stock
                permanently disabled next to the only real answer. A single
                chip states the answer instead, and reads as a peer of the
                Buy chip on the leg row below, which is the other thing on
                this ticket that names what kind of order this is. */}
            <button
              type="button"
              className="ob-sidebtn ob-instrument"
              disabled
              tabIndex={-1}
              title="This ticket is options only"
              aria-label="Instrument: option"
            >
              Option
            </button>
          </div>

          {/* ---- legs ---- */}
          <div className="ob-legs-panel">
          <motion.div
            className="ob-legs"
            layout={!reduce}
            transition={rowTransition}
          >
            <AnimatePresence initial={false}>
              {legs.map((l) => {
                return (
                  <motion.div
                    key={l.id}
                    className="ob-row"
                    layout={!reduce}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={rowTransition}
                  >
                    <button
                      type="button"
                      className="ob-sidebtn"
                      onClick={() =>
                        patchLeg(l.id, { side: l.side === "buy" ? "sell" : "buy" })
                      }
                      style={{ color: l.side === "buy" ? UP : DOWN }}
                    >
                      {l.side === "buy" ? "Buy" : "Sell"}
                    </button>

                    <label className="ob-chip ob-chip--qty">
                      <span className="ob-chip-k">Qty</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label="Contracts"
                        value={l.qty}
                        onChange={(e) => {
                          const v = parseInt(
                            e.target.value.replace(/\D/g, ""),
                            10,
                          );
                          patchLeg(l.id, {
                            qty: Number.isFinite(v) ? Math.min(99, v) : 0,
                          });
                        }}
                      />
                      <div
                        className="ob-stepper-hit"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="ob-stepper-btns">
                          <motion.button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={() => bumpQty(l.id, 1)}
                            whileHover={reduce ? undefined : { background: "rgba(72,213,151,0.12)" }}
                            whileTap={reduce ? undefined : { scale: 0.82 }}
                            transition={spring}
                          >
                            <svg width="5" height="5" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                              <path d="M4 .8v6.4M.8 4h6.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                            </svg>
                          </motion.button>
                          <motion.button
                            type="button"
                            aria-label="Decrease quantity"
                            onClick={() => bumpQty(l.id, -1)}
                            whileHover={reduce ? undefined : { background: "rgba(72,213,151,0.12)" }}
                            whileTap={reduce ? undefined : { scale: 0.82 }}
                            transition={spring}
                          >
                            <svg width="5" height="5" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                              <path d="M.8 4h6.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                            </svg>
                          </motion.button>
                        </div>
                      </div>
                    </label>

                    {/* Both are pickers, so both wear the dropdown
                        affordance the Limit field wears: a chevron that
                        surfaces on hover inside a green-stroked field.
                        Neither opens a menu in this study — the expiry is
                        fixed and the strike is set when the leg is added —
                        but they are the same control, so they read the
                        same way and take focus the same way. */}
                    <button type="button" className="ob-chip ob-chip--exp">
                      {EXPIRY}
                      <Chevron />
                    </button>
                    {/* Fixed at add-time (stock: entry price, option: strike)
                        — never streams off the live tick, unlike the mark
                        price used for net/bid/ask. Always $XXX.XX. */}
                    <button type="button" className="ob-chip ob-chip--strike">
                      ${l.strike.toFixed(2)}
                      <Chevron />
                    </button>

                    <button
                      type="button"
                      className="ob-chip ob-cp"
                      data-kind={l.kind}
                      onClick={() =>
                        patchLeg(l.id, {
                          kind: l.kind === "call" ? "put" : "call",
                        })
                      }
                    >
                      {l.kind === "put" ? "Put" : "Call"}
                    </button>

                    {/* Always rendered, disabled on a one-leg ticket. It used
                        to be omitted entirely, which meant the row's last
                        column appeared and disappeared as legs came and
                        went — the ticket has to keep one leg, and a control
                        that is present but unavailable says so, where a
                        missing one just looks like a different layout. */}
                    <button
                      type="button"
                      className="ob-x"
                      aria-label="Remove leg"
                      disabled={legs.length <= 1}
                      title={
                        legs.length <= 1
                          ? "A ticket needs at least one leg"
                          : undefined
                      }
                      onClick={() => removeLeg(l.id)}
                    >
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                        <path
                          d="M1 1l6 6M7 1L1 7"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>

            <div className="ob-add">
              {(
                [
                  ["Add call", "call"],
                  ["Add put", "put"],
                ] as const
              ).map(([label, kind]) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => addLeg(kind)}
                  disabled={legs.length >= MAX_LEGS}
                >
                  <Plus />
                  {label}
                </button>
              ))}
            </div>

          </div>

          {/* ---- order params ---- */}
          <div className="ob-params-panel">
          <div className="ob-params">
            <button
              type="button"
              className="ob-field ob-field--switch"
              onClick={() =>
                setOrderType((t) => (t === "Limit" ? "Market" : "Limit"))
              }
            >
              <span className="ob-strat-label">
                <Swap k={orderType}>{orderType}</Swap>
              </span>
              <Chevron />
            </button>

            <div className={`ob-field ob-stepper${orderType === "Market" ? " is-disabled" : ""}`}>
              <span className="ob-field-k">Limit</span>
              {limitEditing ? (
                <span className="ob-stepper-num ob-stepper-num--editing">
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label="Limit price"
                    autoFocus
                    value={limitDraft}
                    onChange={(e) =>
                      setLimitDraft(e.target.value.replace(/[^\d.]/g, "").slice(0, 7))
                    }
                    onBlur={(e) => commitLimit(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitLimit((e.target as HTMLInputElement).value);
                      if (e.key === "Escape") setLimitEditing(false);
                    }}
                  />
                </span>
              ) : (
                <button
                  type="button"
                  className="ob-stepper-num"
                  disabled={orderType === "Market"}
                  onClick={startEditingLimit}
                  aria-label="Edit limit price"
                >
                  {limitPx.toFixed(2)}
                </button>
              )}
              {/* Invisible padding + matching negative margin — a bigger
                  hit/hover target than the visible 16px square without
                  growing the pill's own layout (same trick as the
                  reference AmountStepper's outer wrapper). */}
              <div
                className="ob-stepper-hit"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="ob-stepper-btns">
                  <motion.button
                    type="button"
                    aria-label="Increase limit price"
                    disabled={orderType === "Market"}
                    onClick={() => bumpLimit(0.01)}
                    whileHover={reduce ? undefined : { background: "rgba(72,213,151,0.12)" }}
                    whileTap={reduce ? undefined : { scale: 0.82 }}
                    transition={spring}
                  >
                    <svg width="5" height="5" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                      <path d="M4 .8v6.4M.8 4h6.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </motion.button>
                  <motion.button
                    type="button"
                    aria-label="Decrease limit price"
                    disabled={orderType === "Market"}
                    onClick={() => bumpLimit(-0.01)}
                    whileHover={reduce ? undefined : { background: "rgba(72,213,151,0.12)" }}
                    whileTap={reduce ? undefined : { scale: 0.82 }}
                    transition={spring}
                  >
                    <svg width="5" height="5" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                      <path d="M.8 4h6.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Duration and Account hidden for now — kept here, not
                deleted, so they're a one-line flip to bring back. */}
            {false && (
              <>
                <button
                  type="button"
                  className="ob-field ob-field--switch"
                  aria-label={`Time in force: ${tif === "Day" ? "Day, expires today" : "Good till cancelled"}`}
                  onClick={() => setTif((t) => (t === "Day" ? "GTC" : "Day"))}
                >
                  <span className="ob-strat-label">
                    <Swap k={tif}>{tif === "Day" ? "Good for day" : "GTC"}</Swap>
                  </span>
                  <Chevron />
                </button>

                <button
                  type="button"
                  className="ob-field ob-field--switch"
                  aria-label="Account: Individual TFSA"
                >
                  <span className="ob-strat-label">Individual TFSA</span>
                  <Chevron />
                </button>
              </>
            )}
          </div>
          </div>

          {/* ---- footer ---- */}
          <div className="ob-foot">
            {/* Bid and Ask as a reading, not a pair of boxes.

                They used to sit in tinted chips on a row of their own,
                which gave two derived numbers the same weight as the
                fields you actually set. Down here they are what the ticket
                costs, sitting beside the button that commits to it. The
                row only appears once there is more than one leg, because a
                single leg's net is just that leg's own quote. */}
            <AnimatePresence initial={false}>
              {showNet && (
                <motion.div
                  className="ob-quote-read"
                  initial={reduce ? undefined : { opacity: 0, y: 2 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: 2 }}
                  transition={snap}
                >
                  <span className="ob-quote-k bid">Bid</span>
                  <span className="ob-quote-v bid">{money(bid)}</span>
                  <span className="ob-quote-k ask">Ask</span>
                  <span className="ob-quote-v ask">{money(ask)}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="button"
              className="ob-cta"
              onClick={submit}
              whileTap={reduce ? undefined : { scale: 0.97 }}
              transition={spring}
            >
              <AnimatePresence>
                {submitted && !reduce && (
                  <motion.span
                    className="ob-cta-ring"
                    initial={{ opacity: 0.85, scale: 1 }}
                    animate={{ opacity: 0, scale: 1.3 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                )}
              </AnimatePresence>
              <span className="ob-cta-label">
                <Swap k={submitted ? "done" : "idle"}>
                  {submitted ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                        <path
                          d="M3 8l3.2 3.2L12 5"
                          stroke="currentColor"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Order submitted
                    </>
                  ) : (
                    "Review order"
                  )}
                </Swap>
              </span>
            </motion.button>
          </div>
        </div>
        </WidgetShell>
      </LayoutGroup>
    </div>
  );
}

/* Matched to the exported asset: 34/56 of ink and a 6/56 stroke at 4x is
   a 14px icon with 8.5 of ink and a 1.5 stroke, round-capped.

   Drawn on the 16-unit grid the rest of the icon vocabulary uses rather
   than at its own scale — 4→12 at stroke 1.6 renders 8.4 of ink and a
   1.4 stroke at size 14, a tenth of a pixel off the asset in both, and it
   means this glyph is no longer the one icon in the widget with its own
   coordinate system and a hard-coded stroke. */
function Plus() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 4v8M4 8h8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Chevron() {
  return (
    <svg
      className="ob-chevron"
      width="8"
      height="8"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3.5 5.25 7 8.75l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

