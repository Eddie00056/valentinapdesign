import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
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
 *  - the strategy re-classifies itself (Long call -> Call spread -> Iron
 *    condor …) and the chip crossfades
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

/** Re-classify the open legs into a recognised strategy, or "Custom". */
function detect(legs: Leg[]): string {
  const n = legs.length;
  if (n === 0) return "Custom";
  const calls = legs.filter((l) => l.kind === "call");
  const puts = legs.filter((l) => l.kind === "put");

  if (n === 1) {
    const l = legs[0];
    return `${l.side === "buy" ? "Long" : "Short"} ${l.kind}`;
  }
  if (n === 2) {
    if (
      calls.length === 2 &&
      calls[0].side !== calls[1].side &&
      calls[0].strike !== calls[1].strike
    )
      return "Call spread";
    if (
      puts.length === 2 &&
      puts[0].side !== puts[1].side &&
      puts[0].strike !== puts[1].strike
    )
      return "Put spread";
    if (calls.length === 1 && puts.length === 1 && calls[0].side === puts[0].side) {
      const dir = calls[0].side === "buy" ? "Long" : "Short";
      return calls[0].strike === puts[0].strike
        ? `${dir} straddle`
        : `${dir} strangle`;
    }
  }
  if (n === 4 && calls.length === 2 && puts.length === 2) return "Iron condor";
  if (n === 3) return "Butterfly";
  return "Custom";
}

/** Believable live per-contract mark: intrinsic + a time value that decays
    with distance from the money and wobbles gently on every tick. */
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

/* ---- odometer number (Motion): a 0-9 strip per digit slides to the target.
   No AnimatePresence, so a digit can never leave a ghost behind. ---- */

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function Digit({ d }: { d: number }) {
  const reduce = useReducedMotion();
  return (
    <span
      style={{
        display: "inline-block",
        overflow: "hidden",
        // Explicit width, not content-sized — a nested flex column's
        // auto-width can render inconsistently cell to cell even with
        // tabular-nums, which read as an uneven gap between digits.
        width: "0.58em",
        height: "1.15em",
        lineHeight: "1.15em",
        verticalAlign: "bottom",
      }}
    >
      <motion.span
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
        }}
        animate={{ y: `-${d * 1.15}em` }}
        transition={
          reduce ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }
        }
      >
        {DIGITS.map((n) => (
          <span key={n} style={{ height: "1.15em" }}>
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

function Rolling({ value, style }: { value: string; style?: CSSProperties }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontVariantNumeric: "tabular-nums",
        // Digits render as separate inline-block cells (for the odometer
        // roll) rather than plain text — the page's letter-spacing still
        // applies at each cell boundary, which reads as an uneven gap
        // between digits. Numbers should be tight regardless.
        letterSpacing: 0,
        ...style,
      }}
    >
      {value.split("").map((ch, i) =>
        ch >= "0" && ch <= "9" ? (
          <Digit key={i} d={+ch} />
        ) : (
          // Digit cells sit at vertical-align:bottom (baked into their own
          // height/line-height box) — punctuation must match that exact
          // alignment or it visibly staggers against the digits next to it.
          <span
            key={i}
            style={{
              display: "inline-block",
              height: "1.15em",
              lineHeight: "1.15em",
              verticalAlign: "bottom",
              whiteSpace: "pre",
            }}
          >
            {ch}
          </span>
        ),
      )}
    </span>
  );
}

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTpl, setActiveTpl] = useState(TEMPLATES[0].name);
  const [orderType, setOrderType] = useState<"Limit" | "Market">("Limit");
  const [tif, setTif] = useState<"Day" | "GTC">("Day");
  const [limitPx, setLimitPx] = useState(1.75);
  const [limitEditing, setLimitEditing] = useState(false);
  const [limitDraft, setLimitDraft] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const subT = useRef<number | undefined>(undefined);

  const S = px.price;
  const n = px.n;
  const strategy = detect(legs);

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
  function applyTemplate(name: string) {
    setMenuOpen(false);
    setActiveTpl(name);
    const tpl = TEMPLATES.find((t) => t.name === name);
    if (tpl) setLegs(tpl.make());
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
        <div className="ob-card">
          {/* ---- instrument (locked) + strategy + live price, one row ---- */}
          <div className="ob-row2">
            <div className="ob-seg" role="group" aria-label="Instrument — options only">
              <button
                type="button"
                className="ob-seg-btn"
                disabled
                tabIndex={-1}
                title="This ticket is options only"
              >
                <span className="ob-seg-t">Stock</span>
              </button>
              <button
                type="button"
                className="ob-seg-btn"
                data-on="true"
                aria-current="true"
              >
                <motion.span
                  layoutId="ob-seg-ind"
                  className="ob-seg-ind"
                  transition={spring}
                />
                <span className="ob-seg-t">Option</span>
              </button>
            </div>

            <div className="ob-strat">
              <button
                type="button"
                className="ob-strat-btn"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
              >
                {/* Instant, not crossfaded — the strategy label re-classifies
                    on every leg edit, and the Swap slide/fade read as too
                    busy/distracting happening that often. */}
                <span className="ob-strat-label">{strategy}</span>
                <Chevron />
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <>
                    <div
                      style={{ position: "fixed", inset: 0, zIndex: 20 }}
                      onClick={() => setMenuOpen(false)}
                    />
                    <motion.div
                      className="ob-menu"
                      role="menu"
                      initial={{ opacity: 0, scale: 0.96, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: -4 }}
                      transition={
                        reduce ? { duration: 0 } : { duration: 0.15, ease: [0.33, 1, 0.68, 1] }
                      }
                    >
                      {TEMPLATES.map((t) => (
                        <button
                          key={t.name}
                          type="button"
                          role="menuitem"
                          data-active={activeTpl === t.name}
                          onClick={() => applyTemplate(t.name)}
                        >
                          {t.name}
                          <span>
                            {t.make().length} {t.make().length === 1 ? "leg" : "legs"}
                          </span>
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
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

                    <span className="ob-chip ob-chip--exp">{EXPIRY}</span>
                    {/* Fixed at add-time (stock: entry price, option: strike)
                        — never streams off the live tick, unlike the mark
                        price used for net/bid/ask. Always $XXX.XX. */}
                    <span className="ob-chip ob-chip--strike">${l.strike.toFixed(2)}</span>

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

                    {legs.length > 1 && (
                      <button
                        type="button"
                        className="ob-x"
                        aria-label="Remove leg"
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
                    )}
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
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                    <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  {label}
                </button>
              ))}
            </div>

          </div>

          {/* ---- live net + depth ---- */}
          <AnimatePresence initial={false}>
            {showNet && (
              <motion.div
                className="ob-net"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={snap}
              >
                <div className="ob-net-inner">
                  <div className="ob-total-row">
                    <div className="ob-quote-col">
                      <span className="ob-quote-h" style={{ visibility: "hidden" }}>
                        Total
                      </span>
                      <span className="ob-total-label">Total:</span>
                    </div>
                    <div className="ob-quote-pair">
                      <div className="ob-quote-col">
                        <span className="ob-quote-h">Bid</span>
                        <span className="ob-quote-box bid">
                          <Rolling value={money(bid)} />
                        </span>
                      </div>
                      <div className="ob-quote-col">
                        <span className="ob-quote-h">Ask</span>
                        <span className="ob-quote-box ask">
                          <Rolling value={money(ask)} />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
                  <Rolling value={limitPx.toFixed(2)} />
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
      </LayoutGroup>
    </div>
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

