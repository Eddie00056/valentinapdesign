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
import { WidgetShell, Close } from "../shared/WidgetShell";
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
type Leg = {
  id: number;
  side: Side;
  qty: number;
  kind: Kind;
  strike: number;
  /** Per leg, so a calendar spread is expressible. */
  expiry: string;
};

const EXPIRY = "24 May 2024"; // Figma: full month name, 4-digit year

/** Every order type the ticket offers, in the reference's own order. */
const ORDER_TYPES = [
  "Market",
  "Limit",
  "Limit on open",
  "Limit on close",
  "Stop",
  "Stop limit",
  "Trailing stop",
  "Trailing stop limit",
] as const;

type OrderType = (typeof ORDER_TYPES)[number];

/** The ones that carry a limit price. The rest grey the price field out. */
const PRICED: ReadonlySet<string> = new Set([
  "Limit",
  "Limit on open",
  "Limit on close",
  "Stop limit",
  "Trailing stop limit",
]);

/** The three things a stock order can carry alongside it. */
const ATTACHMENTS = [
  { id: "profit", label: "Profit order", tone: "up" },
  { id: "loss", label: "Loss order", tone: "down" },
  { id: "special", label: "Special instructions", tone: "neutral" },
] as const;

type AttachId = (typeof ATTACHMENTS)[number]["id"];

/** An attachment's own little ticket. */
type Attachment = {
  type: OrderType;
  qty: number;
  price: number;
};

const newAttachment = (price: number): Attachment => ({
  type: "Limit",
  qty: 1,
  /* Opens at the underlying's mark — a profit or loss order is set
     relative to where the stock is, so starting at zero would be a value
     nobody wants and everybody has to clear. */
  price: +price.toFixed(2),
});

/** What the expiry picker offers. The first is the ticket's default. */
const EXPIRIES = [
  "24 May 2024",
  "31 May 2024",
  "21 Jun 2024",
  "19 Jul 2024",
] as const;

/** Strikes either side of a leg's own, at the $5 steps the chain uses. */
function strikesAround(strike: number): number[] {
  return [-10, -5, 0, 5, 10].map((d) => strike + d);
}
const MAX_LEGS = 4;

/** The underlying this ticket is written on — the same one the alert and
    order-placement screens use, which is why it shares their pxHub clock
    and why the default leg strikes sit either side of $195. */
const SYMBOL = "DASH";

/** Shares per option contract. A share is, of course, one. */
const CONTRACT_MULTIPLIER = 100;

/** Yesterday's close. Set so the ticket opens at a familiar +$2.63. */
const PREV_CLOSE = 191.66;

let uid = 0;
const mk = (side: Side, kind: Kind, strike: number): Leg => ({
  id: uid++,
  side,
  qty: 1,
  kind,
  strike,
  expiry: EXPIRY,
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
  /* The ticket trades one instrument at a time. Switching converts the
     open legs rather than clearing them: a stock order is a single line,
     so it keeps the first leg and drops the rest; switching back restores
     the default option leg. */
  const [instrument, setInstrument] = useState<Kind>("call");
  const isStock = instrument === "stock";


  /* The quantity field, wherever it has to live. On an options ticket it
     is the second chip in each leg row; on a stock ticket the leg row is
     gone and this sits in the order-params row instead, in front of the
     limit price. Same markup either way. */
  function qtyField(l: Leg) {
    return (
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
                <Caret dir="up" />
              </motion.button>
              <motion.button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => bumpQty(l.id, -1)}
                whileHover={reduce ? undefined : { background: "rgba(72,213,151,0.12)" }}
                whileTap={reduce ? undefined : { scale: 0.82 }}
                transition={spring}
              >
                <Caret dir="down" />
              </motion.button>
            </div>
          </div>
        </label>
    );
  }

  function toggleInstrument() {
    /* Both setters called from the handler, never one from inside the
       other's updater. A state updater has to be pure — React is free to
       run it more than once, and nesting `setLegs` in there queued a fresh
       set of legs per invocation, which is why rows piled up. */
    const next: Kind = instrument === "stock" ? "call" : "stock";
    setInstrument(next);
    setLegs(next === "stock" ? [mk("buy", "stock", 0)] : TEMPLATES[0].make());
    setActiveTpl("Custom");
  }

  /* Keyed by attachment id; present means open. */
  const [attached, setAttached] = useState<Partial<Record<AttachId, Attachment>>>(
    {},
  );

  function toggleAttachment(id: AttachId) {
    setAttached((cur) => {
      const next = { ...cur };
      if (next[id]) delete next[id];
      else next[id] = newAttachment(px.price);
      return next;
    });
  }

  function patchAttachment(id: AttachId, patch: Partial<Attachment>) {
    setAttached((cur) =>
      cur[id] ? { ...cur, [id]: { ...cur[id]!, ...patch } } : cur,
    );
  }

  const [orderType, setOrderType] = useState<OrderType>("Limit");
  /* Five of the eight types quote a price; the other three grey the field
     out rather than hiding it, so the row keeps its shape. */
  const priced = PRICED.has(orderType);
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
    net += (l.side === "buy" ? 1 : -1) * legMark(l, S, n) * l.qty;
  }
  /* The order's mark, and a spread around it.
  
     Bid and Ask used to BOTH read `net` — the playground mock showed one
     figure twice, differentiated by colour alone. That was survivable
     while there were two of them; with Mid on the row it would be the same
     number three times, and Mid means nothing unless it sits between
     something.
  
     Half a cent per dollar of premium, floored at a cent, rounded to the
     cent — so a $3.00 mark quotes 2.98 / 3.00 / 3.02. Wide enough to read
     as a spread, tight enough to stay plausible on a liquid name. */
  const mid = net;
  const halfSpread = Math.max(0.01, Math.round(Math.abs(mid) * 0.5) / 100);
  const bid = mid - halfSpread;
  const ask = mid + halfSpread;
  /* What the order actually costs. Quotes are per share; an option
     contract is 100 of them, so the figure a reader compares against their
     buying power is the mark times the multiplier. */
  const estTotal = mid * (isStock ? 1 : CONTRACT_MULTIPLIER);

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
    if (!priced) return;
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
              aria-label={`Instrument: ${isStock ? "stock" : "option"} — switch`}
              onClick={toggleInstrument}
            >
              {isStock ? "Stock" : "Option"}
            </button>
          </div>

          {/* ---- legs ----
              A stock ticket has none. Side and size are the whole order,
              and both live in the params row below, so the container goes
              rather than standing empty. */}
          {!isStock && (
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

                    {qtyField(l)}

                    {/* Both are pickers, so both wear the dropdown
                        affordance the Limit field wears: a chevron that
                        surfaces on hover inside a green-stroked field.
                        Neither opens a menu in this study — the expiry is
                        fixed and the strike is set when the leg is added —
                        but they are the same control, so they read the
                        same way and take focus the same way. */}
                    {/* Expiry, strike and Call/Put describe a contract. A
                        stock order has none of them, so they leave the row
                        rather than sitting there greyed — what is left is
                        exactly a stock ticket: side, size, done. */}
                    {!isStock && (
                      <Dropdown
                        className="ob-chip ob-chip--exp"
                        ariaLabel="Expiry"
                        value={l.expiry}
                        options={EXPIRIES}
                        onSelect={(v) => patchLeg(l.id, { expiry: v })}
                      />
                    )}
                    {/* Fixed at add-time (stock: entry price, option: strike)
                        — never streams off the live tick, unlike the mark
                        price used for net/bid/ask. Always $XXX.XX. */}
                    {!isStock && (
                      <Dropdown
                        className="ob-chip ob-chip--strike"
                        ariaLabel="Strike"
                        value={l.strike}
                        options={strikesAround(l.strike)}
                        onSelect={(v) => patchLeg(l.id, { strike: v })}
                        format={(v) => `$${Number(v).toFixed(2)}`}
                      />
                    )}

                    {!isStock && (
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
                    )}

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

            {/* A stock order is one line — there are no further legs to
                add to it, so the row goes rather than offering calls and
                puts on a ticket that trades neither.

                Not the `hidden` attribute: this row sets `display: flex`,
                which outranks the UA's `[hidden] { display: none }`, so
                the attribute was set and the row stayed on screen. */}
            {!isStock && (
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
            )}

          </div>

          )}

          {/* ---- order params ---- */}
          <div className="ob-params-panel">
          <div className={`ob-params${isStock ? " ob-params--stock" : ""}`}>
            <Dropdown
              className="ob-field ob-field--switch"
              ariaLabel="Order type"
              value={orderType}
              options={ORDER_TYPES}
              onSelect={setOrderType}
            />

            {/* On a stock ticket the size sits here, in front of the price
                — the two numbers that define the order, side by side. */}
            {isStock && legs[0] && qtyField(legs[0])}

            <div className={`ob-field ob-stepper${priced ? "" : " is-disabled"}`}>
              <span className="ob-field-k">Limit</span>
              {limitEditing ? (
                <span className="ob-stepper-num ob-stepper-num--editing">
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label="Limit price"
                    /* An <input> with no `size` carries a default intrinsic
                       width of ~20 characters. The card is fit-content, so
                       that width fed straight into its max-content pass and
                       the whole widget jumped 11px wider the moment this
                       field was clicked into. `size=1` makes the intrinsic
                       width negligible; the CSS width fills the field. */
                    size={1}
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
                  disabled={!priced}
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
                    disabled={!priced}
                    onClick={() => bumpLimit(0.01)}
                    whileHover={reduce ? undefined : { background: "rgba(72,213,151,0.12)" }}
                    whileTap={reduce ? undefined : { scale: 0.82 }}
                    transition={spring}
                  >
                    <Caret dir="up" />
                  </motion.button>
                  <motion.button
                    type="button"
                    aria-label="Decrease limit price"
                    disabled={!priced}
                    onClick={() => bumpLimit(-0.01)}
                    whileHover={reduce ? undefined : { background: "rgba(72,213,151,0.12)" }}
                    whileTap={reduce ? undefined : { scale: 0.82 }}
                    transition={spring}
                  >
                    <Caret dir="down" />
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

          {/* ---- attachments ----
              Their own container, beside the order's details rather than
              inside them: what the order IS and what rides along with it
              are two statements, and the options ticket keeps its legs
              apart from its params for the same reason. */}
          {isStock && (
            <div className="ob-attach-panel">

                {/* Each attachment is its own small ticket, entering the
                    way a leg does — same 0.18s fade-and-lift, same layout
                    spring on everything below it. The + that opened it
                    steps out while it is open; its own X puts it back.

                    Open attachments come FIRST and the remaining + buttons
                    sit under them, so the row of things you can still add
                    stays at the bottom of the stack rather than stranded
                    above what you already added. */}
                <AnimatePresence initial={false}>
                  {ATTACHMENTS.filter((a) => attached[a.id]).map((a) => {
                    const v = attached[a.id]!;
                    return (
                      <motion.div
                        key={a.id}
                        className="ob-attach"
                        layout={!reduce}
                        initial={reduce ? undefined : { opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduce ? undefined : { opacity: 0, y: -6 }}
                        transition={rowTransition}
                      >
                        <div className="ob-attach-head">
                          <span className="ob-attach-title" data-tone={a.tone}>
                            {a.label}
                          </span>
                          <button
                            type="button"
                            className="ob-attach-x"
                            aria-label={`Remove ${a.label.toLowerCase()}`}
                            onClick={() => toggleAttachment(a.id)}
                          >
                            <Close size={16} />
                          </button>
                        </div>

                        {/* The same three fields the parent order has,
                            built from the same components — order type,
                            size, price. Duration is gone: an attachment
                            stands for exactly as long as the order it
                            rides on, so asking again was a question with
                            one possible answer. */}
                        <div className="ob-attach-grid">
                          <Dropdown
                            className="ob-field ob-field--switch"
                            ariaLabel={`${a.label} type`}
                            value={v.type}
                            options={ORDER_TYPES}
                            onSelect={(t) => patchAttachment(a.id, { type: t })}
                          />

                          <StepperField
                            shell="chip"
                            label="Qty"
                            ariaLabel={`${a.label} quantity`}
                            value={String(v.qty)}
                            reduce={reduce}
                            spring={spring}
                            onChange={(raw) => {
                              const n = parseInt(raw.replace(/\D/g, ""), 10);
                              patchAttachment(a.id, {
                                qty: Number.isFinite(n) ? Math.min(99, n) : 0,
                              });
                            }}
                            onStep={(d) =>
                              patchAttachment(a.id, {
                                qty: Math.min(99, Math.max(1, v.qty + d)),
                              })
                            }
                          />

                          <StepperField
                            shell="field"
                            label="Limit"
                            ariaLabel={`${a.label} price`}
                            value={v.price.toFixed(2)}
                            reduce={reduce}
                            spring={spring}
                            onChange={(raw) => {
                              const n = parseFloat(raw.replace(/[^\d.]/g, ""));
                              patchAttachment(a.id, {
                                price: Number.isFinite(n) ? n : 0,
                              });
                            }}
                            onStep={(d) =>
                              patchAttachment(a.id, {
                                price: Math.max(
                                  0,
                                  +(v.price + d * 0.01).toFixed(2),
                                ),
                              })
                            }
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                <div className="ob-add ob-add--stock">
                  {ATTACHMENTS.filter((a) => !attached[a.id]).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAttachment(a.id)}
                    >
                      <Plus />
                      {a.label}
                    </button>
                  ))}
                </div>
            </div>
          )}

          {/* ---- footer ---- */}
          <div className="ob-foot">
            {/* Bid and Ask as a reading, not a pair of boxes.

                They used to sit in tinted chips on a row of their own,
                which gave two derived numbers the same weight as the
                fields you actually set. Down here they are what the ticket
                costs, sitting beside the button that commits to it.

                Always shown, including on a one-leg ticket: `net` sums
                every leg, so one leg is a perfectly good sum, and what the
                order costs is not a fact that should appear only once the
                order gets complicated. */}
            <div className="ob-quote-read">
              {/* Bid/Mid/Ask describe a spread you are choosing a price
                  within — an options ticket's whole problem. A stock order
                  at this size has one number worth reading, so the three
                  go and the total stays. */}
              {!isStock && (
                <>
                  <span className="ob-quote-k">Bid:</span>
                  <span className="ob-quote-v bid">{money(bid)}</span>
                  <span className="ob-quote-k">Mid:</span>
                  <span className="ob-quote-v mid">{money(mid)}</span>
                  <span className="ob-quote-k">Ask:</span>
                  <span className="ob-quote-v ask">{money(ask)}</span>
                </>
              )}
              <span className="ob-quote-k">Est. total:</span>
              <span className="ob-quote-v ob-quote-v--total">
                {money(estTotal)}
              </span>
            </div>

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

/* Solid triangle, up or down — the stepper's affordance in the reference
   asset. Measured off it: 22 x 11 at a 4x export is 5.5 x 2.75, so the
   shape is 2:1 and drawn on an 8 x 4 grid at 6 x 3. Filled, not stroked —
   the export shows a solid wedge, not a chevron. */
function Caret({ dir }: { dir: "up" | "down" }) {
  return (
    <svg width="6" height="3" viewBox="0 0 8 4" aria-hidden="true">
      <path
        d={dir === "up" ? "M4 0 8 4H0z" : "M4 4 0 0h8z"}
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * A key, a value and a caret stepper — the shape both the Qty chip and
 * the Limit field on the parent order already take. Attachments render
 * the same component rather than a lookalike, so the two tickets cannot
 * drift apart.
 */
function StepperField({
  shell,
  label,
  value,
  onChange,
  onStep,
  ariaLabel,
  reduce,
  spring,
}: {
  /** `chip` is the Qty pill (radius 6); `field` is the price box (4). */
  shell: "chip" | "field";
  label: string;
  value: string;
  onChange: (raw: string) => void;
  onStep: (delta: number) => void;
  ariaLabel: string;
  reduce: boolean | null;
  spring: Transition;
}) {
  const isChip = shell === "chip";
  return (
    <label
      className={isChip ? "ob-chip ob-chip--qty" : "ob-field ob-stepper"}
    >
      <span className={isChip ? "ob-chip-k" : "ob-field-k"}>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        size={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="ob-stepper-hit" onClick={(e) => e.stopPropagation()}>
        <div className="ob-stepper-btns">
          {([1, -1] as const).map((d) => (
            <motion.button
              key={d}
              type="button"
              aria-label={`${d > 0 ? "Increase" : "Decrease"} ${ariaLabel}`}
              onClick={() => onStep(d)}
              whileHover={
                reduce ? undefined : { background: "rgba(72,213,151,0.12)" }
              }
              whileTap={reduce ? undefined : { scale: 0.82 }}
              transition={spring}
            >
              <Caret dir={d > 0 ? "up" : "down"} />
            </motion.button>
          ))}
        </div>
      </div>
    </label>
  );
}

/** Marks the chosen row in an open menu. */
function Check() {
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
 * A field that opens a list.
 *
 * The menu is `position: fixed` and placed from the trigger's own rect,
 * rather than absolutely inside it. Both containers on this ticket clip
 * their contents to a 6px radius and the card clips to 12 — an absolutely
 * positioned menu would be cut off by whichever it opened inside. Fixed
 * escapes all three.
 */
function Dropdown<T extends string | number>({
  value,
  options,
  onSelect,
  format = (v) => String(v),
  className,
  ariaLabel,
}: {
  value: T;
  options: readonly T[];
  onSelect: (v: T) => void;
  format?: (v: T) => string;
  className: string;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [at, setAt] = useState<{ top: number; left: number; minWidth: number }>({
    top: 0,
    left: 0,
    minWidth: 0,
  });

  function place() {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    /* 4 below the field, per the Atlas doc's own gap. */
    setAt({ top: r.bottom + 4, left: r.left, minWidth: r.width });
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={className}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        data-open={open || undefined}
        onClick={() => {
          place();
          setOpen((o) => !o);
        }}
      >
        {format(value)}
        <Chevron />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Catches the click that closes it, and any scroll under it —
                the menu is placed once, so it must not outlive a scroll. */}
            <div
              className="ob-dd-scrim"
              onClick={() => setOpen(false)}
              onWheel={() => setOpen(false)}
            />
            <motion.div
              className="ob-dd-menu"
              role="listbox"
              style={{ top: at.top, left: at.left, minWidth: at.minWidth }}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14, ease: [0.33, 1, 0.68, 1] }}
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
                    setOpen(false);
                  }}
                >
                  <span>{format(o)}</span>
                  {o === value && <Check />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
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

