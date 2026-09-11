import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
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
import {
  EXPIRIES as CHAIN_EXPIRIES,
  MONTH_LABELS,
  UNDERLYING as CHAIN_UNDERLYING,
} from "../optionchain/mock";
import "./options-builder.css";

/**
 * The order ticket.
 *
 * It used to be a strategy BUILDER: every leg carried its own side, size,
 * expiry and strike, each one a control you could open. The chain beside
 * it now answers all four — which contract, and which side, is decided by
 * the price you click — so the ticket kept offering a second way to say
 * what had already been said, in a worse place to say it.
 *
 * What is left is a ticket, in the Robinhood sense: the legs are a
 * MANIFEST, not a form. You can read them and you can take one off. The
 * only things you set here are the three the chain cannot tell you —
 * how many, at what price, and for how long — and then you submit.
 *
 * Everything is live: leg marks, the net, the payoff and the cost all
 * move on the shared pxHub clock, anchored to the prices that were
 * actually picked (see `legPrice`).
 */

type Side = "buy" | "sell";
type Kind = "call" | "put";

type Leg = {
  id: number;
  side: Side;
  kind: Kind;
  strike: number;
  /** The chain's own expiry, as an ISO date — the chain picked it. */
  date: string;
  /** What this contract was quoted at when it was picked. */
  price: number;
  /** The model's mark at that same moment — see `legPrice`. */
  base: number;
};

/* The chain's dates, in the ticket's own hand.

   The chain writes "Sep 11, 2026 (2D)"; a ticket writes "11 Sep 2026" and
   stops there. The days to expiry belong to a chain, where you are
   reading a term structure and comparing one expiry against the next; on
   a ticket you have already chosen the contract and the countdown is
   noise in a field you are meant to scan, not study.

   Built from the chain's own month table rather than toLocaleDateString:
   en-GB abbreviates September to "Sept", so the two widgets would have
   disagreed about the spelling of the month they were both naming. Read
   in UTC, so a reader west of Greenwich does not see the day before. */
function ticketExpiry(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTH_LABELS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** How long the order stands — "Duration" on this ticket, which is the
    word the fields around it are written in. "Time in force" is the term
    of art and it is what an options desk says, but every other label on
    this card is a plain word for the thing it sets. */
const TIFS = ["Good for day", "Good till cancelled"] as const;
type Tif = (typeof TIFS)[number];

export const MAX_LEGS = 4;

/** The underlying this ticket is written on when nothing else decides —
    the same one the alert and order-placement screens use, which is why
    it shares their pxHub clock. */
const SYMBOL = "DASH";

/** Shares per option contract. */
const CONTRACT_MULTIPLIER = 100;

let uid = 0;

/**
 * The model's mark for a contract — the thing that MOVES.
 *
 * Every leg is displayed at the price it was picked at, drifting by
 * whatever this has done since (see `legPrice`), so the ticket opens
 * quoting exactly the pill that was clicked and still breathes with the
 * clock rather than freezing the moment it is written.
 */
function legMark(l: { kind: Kind; strike: number }, S: number, n: number): number {
  const intrinsic =
    l.kind === "call" ? Math.max(0, S - l.strike) : Math.max(0, l.strike - S);
  const moneyness = Math.abs(S - l.strike);
  const wob = Math.sin(n * 1.3 + l.strike) * 0.05;
  const timeValue = Math.max(0.12, 3.1 - moneyness * 0.13) + wob;
  return Math.max(0.01, intrinsic + timeValue);
}

/** A leg's live quote: what it was picked at, plus the model's drift
    since. Never below a cent — a contract that has gone to nothing is
    still quoted. */
function legPrice(l: Leg, S: number, n: number): number {
  return Math.max(0.01, l.price + (legMark(l, S, n) - l.base));
}

/**
 * Whether this contract prints on this tick.
 *
 * Every leg used to reprice on every step of the shared clock, so a
 * four-leg ticket moved all four figures in one beat — which is a table
 * being redrawn, not a market. A real chain has each contract trading on
 * its own, and the option chain's own mock already works this way (see
 * ODDS in mock.ts): most quotes hold on any given tick.
 *
 * Deterministic, so a reload replays the same market rather than a new
 * one. Keyed on the CONTRACT rather than the leg, so a ticket holding
 * both sides of one strike moves them together — they are the same
 * quote.
 *
 * ~45% per tick against the hub's 2.2s step: each leg moves every few
 * seconds, and no two of them keep the same rhythm.
 */
function printsOn(l: Leg, n: number): boolean {
  const h =
    Math.sin(l.strike * 12.9898 + (l.kind === "call" ? 4.1 : 8.7) + n * 78.233) *
    43758.5453;
  return h - Math.floor(h) < 0.45;
}

const mk = (
  side: Side,
  kind: Kind,
  strike: number,
  date: string,
  price: number,
  base: number,
): Leg => ({ id: uid++, side, kind, strike, date, price, base });

const money = (x: number) => `$${Math.abs(x).toFixed(2)}`;

/* Money with its sign kept, and a thousands separator — max loss on a
   sized spread runs past $1,000 and reads as noise without one. */
const signedMoney = (x: number) =>
  `${x < 0 ? "-" : ""}$${Math.abs(x).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** A strike in a sentence, not in a field: "$195", "$197.50". The ticket
    used to print $195.00 because it sat in a fixed-width chip beside
    another one; on a line of prose the trailing zeros are just noise. */
const strikeLabel = (s: number) => `$${(+s.toFixed(2)).toString()}`;

/* ---- what the strategy is worth at expiry ---- */

/** One leg's per-share intrinsic value if the underlying finishes at X. */
function intrinsicAt(l: Leg, X: number): number {
  return l.kind === "call" ? Math.max(X - l.strike, 0) : Math.max(l.strike - X, 0);
}

/**
 * Max profit, max loss and breakeven for a set of legs.
 *
 * An option position's payoff at expiry is piecewise linear, and it can
 * only bend at a strike — so every extreme is either at a strike, at zero,
 * or out at infinity, and it is enough to evaluate those points rather
 * than sample a curve. `net` is the per-share cost of the whole order
 * (positive = a debit you pay), so the P&L in dollars is
 * `(intrinsic - net) x 100`.
 *
 * `net` is the LIMIT PRICE, not the mark: these three figures describe
 * the order you are about to send, and the price on it is the one in the
 * field above them.
 *
 * Beyond the highest strike the payoff is a ray: its slope is the net
 * number of long calls, which is what decides whether the profit or the
 * loss is unbounded. `null` means exactly that — the caller prints
 * "Unlimited" rather than a number nobody could name.
 */
function payoffProfile(
  legs: Leg[],
  net: number,
  mult: number,
): { maxProfit: number | null; maxLoss: number | null; breakevens: number[] } {
  const at = (X: number) => {
    let v = 0;
    for (const l of legs) v += (l.side === "buy" ? 1 : -1) * intrinsicAt(l, X);
    return (v - net) * mult;
  };

  const strikes = [...new Set(legs.map((l) => l.strike))].sort((a, b) => a - b);
  const bends = strikes.length ? strikes : [0];
  const top = bends[bends.length - 1];
  /* Slope per $1 above every strike, read one dollar apart rather than
     derived from the legs. */
  const slope = at(top + 2) - at(top + 1);
  const EPS = 1e-9;

  const points = [0, ...bends];
  const values = points.map(at);

  const maxProfit = slope > EPS ? null : Math.max(...values, at(top + 1));
  const maxLoss = slope < -EPS ? null : Math.min(...values, at(top + 1));

  /* Zero crossings, segment by segment. The closed segments interpolate;
     the ray past the last strike is solved from its own slope. */
  const breakevens: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, x1] = [points[i], points[i + 1]];
    const [y0, y1] = [values[i], values[i + 1]];
    if (y0 === 0) breakevens.push(x0);
    if ((y0 < 0 && y1 > 0) || (y0 > 0 && y1 < 0)) {
      breakevens.push(x0 + ((0 - y0) / (y1 - y0)) * (x1 - x0));
    }
  }
  if (Math.abs(slope) > EPS) {
    const yTop = at(top);
    const x = top - yTop / slope;
    if (x > top) breakevens.push(x);
  } else if (at(top) === 0) {
    breakevens.push(top);
  }

  return { maxProfit, maxLoss, breakevens };
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

/** A quote handed in from elsewhere — see the chain-to-ticket page. */
export type IncomingQuote = {
  strike: number;
  kind: Kind;
  action: Side;
  price: number;
  /** The chain's selected expiry, as an ISO date. */
  expiry: string;
  /**
   * `replace` for the first quote — it stands in for the default leg the
   * ticket opens with, which nobody chose. `add` for every one after, up
   * to MAX_LEGS. `remove` when the same quote is picked again.
   */
  mode: "replace" | "add" | "remove";
  /** Bumped per click, so picking the same quote twice still lands. */
  nonce: number;
};

/** What the ticket is holding, for whoever needs to mirror it. */
export type LegSummary = {
  strike: number;
  kind: Kind;
  side: Side;
  /** ISO date, so a chain showing another expiry lights nothing. */
  expiry: string;
};

/** The symbol a ticket is written on, when something else decides it. */
export type Underlying = {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
};

export function OptionsBuilder({
  incoming,
  onLegsChange,
  onClose,
  onGrip,
  underlying,
}: {
  incoming?: IncomingQuote;
  onLegsChange?: (legs: LegSummary[]) => void;
  /** Given, the title bar's X and the ticket's Cancel dismiss it. */
  onClose?: () => void;
  /**
   * Given, the title bar grows a drag grip and this fires when it is taken
   * hold of. The ticket does not move itself — whoever placed it on the
   * page decides where it can go.
   */
  onGrip?: (e: ReactPointerEvent) => void;
  /**
   * Given, the ticket is written on THIS underlying rather than its own —
   * symbol, and the mark every leg drifts with. Beside a chain, a ticket
   * quoting a different symbol at a different price is two widgets that
   * do not know they are about the same trade.
   */
  underlying?: Underlying;
}) {
  const reduce = useReducedMotion();
  const spring: Transition = reduce
    ? { duration: 0 }
    : { type: "spring", stiffness: 460, damping: 40 };

  /* The card's own height, and the only thing that actually MOVES when a
     leg lands.

     500/45 is critical damping for that stiffness (2 x sqrt(500) = 44.7),
     so it travels as fast as an underdamped spring and stops dead. It was
     500/35 — a damping ratio of 0.78 — which overshot and settled back
     every time a row arrived. Fine as a flourish on a ticket you are
     editing directly; wrong when the leg arrives because you clicked a
     price in the widget next door, where the bounce reads as the ticket
     reacting rather than the row arriving. */
  const sizeSpring: Transition = reduce
    ? { duration: 0 }
    : { type: "spring", stiffness: 500, damping: 45 };

  /* Arriving content does not move. It is revealed by the height above it
     opening, the way one iOS sheet grows into another — so all a new row
     does is come up to full opacity while it is uncovered, and 0.16 is
     about how long the spring takes to clear a 28px row. */
  const enterTransition: Transition = reduce
    ? { duration: 0 }
    : { duration: 0.16, ease: "easeOut" };

  /* Leaving content gets out of the way fast: down 10, blurred, gone in
     0.12. It is already out of the layout by then (popLayout), so the
     stack is closing underneath it at the same time. */
  const exitTransition: Transition = reduce
    ? { duration: 0 }
    : { duration: 0.12, ease: "easeIn" };

  const [px, setPx] = useState<PriceState>({
    price: PX_BASE,
    prev: PX_BASE,
    dir: 0,
    n: 0,
  });

  useEffect(() => {
    const hub = pxHub();
    return hub.subscribe((h) => {
      setPx({ price: h.price, prev: h.prev, dir: h.dir, n: h.n });
    });
  }, []);

  /* Every leg's price comes off this, so it has to be the same number the
     chain beside the ticket is showing. */
  const S = underlying ? underlying.price : px.price;
  const n = px.n;

  /* Always start with a leg on the ticket — there's no empty state.

     When the ticket is *mounted* holding a quote — the chain's ticket was
     dismissed, and clicking a price brings a fresh one back — that quote
     is the leg it opens with, rather than a default leg that is swapped
     out a frame later. The swap was a real layout change (one row leaving
     under popLayout, another arriving) landing inside the card's own
     entrance, and the two animations fighting is the bounce: the row
     settled after the card had finished. Seeded here, nothing moves. */
  const [legs, setLegs] = useState<Leg[]>(() =>
    incoming ? [legFrom(incoming, S, n)] : [defaultLeg(S, n)],
  );
  /* The quote `legs` was seeded with, if any. The effect below is keyed on
     the nonce and runs once on mount, so without this it would apply that
     same quote a second time — and that application is exactly the
     animated swap the seeding exists to avoid. Cleared after the first
     run, so every later pick lands normally. */
  const seededNonce = useRef(incoming?.nonce);

  /* Size is the ORDER's, not a leg's.

     Every leg used to carry its own quantity, which is how you express a
     ratio spread — and which also meant a two-leg order had two places to
     answer "how many", neither of them the order itself. The legs are a
     ratio now (all 1:1, since the chain adds one contract per click) and
     this multiplies the whole thing, the way a ticket does. */
  const [qty, setQty] = useState(1);
  const [tif, setTif] = useState<Tif>(TIFS[0]);
  const [limitPx, setLimitPx] = useState(
    incoming ? +incoming.price.toFixed(2) : 1.75,
  );
  const [limitEditing, setLimitEditing] = useState(false);
  const [limitDraft, setLimitDraft] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const subT = useRef<number | undefined>(undefined);

  /* Mirrors the ticket's legs out, so a chain lighting up the quotes it
     holds is reading the ticket rather than remembering what was clicked
     — removing a leg here unlights it there. */
  useEffect(() => {
    onLegsChange?.(
      legs.map((l) => ({
        strike: l.strike,
        kind: l.kind,
        side: l.side,
        expiry: l.date,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legs]);

  /* A quote picked off the chain. Keyed on `nonce` rather than on the
     quote's values — clicking the same ask twice is two separate acts,
     and the second must still land. */
  useEffect(() => {
    if (!incoming) return;
    /* Already in `legs` — see `seededNonce`. */
    if (seededNonce.current === incoming.nonce) {
      seededNonce.current = undefined;
      return;
    }
    const { strike, kind, action, expiry, mode } = incoming;

    if (mode === "remove") {
      /* The last leg takes the ticket with it.

         A ticket holds at least one leg, so this used to refuse — and
         refusing left the quote lit in the chain, which made its cell a
         dead target: every further click on it asked to remove the same
         leg and was refused again. Dismissing instead means the click
         always does something, and the loop closes: picking that quote
         again opens a fresh ticket on it. */
      if (legs.length <= 1) {
        onClose?.();
        return;
      }
      setLegs((cur) =>
        cur.length <= 1
          ? cur
          : cur.filter(
              (l) =>
                !(
                  l.strike === strike &&
                  l.kind === kind &&
                  l.side === action &&
                  l.date === expiry
                ),
            ),
      );
    } else {
      /* Built HERE, not inside the updater below.

         A state updater has to be pure — React is free to run it more
         than once — and `legFrom` mints an id from a module counter, so
         a replayed updater would hand back a leg with a different
         identity than the one the last run produced. The same rule the
         instrument switch learned the hard way. */
      const leg = legFrom(incoming, S, n);
      if (mode === "add") {
        setLegs((cur) => (cur.length >= MAX_LEGS ? cur : [...cur, leg]));
      } else {
        setLegs([leg]);
      }
    }

    /* No acknowledgement flash. The leg animating into the stack is the
       feedback — a pulse across the whole card on top of it said the same
       thing twice, and louder than the thing that actually changed. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming?.nonce]);

  /* ---- what the order costs, live ---- */

  /* The last price each leg printed at, by leg id.

     Held apart from `legs` on purpose: a leg's identity is the contract
     and the side, and those do not change when its quote does. Folding
     the price back into the leg would hand every consumer of
     `onLegsChange` a new set of legs twice a second for a change none of
     them care about. */
  const [marks, setMarks] = useState<Record<number, number>>({});

  /* One tick of the clock: the legs that print this beat catch up to the
     model, the rest hold what they last showed. */
  useEffect(() => {
    setMarks((cur) => {
      let next: Record<number, number> | null = null;
      for (const l of legs) {
        if (!printsOn(l, n)) continue;
        const v = +legPrice(l, S, n).toFixed(2);
        if ((cur[l.id] ?? l.price) === v) continue;
        next ??= { ...cur };
        next[l.id] = v;
      }
      return next ?? cur;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  /* What a leg is showing right now: its last print, or the price it was
     picked at if it has not printed yet. */
  const shown = (l: Leg) => marks[l.id] ?? l.price;

  /* Positive = money leaves: you are paying to open. */
  let net = 0;
  for (const l of legs) net += (l.side === "buy" ? 1 : -1) * shown(l);

  /* The order's mark, and a spread around it.

     Half a cent per dollar of premium, floored at a cent, rounded to the
     cent — so a $3.00 mark quotes 2.98 / 3.00 / 3.02. Wide enough to read
     as a spread, tight enough to stay plausible on a liquid name. */
  const mid = Math.abs(net);
  const halfSpread = Math.max(0.01, Math.round(mid * 0.5) / 100);
  const debit = net >= 0;

  /* A new set of legs is a new order, and its price is what that order
     marks at — not the number left over from the last set. Keyed on the
     legs themselves rather than on the tick, so a price you have typed
     stands until you change the order it is written on. */
  const legSig = legs.map((l) => `${l.side}${l.kind}${l.strike}${l.date}`).join("|");
  const midRef = useRef(mid);
  midRef.current = mid;
  useEffect(() => {
    setLimitPx(+midRef.current.toFixed(2));
  }, [legSig]);

  /* A ticket nobody has picked into or typed into quotes the mark, on
     every tick.

     The effect above alone was not enough for the leg the ticket opens
     with: its legs never change, so the price it derived on mount stood
     for the life of the ticket — and on mount the chain has not yet
     pushed its underlying, so that price was the default leg marked
     against pxHub's own $194 rather than against the $174 the chain is
     showing. The ticket opened quoting $19.84 over a mark of $2.97.

     It stops the moment the ticket becomes somebody's: a quote picked off
     the chain, or a price typed or stepped here. */
  const limitEdited = useRef(false);
  useEffect(() => {
    if (incoming || limitEdited.current) return;
    setLimitPx(+mid.toFixed(2));
  }, [incoming, mid]);

  /* What the strategy is worth at expiry, priced at the LIMIT — these
     three describe the order in the fields above them, not the market. */
  const signedLimit = debit ? limitPx : -limitPx;
  const profile = payoffProfile(legs, signedLimit, CONTRACT_MULTIPLIER);
  const scale = (v: number | null) => (v === null ? null : v * qty);
  const maxProfit = scale(profile.maxProfit);
  const maxLoss = scale(profile.maxLoss);
  /* The lowest breakeven only.

     A vertical, a long call, a covered call — everything this ticket is
     realistically used to build — has exactly one, and that is what the
     column is sized for. A butterfly genuinely has two; this shows the
     near one, and the other is in `profile.breakevens` if the column ever
     earns the room. */
  const breakevenText = profile.breakevens.length
    ? `$${profile.breakevens[0].toFixed(2)}`
    : "—";

  /* What the order actually costs. Quotes are per share; a contract is
     100 of them, and the figure a reader compares against their buying
     power is the price they are offering, not the market's mark. */
  const estCost = limitPx * CONTRACT_MULTIPLIER * qty;

  function removeLeg(id: number) {
    // Never drop below one leg — there's no empty state for this widget.
    if (legs.length <= 1) return;
    setLegs((cur) => cur.filter((l) => l.id !== id));
  }

  function bumpQty(delta: number) {
    setQty((q) => Math.min(99, Math.max(1, q + delta)));
  }

  function submit() {
    if (submitted) return;
    setSubmitted(true);
    window.clearTimeout(subT.current);
    subT.current = window.setTimeout(() => setSubmitted(false), 1900);
  }

  function bumpLimit(delta: number) {
    limitEdited.current = true;
    setLimitPx((v) => Math.min(999.99, Math.max(0.01, +(v + delta).toFixed(2))));
  }
  function startEditingLimit() {
    setLimitDraft(limitPx.toFixed(2));
    setLimitEditing(true);
  }
  function commitLimit(text: string) {
    setLimitEditing(false);
    limitEdited.current = true;
    const parsed = parseFloat(text);
    if (Number.isFinite(parsed)) {
      setLimitPx(Math.min(999.99, Math.max(0, +parsed.toFixed(2))));
    }
  }

  /* The underlying this ticket is written on — the chain's, beside a
     chain; its own otherwise. */
  const sym = underlying ? underlying.symbol : SYMBOL;

  /* The title IS the order. Nothing else.

     It used to open "Order entry:", which tells you what you are looking
     at — and you are looking at it, beside a card titled "Options chain",
     with a Submit button at the bottom. Every character of that prefix
     was spent before the line said anything, and it was the half that got
     cut when the card narrowed.

     One leg is the contract itself; more than one has no single name — a
     vertical, a straddle and a butterfly are all "PLTR calls and puts" —
     so it says what it honestly is, in the reference's own words: an
     n-leg custom strategy on that symbol. */
  const title =
    legs.length > 1
      ? `${sym} ${legs.length}-Leg Custom`
      : `${sym} ${strikeLabel(legs[0].strike)} ${
          legs[0].kind === "put" ? "Put" : "Call"
        }`;

  return (
    <div className="ob-stage">
      <LayoutGroup>
        <WidgetShell
          title={title}
          className="ob-shell"
          onClose={onClose}
          onGrip={onGrip}
        >
        <div className="ob-card">
          {/* ---- legs ----
              A manifest: what is on the order, what each contract costs,
              and the one act left on this side of the page — taking one
              back off. Everything that WAS editable here is decided in
              the chain, by which price you click. */}
          <div className="ob-legs-panel">
          <AutoHeight className="ob-legs" transition={sizeSpring} enabled={!reduce}>
            {/* popLayout, not the default.

                On a replace — a quote picked off a chain swapping the leg
                out — the outgoing row and the incoming one were both in
                flow for the length of the exit, so the stack grew to two
                rows and shrank back. popLayout takes the leaver out of the
                layout the moment it starts to go, so the height only ever
                holds one row's worth. */}
            <AnimatePresence initial={false} mode="popLayout">
              {legs.map((l) => (
                <motion.div
                  key={l.id}
                  className="ob-leg"
                  /* No `layout`. The row holds still: the container's
                     height carries the movement, and a row that also
                     animated its own position would be the same change
                     told twice. It is also what kept re-measuring rows
                     mid-flight and putting a small bounce in the leg
                     line. */
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  /* The exit carries its own transition rather than
                     taking the element's: entering is a reveal and
                     leaving is a retreat, and they are not the same
                     length. */
                  exit={
                    reduce
                      ? { opacity: 0 }
                      : {
                          opacity: 0,
                          y: 10,
                          filter: "blur(4px)",
                          transition: exitTransition,
                        }
                  }
                  transition={enterTransition}
                >
                  <span className="ob-leg-main">
                    {/* The action leads.

                        It is the only word on the line that changes what
                        the order DOES, and it is the one the eye should
                        land on first when four legs are stacked — a
                        column of Buys and Sells reads as a strategy,
                        where a column of dates reads as a list of dates.

                        "Buy to open", not "Buy": on an options ticket the
                        other half of that sentence is a real alternative
                        (to close), and the chain's own colour convention
                        carries which one it is. */}
                    <span
                      className="ob-leg-act"
                      style={{ color: l.side === "buy" ? UP : DOWN }}
                    >
                      {l.side === "buy" ? "Buy to open" : "Sell to open"}
                    </span>
                    <span className="ob-leg-name">
                      {ticketExpiry(l.date)} {strikeLabel(l.strike)}{" "}
                      {l.kind === "put" ? "Put" : "Call"}
                    </span>
                  </span>

                  {/* Unsigned. It was negative for a bought leg and
                      positive for a sold one, which is the way the money
                      moves — but the line already opens with "Buy to
                      open" in green or "Sell to open" in coral, so the
                      minus was a third telling of the same fact and made
                      a column of ordinary prices read as a column of
                      losses.

                      Fixed box, so a tick that gains a digit cannot shift
                      the X beside it. */}
                  <span className="ob-leg-px">{money(shown(l))}</span>

                  {/* Always rendered, disabled on a one-leg ticket. It used
                      to be omitted entirely, which meant the row's last
                      column appeared and disappeared as legs came and
                      went — the ticket has to keep one leg, and a control
                      that is present but unavailable says so, where a
                      missing one just looks like a different layout. */}
                  <motion.button
                    type="button"
                    className="ob-x"
                    aria-label={`Remove ${strikeLabel(l.strike)} ${l.kind}`}
                    disabled={legs.length <= 1}
                    title={
                      legs.length <= 1 ? "A ticket needs at least one leg" : undefined
                    }
                    onClick={() => removeLeg(l.id)}
                    /* The same 0.97 the CTA, the title-bar icons and the
                       glass button set all take on press. */
                    whileTap={reduce || legs.length <= 1 ? undefined : { scale: 0.97 }}
                    transition={spring}
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                      <path
                        d="M1 1l6 6M7 1L1 7"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </motion.button>
                </motion.div>
              ))}
            </AnimatePresence>
          </AutoHeight>
          </div>

          {/* ---- what you set ----
              Three lines, in the order a ticket is filled: how many, at
              what price, for how long. Each is a label and one control on
              a shared right edge, rather than a row of chips — there is
              no longer anything here that has to sit beside anything
              else, and a list of questions reads faster than a grid. */}
          <div className="ob-params-panel">
            <div className="ob-params">
              <div className="ob-line">
                <span className="ob-line-k">
                  <span className="ob-line-label">Quantity</span>
                </span>
                <StepperField
                  ariaLabel="Quantity"
                  value={String(qty)}
                  reduce={reduce}
                  spring={spring}
                  onChange={(raw) => {
                    const v = parseInt(raw.replace(/\D/g, ""), 10);
                    setQty(Number.isFinite(v) ? Math.min(99, Math.max(1, v)) : 1);
                  }}
                  onStep={bumpQty}
                />
              </div>

              <div className="ob-line">
                <span className="ob-line-k">
                  {/* The word carries the sign, so the field itself holds
                      a plain positive number — you do not type a minus to
                      take in a credit. */}
                  <span className="ob-line-label">
                    Limit price ({debit ? "debit" : "credit"})
                  </span>
                </span>

                {/* The field and what the market says about it, in one
                    column. The quote used to hang under the LABEL, on the
                    far side of the row from the number it is about — so
                    the two figures you compare, the one you are offering
                    and the one you could have, sat 130px apart. Under the
                    field they are one reading. */}
                <span className="ob-line-ctl">
                <div className="ob-field ob-stepper">
                  {limitEditing ? (
                    <span className="ob-stepper-num ob-stepper-num--editing">
                      {/* The unit, outside the editable text. It is not
                          something you type or delete — the field holds a
                          price, and it says so whether or not there is a
                          number in it yet. */}
                      <span className="ob-unit">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label="Limit price"
                        /* An <input> with no `size` carries a default
                           intrinsic width of ~20 characters, which fed
                           straight into the card's max-content pass and
                           jumped the widget wider the moment this field
                           was clicked into. */
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
                      onClick={startEditingLimit}
                      aria-label="Edit limit price"
                    >
                      <span className="ob-unit">$</span>
                      {limitPx.toFixed(2)}
                    </button>
                  )}
                  {/* Invisible padding + matching negative margin — a
                      bigger hit target than the visible square without
                      growing the field's own layout. */}
                  <div className="ob-stepper-hit" onClick={(e) => e.stopPropagation()}>
                    <div className="ob-stepper-btns">
                      {([1, -1] as const).map((d) => (
                        <motion.button
                          key={d}
                          type="button"
                          aria-label={`${d > 0 ? "Increase" : "Decrease"} limit price`}
                          onClick={() => bumpLimit(d * 0.01)}
                          whileHover={reduce ? undefined : { background: "rgba(72,213,151,0.12)" }}
                          whileTap={reduce ? undefined : { scale: 0.82 }}
                          transition={spring}
                        >
                          <Caret dir={d > 0 ? "up" : "down"} />
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* "Mid", not "Mark": the number between the bid and the
                    ask, and the field above it is the third price in that
                    set — so the line names all three in the same terms.

                    Every figure sits in a box of its own (see the CSS):
                    these two are the only things on the ticket that move
                    on the clock, and a figure that resizes as it ticks
                    drags whatever follows it sideways. */}
                <span className="ob-line-sub">
                  <span className="ob-sub">
                    <span className="ob-sub-k">Mid</span>
                    <span className="ob-sub-v">{money(mid)}</span>
                  </span>
                  <span className="ob-sub">
                    <span className="ob-sub-k">{debit ? "Ask" : "Bid"}</span>
                    <span className="ob-sub-v">
                      {money(debit ? mid + halfSpread : mid - halfSpread)}
                    </span>
                  </span>
                </span>
                </span>
              </div>

              <div className="ob-line">
                <span className="ob-line-k">
                  <span className="ob-line-label">Duration</span>
                </span>
                <Dropdown
                  className="ob-field ob-field--switch"
                  ariaLabel="Duration"
                  value={tif}
                  options={TIFS}
                  onSelect={setTif}
                />
              </div>
            </div>
          </div>

          {/* ---- what it is worth ----
              Its own surface, because these are not fields: they are what
              the order above them comes to, and all three move when any
              one of the fields does. */}
          <div className="ob-payoff">
            <Payoff
              k="Max profit"
              v={maxProfit === null ? "Unlimited" : signedMoney(maxProfit)}
            />
            <Payoff
              k="Max loss"
              v={maxLoss === null ? "Unlimited" : signedMoney(maxLoss)}
            />
            <Payoff k="Breakeven" v={breakevenText} />
          </div>

          {/* ---- what it costs, and the button that commits to it ----

              One line. The cost used to have a band of its own above this
              one, with the account's buying power under it — three lines
              to say what the order comes to and one button to send it.
              What the ticket costs belongs beside the thing that spends
              it, and the buying power was a number nobody set, could
              change, or would check here.

              There is no Cancel either: the title bar's X already
              dismisses the ticket, and two ways to back out of a card
              this small is one more than it needs. */}
          <div className="ob-foot">
            <span className="ob-cost">
              <span className="ob-cost-k">
                Estimated {debit ? "cost" : "credit"}
              </span>
              <span className="ob-cost-v">{money(estCost)}</span>
            </span>

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
                    "Submit"
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
function AutoHeight({
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
    const ro = new ResizeObserver(() => setH(el.offsetHeight));
    ro.observe(el);
    setH(el.offsetHeight);
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

/** The leg a ticket opens with when nothing has been picked: the chain's
    front expiry, at the chain's own at-the-money strike.

    Both come from the chain rather than from this widget's clock. The
    strike used to be rounded off pxHub's $194 base, which put a $195 call
    on a ticket sitting beside a ladder that runs $120-$230 around $175 —
    a default leg quoting a contract the chain next to it is not even
    showing. It is a placeholder either way; it should at least be a row
    you can see. */
function defaultLeg(S: number, n: number): Leg {
  const strike = Math.round(CHAIN_UNDERLYING.last / 5) * 5;
  const base = legMark({ kind: "call", strike }, S, n);
  return mk("buy", "call", strike, CHAIN_EXPIRIES[0].date, base, base);
}

/** A leg from a quote picked off the chain: priced at exactly the pill
    that was clicked, and anchored so it drifts from there. */
function legFrom(q: IncomingQuote, S: number, n: number): Leg {
  return mk(
    q.action,
    q.kind,
    q.strike,
    q.expiry,
    q.price,
    legMark({ kind: q.kind, strike: q.strike }, S, n),
  );
}

/** One reading of what the order comes to: its name above, its figure
    below, in a column of its own. */
function Payoff({ k, v }: { k: string; v: string }) {
  return (
    <span className="ob-payoff-cell">
      <span className="ob-payoff-k">{k}</span>
      <span className="ob-payoff-v">{v}</span>
    </span>
  );
}

/* Solid triangle, up or down — the stepper's affordance in the reference
   asset. Measured off it: 22 x 11 at a 4x export is 5.5 x 2.75, so the
   shape is 2:1 and drawn on an 8 x 4 grid at 6 x 3. Filled, not stroked —
   the export shows a solid wedge, not a chevron. */
function Caret({ dir }: { dir: "up" | "down" }) {
  return (
    <svg width="6" height="3" viewBox="0 0 8 4" aria-hidden="true">
      <path d={dir === "up" ? "M4 0 8 4H0z" : "M4 4 0 0h8z"} fill="currentColor" />
    </svg>
  );
}

/**
 * A value and a caret stepper — the field shape the limit price takes,
 * with its label lifted out onto the row beside it.
 */
function StepperField({
  value,
  onChange,
  onStep,
  ariaLabel,
  reduce,
  spring,
}: {
  value: string;
  onChange: (raw: string) => void;
  onStep: (delta: number) => void;
  ariaLabel: string;
  reduce: boolean | null;
  spring: Transition;
}) {
  return (
    <label className="ob-field ob-stepper">
      <input
        type="text"
        inputMode="numeric"
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
              whileHover={reduce ? undefined : { background: "rgba(72,213,151,0.12)" }}
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

      {/* Portalled to <body>, not left in place.

          The menu is `position: fixed` at coordinates read off the
          trigger's viewport rect. That only holds while no ancestor is
          transformed — and this ticket can be dragged, which puts a
          transform on a wrapper above it and turns `fixed` into
          `absolute` against that wrapper. The menu would then be offset
          by exactly however far the card had been moved. Out at the body
          there is no such ancestor and the viewport coordinates mean what
          they say. */}
      {portal(
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
      </AnimatePresence>,
      )}
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
function portal(node: ReactNode): ReactNode {
  return typeof document === "undefined" ? null : createPortal(node, document.body);
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
