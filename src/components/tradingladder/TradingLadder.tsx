import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Rolling } from "../shared/RollingNumber";
import { Check } from "../shared/TicketControls";
import { Menu, MenuItem } from "../optionchain/ui";
import { DURATION, EASING, LADDER_SPRING, SEG_SPRING } from "../optionchain/motion";
import { OrderBar } from "./OrderBar";
import "./trading-ladder.css";

/* ------------------------------------------------------------------
   Universal trading ladder.

   Layout after the reference ladder the user pasted (2026-11-04): a
   header that reads P&L on the left and position / open orders / Flatten
   on the right, a trade row of Buy market · quantity · Sell market, the
   ladder, and a footer that switches the price column between price and
   P&L and zooms the row density.

   Visual layer: Robinhood's, entirely (user, 2026-11-04 — "for this
   scenario follow entirely robinhood's UI"). Flat near-black ground, no
   card chrome, 13px bold figures, solid depth bars flush to the price
   column with the size outside them, a −/+ stepper. This piece does NOT
   use the house widget shell, ticker pill or ticket stepper — on purpose.
   Their typeface is licensed, so Inter stands in. Their name and logo
   are not used anywhere.

   Behaviour, data and motion are unchanged from the house build: the
   chain's clock and springs, the odometer, the anchored ladder.

   Anchored, like the chain: the rows are fixed prices and the market
   walks through them, so the level under the cursor never moves between
   hover and click.
------------------------------------------------------------------ */

/* An equity ladder: penny ticks, P&L per share. Sizes on the book are
   shares; quantities are shares. */
const SYMBOL = "HOOD";
const TICK = 0.01;
/** Shares: $1 a point, a cent a tick per share. */
const MULT = 1;
/** The chain's clock — pxHub's own step. */
const TICK_MS = 2200;

/** The level the ladder is centred on; the walk stays either side of it. */
const CENTRE = 118.45;
/** The ladder's window is a fixed height; the book scrolls inside it and
    zoom trades rows for room. */
const VIEW_H = 448;
/** Levels each side of CENTRE. Deep enough to scroll well past the
    walk's range either way. */
const DEPTH = 40;
/** Sizes thicken for this many ticks off the touch, then level off, so
    the whole book shares one scale and the far levels still vary. */
const SCALE_TICKS = 12;
/** 28 is the reference's row pitch; zoom steps either side of it. */
const DENSITY = [24, 28, 32] as const;

/* Best bid, in ticks off 118.44, one entry per clock tick. Inside the
   middle of the ladder at every zoom, so the seeded orders below never
   fill on their own. */
const WALK = [0, 1, 1, 0, -1, -1, -2, -1, 0, 0, 1, 0];
const BASE_BID = 118.44;
/** Yesterday's close, for the quote bar's change. */
const PREV_CLOSE = 116.92;
/** A market order shows on the ladder for at least this long before it
    fills, so it can be seen — and cancelled — like any other order. */
const MKT_MIN_MS = 800;

type Side = "buy" | "sell";
/** MKT is a market order still pending — it rests on the touch until it
    fills on the next clock step (at least MKT_MIN_MS after it was sent). */
type Kind = "LMT" | "STP" | "MKT";
/** `at` is when it was submitted, for the open-orders panel. */
type Order = {
  id: number;
  side: Side;
  kind: Kind;
  price: number;
  qty: number;
  at: number;
  /** Bracket: the entry and its two legs share a group. */
  group?: number;
  /** tp = take profit (a limit), sl = stop loss (a stop). */
  leg?: "tp" | "sl";
  /** A leg waits, inactive, until its entry fills. */
  held?: boolean;
};
type Leg = "tp" | "sl";
/** Ticks either side of the entry a new bracket's legs start at. */
const BRACKET_TICKS = 10;
/** `qty` set means a fixed size — the position line's close, which is
    always the whole position whatever the stepper says. */
type Draft = { side: Side; price: number; qty?: number; bracket?: { tp: number; sl: number } };
const opp = (s: Side): Side => (s === "buy" ? "sell" : "buy");
type Position = { qty: number; avg: number; realized: number };
type View = "price" | "pnl";

/* ---------- formatting ---------- */

const fmtPx = (p: number) =>
  p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const money = (v: number) =>
  `$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const moneyShort = (v: number) => {
  const a = Math.abs(v);
  if (a < 10_000) return money(v);
  if (a < 1_000_000) return `$${(Math.floor(a / 100) / 10).toFixed(1)}K`;
  return `$${(Math.floor(a / 100_000) / 10).toFixed(1)}M`;
};

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const KIND_NAME: Record<Kind, string> = { LMT: "Limit", STP: "Stop", MKT: "Market" };

const fmtUsd = (v: number) => `${v > 0.004 ? "+" : v < -0.004 ? "−" : ""}${money(v)}`;

const dirOf = (v: number) => (v > 0.004 ? "up" : v < -0.004 ? "down" : "flat");

/* ---------- the book ---------- */

function hash(n: number) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967295;
}

/** Deeper is thicker out to SCALE_TICKS, then levels off so the far
    book still varies; it breathes each tick rather than re-rolling. */
function sizeAt(price: number, distance: number, tick: number) {
  const k = Math.round(price / TICK);
  const base = 9 + Math.min(distance, SCALE_TICKS) * 4 + Math.floor(hash(k) * 24);
  const drift = Math.round((hash(k * 31 + tick) - 0.5) * 8);
  /* Shares, in round lots — equity L2 sizes run to the thousands. One
     level in ~16 is a resting wall several times the rest, so the book
     has the outliers a real one does. */
  const wall = hash(k * 7 + 3) < 0.06 ? 6 + Math.floor(hash(k * 13) * 6) : 1;
  return Math.max(1, base + drift) * 100 * wall;
}

/** Book sizes in at most four characters, so any figure fits its fixed
    column: 950 · 2.7K · 12K · 1.2M (the platform shows "1K"). The exact
    count rides the cell's title and label. */
function fmtSize(n: number) {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(Math.floor(n / 100) / 10).toFixed(n % 1000 < 100 ? 0 : 1)}K`;
  if (n < 1_000_000) return `${Math.floor(n / 1000)}K`;
  if (n < 10_000_000) return `${(Math.floor(n / 100_000) / 10).toFixed(n % 1_000_000 < 100_000 ? 0 : 1)}M`;
  return `${Math.floor(n / 1_000_000)}M`;
}

/** The bar scale: the 90th-percentile level, not the single largest, so
    one wall can't flatten every other bar. Anything above it fills its
    track (the bar is capped at 100%) and its figure tells the rest. */
function scaleOf(sizes: number[]) {
  const s = sizes.filter((n) => n > 0).sort((a, b) => a - b);
  if (!s.length) return 1;
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.9))];
}

function market(tick: number) {
  const m = WALK[tick % WALK.length];
  const prev = WALK[(tick - 1 + WALK.length) % WALK.length];
  const bid = +(BASE_BID + m * TICK).toFixed(2);
  const ask = +(bid + TICK).toFixed(2);
  const last = m > prev ? ask : m < prev ? bid : tick % 2 ? ask : bid;
  return { bid, ask, last };
}

const TOP = CENTRE + DEPTH * TICK;
const LEVELS = Array.from({ length: DEPTH * 2 + 1 }, (_, i) => +(TOP - i * TICK).toFixed(2));

/** What an order at this level and side would be, given the market now.
    Through the market it is a stop; on our side of it, a limit. */
function kindFor(d: Draft, bid: number, ask: number): Kind {
  return d.side === "buy" ? (d.price > ask ? "STP" : "LMT") : d.price < bid ? "STP" : "LMT";
}

/** The column an order's tag sits in: its own side — except a bracket
    leg on a working order, which sits with that order (a stop on a sell
    stop is a buy, but it belongs beside the sell). */
function colOf(o: Order, os: Order[]): Side {
  if (!o.leg) return o.side;
  const e = os.find((x) => x.group === o.group && !x.leg);
  return e ? e.side : o.side;
}

/** After fills: drop what filled; an entry that filled wakes its legs;
    a leg that filled cancels its sibling (one-cancels-other). */
function settleBrackets(os: Order[], filled: Order[]) {
  const gone = new Set(filled.map((o) => o.id));
  const woke = new Set(filled.filter((o) => o.group != null && !o.leg).map((o) => o.group));
  const done = new Set(filled.filter((o) => o.leg).map((o) => o.group));
  return os
    .filter((o) => !gone.has(o.id) && !(o.leg && done.has(o.group)))
    .map((o) => (o.held && woke.has(o.group) ? { ...o, held: false } : o));
}

/* ---------- component ---------- */

/* ---------- quantity placement variants ----------
   The quantity sizes every order the ladder sends — market, limit and
   stop alike (user, 2026-11-05). Two ways to say so, both the shared
   OrderBar, neither adding height:
     lead  Qty first   the field leads the row — Qty · Buy · Sell — with
                       no label; order alone says "size, then act"
     tip   Tooltip     the reference's Buy · Qty · Sell, and a tooltip on
                       the field says what it governs */
export type QtyVariant = "lead" | "tip";
export const QTY_VARIANTS: { id: QtyVariant; name: string; note: string }[] = [
  { id: "lead", name: "Qty first", note: "The field leads the row, no label" },
  { id: "tip", name: "Qty last", note: "Buy · Sell · Qty — hover the quantity" },
];
export const QTY_HINT = "Applies to all order types placed within this widget";

/* ---------- market session study (user, 2026-11-05) ----------
   Equity market orders only fill in regular hours, so after hours the
   same widget refuses some actions. "current" reproduces the platform:
   nothing says the session changed, market buttons look live but do
   nothing, Flatten greys out behind ⊘ and only a hover explains it.
   "proposed" makes the state visible and keeps every action useful:
     - market buttons wear a distinct off state, and a click or tap
       (not just hover) says when they open and what works now
     - Flatten never dead-ends: it cancels the orders and closes the
       position with a limit at the touch, and says so */
export type Session = "regular" | "after";
export type Treatment = "current" | "proposed";
const OPENS = "9:30 AM ET";
const CURRENT_CLOSED_COPY = `Equities market orders can’t be filled outside of regular market hours. The market opens again today at ${OPENS}.`;
const PROPOSED_BLOCKED_COPY = `Market orders open at ${OPENS}. You can trade now with a limit — click a price on the ladder.`;

export function TradingLadder({
  onClose,
  variant = "lead",
  qty: qtyProp,
  onQty,
  session = "regular",
  treatment = "proposed",
  summary = "pills",
  width,
  stress = false,
  seed = "all",
}: {
  /** Which header state to open in: everything, nothing, orders with no
      position, or a position with no orders. */
  seed?: "all" | "empty" | "orders" | "position" | "orderBracket" | "posBracket";
  /** Fixed widget width for review (the platform's widget resizes);
      omitted, the reference's 534. */
  width?: number;
  /** Seed long figures — a big position, big orders — to stress layout. */
  stress?: boolean;
  /** How the header states position and orders: two text lines (the
      platform's), or pills — one per thing that exists. */
  summary?: "text" | "pills" | "icons" | "morph";
  session?: Session;
  treatment?: Treatment;
  onClose?: () => void;
  variant?: QtyVariant;
  /** Controlled quantity — a host that shares one size across surfaces
      (the ladder and the chart) passes it in. */
  qty?: number;
  onQty?: (n: number) => void;
}) {
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);
  const [ownQty, setOwnQty] = useState(10);
  const qty = qtyProp ?? ownQty;
  const setQty = onQty ?? setOwnQty;
  const [view, setView] = useState<View>("price");
  const [zoom, setZoom] = useState(1);
  /** One-click trading: a click on a level sends, with no staging step. */
  const [quick, setQuick] = useState(false);
  /* On by default (user, 2026-11-05): label the size columns. Still
     switchable from ⋮ → Column headers. */
  const [headers, setHeaders] = useState(false);
  const rowH = DENSITY[zoom];

  const [orders, setOrders] = useState<Order[]>(() =>
    seed === "orderBracket"
      ? /* A working buy with its bracket held — before the fill. */
        [
          { id: 1, side: "buy", kind: "LMT", price: 118.41, qty: 10, at: Date.now() - 4 * 60e3, group: 1 },
          { id: 2, side: "sell", kind: "LMT", price: 118.47, qty: 10, at: Date.now() - 4 * 60e3, group: 1, leg: "tp", held: true },
          { id: 3, side: "sell", kind: "STP", price: 118.37, qty: 10, at: Date.now() - 4 * 60e3, group: 1, leg: "sl", held: true },
        ]
      : seed === "posBracket"
        ? /* Filled: the position, its bracket live — after the fill. */
          [
            { id: 2, side: "sell", kind: "LMT", price: 118.47, qty: 50, at: Date.now() - 2 * 60e3, group: 1, leg: "tp" },
            { id: 3, side: "sell", kind: "STP", price: 118.37, qty: 50, at: Date.now() - 2 * 60e3, group: 1, leg: "sl" },
          ]
        : seed === "empty" || seed === "position"
      ? []
      : seed === "orders"
        ? /* No shares, so nothing to sell: one working buy, as the
             platform's "No position · 1 open order". */
          [{ id: 1, side: "buy", kind: "LMT", price: 118.41, qty: 10, at: Date.now() - 14 * 60e3 - 21e3 }]
        : stress
      ? [
          { id: 1, side: "buy", kind: "LMT", price: 118.41, qty: 999, at: Date.now() - 14 * 60e3 - 21e3 },
          { id: 2, side: "sell", kind: "LMT", price: 118.49, qty: 999, at: Date.now() - 3 * 60e3 - 48e3 },
          { id: 3, side: "sell", kind: "STP", price: 118.38, qty: 250, at: Date.now() - 60e3 },
        ]
      : [
          { id: 1, side: "buy", kind: "LMT", price: 118.41, qty: 10, at: Date.now() - 14 * 60e3 - 21e3 },
          { id: 2, side: "sell", kind: "LMT", price: 118.49, qty: 10, at: Date.now() - 3 * 60e3 - 48e3 },
        ],
  );
  const [pos, setPos] = useState<Position>(() =>
    seed === "empty" || seed === "orders" || seed === "orderBracket"
      ? { qty: 0, avg: 0, realized: 0 }
      : /* The filled bracket's legs sell 50 out of a long — the stress
           book's short would leave them on the wrong side. */
        stress && seed !== "posBracket"
        ? { qty: -12500, avg: 116.07, realized: -18432.5 }
        : { qty: 50, avg: 118.42, realized: 0 },
  );
  const [hover, setHover] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [fills, setFills] = useState<Record<string, { side: Side; key: number }>>({});

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const { bid, ask, last } = market(tick);

  const book = useMemo(() => {
    const rows = LEVELS.map((p) => ({
      price: p,
      bidSize: p <= bid ? sizeAt(p, Math.round((bid - p) / TICK), tick) : 0,
      askSize: p >= ask ? sizeAt(p, Math.round((p - ask) / TICK), tick) : 0,
    }));
    const max = scaleOf(rows.flatMap((r) => [r.bidSize, r.askSize]));
    return { rows, max };
  }, [bid, ask, tick]);

  /* ---------- scrolling ---------- */

  const scrollRef = useRef<HTMLDivElement>(null);
  /** The price at the window's middle — kept across zooms so a zoom
      grows or shrinks rows about what you were looking at. */
  const centreRef = useRef(CENTRE);
  /** The window's top, for the off-screen order tags. Batched to a frame. */
  const [viewTop, setViewTop] = useState(0);
  const frame = useRef<number | null>(null);
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const i = (el.scrollTop + el.clientHeight / 2) / rowH - 0.5;
    centreRef.current = +(TOP - Math.round(i) * TICK).toFixed(2);
    if (frame.current == null)
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        if (scrollRef.current) setViewTop(scrollRef.current.scrollTop);
      });
  }, [rowH]);
  useEffect(() => () => void (frame.current != null && cancelAnimationFrame(frame.current)), []);
  /** Centre a price in the window. */
  const jumpTo = useCallback(
    (price: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const i = Math.round((TOP - price) / TICK);
      el.scrollTo({ top: i * rowH + rowH / 2 - el.clientHeight / 2, behavior: reduce ? "auto" : "smooth" });
    },
    [rowH, reduce],
  );
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const i = Math.round((TOP - centreRef.current) / TICK);
    /* Snap to whole rows so the window opens with no half row at top. */
    el.scrollTop = (i - Math.floor(el.clientHeight / rowH / 2)) * rowH;
  }, [rowH]);

  /* ---------- trading ---------- */

  /* A pending market order fills ~MKT_MIN_MS after it's sent, not on the
     next 2.2s clock tick: a fast pulse re-runs the fill pass while one
     is pending. */
  const [mktPulse, setMktPulse] = useState(0);
  useEffect(() => {
    if (!orders.some((o) => o.kind === "MKT" && !o.held)) return;
    const id = window.setInterval(() => setMktPulse((n) => n + 1), 150);
    return () => clearInterval(id);
  }, [orders]);

  const applyFill = useCallback((side: Side, price: number, n: number) => {
    setPos((p) => {
      const signed = side === "buy" ? n : -n;
      const next = p.qty + signed;
      if (p.qty === 0 || Math.sign(p.qty) === Math.sign(signed)) {
        const avg = (p.avg * Math.abs(p.qty) + price * n) / Math.abs(next);
        return { qty: next, avg, realized: p.realized };
      }
      const closed = Math.min(n, Math.abs(p.qty));
      const realized = p.realized + (price - p.avg) * closed * Math.sign(p.qty) * MULT;
      if (next === 0) return { qty: 0, avg: 0, realized };
      if (Math.sign(next) !== Math.sign(p.qty)) return { qty: next, avg: price, realized };
      return { qty: next, avg: p.avg, realized };
    });
    setFills((f) => ({ ...f, [price.toFixed(2)]: { side, key: Date.now() + Math.random() } }));
  }, []);

  /** Where an order fills against this market, or null if it rests. */
  const fillPrice = (o: Order, b: number, a: number) => {
    if (o.kind === "MKT") return Date.now() - o.at >= MKT_MIN_MS ? (o.side === "buy" ? a : b) : null;
    if (o.kind === "LMT") return o.side === "buy" ? (a <= o.price ? o.price : null) : b >= o.price ? o.price : null;
    // A stop becomes a market order once touched, and fills at the touch.
    return o.side === "buy" ? (a >= o.price ? a : null) : b <= o.price ? b : null;
  };

  useEffect(() => {
    /* Held legs don't trade until their entry fills. */
    const hit = orders
      .filter((o) => !o.held)
      .map((o) => ({ o, at: fillPrice(o, bid, ask) }))
      .filter((h): h is { o: Order; at: number } => h.at !== null);
    if (!hit.length) return;
    hit.forEach(({ o, at }) => applyFill(o.side, at, o.qty));
    setOrders((os) => settleBrackets(os, hit.map((h) => h.o)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, mktPulse]);

  /* A bracket whose entry was cancelled (not filled) loses its held legs —
     they protect a position that will never exist. */
  useEffect(() => {
    const orphan = orders.some((o) => o.held && !orders.some((e) => e.group === o.group && !e.leg));
    if (orphan) setOrders((os) => os.filter((o) => !(o.held && !os.some((e) => e.group === o.group && !e.leg))));
  }, [orders]);

  /* The position's live legs follow the position: flat (closed by any
     route) or flipped, they go — a stop left on nothing would open a new
     position; shrunk, they shrink with it so a fill can't overshoot. */
  useEffect(() => {
    const ownIn = (os: Order[]) => (o: Order) => !!o.leg && !o.held && !os.some((e) => e.group === o.group && !e.leg);
    const own = ownIn(orders);
    const closing: Side | null = pos.qty > 0 ? "sell" : pos.qty < 0 ? "buy" : null;
    const n = Math.abs(pos.qty);
    const bad = orders.some((o) => own(o) && (o.side !== closing || o.qty > n));
    if (!bad) return;
    setOrders((os) => {
      const mine = ownIn(os);
      return os.filter((o) => !(mine(o) && o.side !== closing)).map((o) => (mine(o) && o.qty > n ? { ...o, qty: n } : o));
    });
  }, [orders, pos.qty]);

  const stage = (d: Draft) => {
    /* Bracket mode: a click sets the leg its side of the position makes. */
    if (pbActive) {
      const leg = legFor(d.price);
      if (leg) sendLeg(leg, d.price);
      return;
    }
    if (quick) return place(d);
    setDraft((cur) => (cur && cur.side === d.side && cur.price === d.price ? null : d));
  };

  const send = () => draft && place(draft);

  const place = (d: Draft) => {
    const id = Date.now();
    const n = d.qty ?? qty;
    const o: Order = { id, side: d.side, price: d.price, kind: kindFor(d, bid, ask), qty: n, at: id };
    const at = fillPrice(o, bid, ask);
    /* Bracket: two exits on the other side — a limit to take profit, a
       stop to cut the loss — held until the entry fills. */
    const legs: Order[] = d.bracket
      ? (["tp", "sl"] as Leg[]).map((leg, i) => ({
          id: id + 1 + i,
          side: opp(d.side),
          kind: leg === "tp" ? "LMT" : "STP",
          price: d.bracket![leg],
          qty: n,
          at: id,
          group: id,
          leg,
          held: at === null,
        }))
      : [];
    if (at !== null) {
      applyFill(o.side, at, o.qty);
      if (legs.length) setOrders((os) => [...os, ...legs]);
    } else setOrders((os) => [...os, d.bracket ? { ...o, group: id } : o, ...legs]);
    setDraft(null);
    setHover(null);
  };

  /* ---------- bracket draft ---------- */
  const legDefaults = (d: Draft, ticks = BRACKET_TICKS) => {
    const dir = d.side === "buy" ? 1 : -1;
    const clamp = (p: number) => Math.min(LEVELS[0], Math.max(LEVELS[LEVELS.length - 1], +p.toFixed(2)));
    return { tp: clamp(d.price + dir * ticks * TICK), sl: clamp(d.price - dir * ticks * TICK) };
  };
  const toggleBracket = () =>
    setDraft((d) => (d ? (d.bracket ? { ...d, bracket: undefined } : { ...d, bracket: legDefaults(d) }) : d));
  /* Position bracket (user, 2026-11-05): TP/SL drafted around the
     position's average from its tag, sized to the whole position. */
  /* Bracket mode on the position: legs start empty — you click the prices,
     and each click becomes a leg connected to the position. */
  /** Bracket mode: on the position, or on a working order (its id). */
  const [pb, setPb] = useState<{ on: "pos" | number; tp?: number; sl?: number; only?: Leg; group?: number } | null>(null);
  /* A placed bracket draws quietly — just its TP / SL tags. Its rail and
     ratio show when it's active: hovered (a leg or the position line) or
     selected (a leg clicked; a press elsewhere or Esc clears it). */
  const [railHot, setRailHot] = useState<number | null>(null);
  /** A placed leg dragged to a new price waits here for confirmation —
      its pill at the new row, like a staged order. */
  const [legMove, setLegMove] = useState<{ side: Side; kind: Kind; leg: Leg; group: number; from: number; to: number } | null>(null);
  useEffect(() => {
    if (!legMove) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setLegMove(null);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [legMove]);
  /* A leg that has gone (filled, cancelled) can't be moved. */
  useEffect(() => {
    if (legMove && !orders.some((o) => o.group === legMove.group && o.leg === legMove.leg)) setLegMove(null);
  }, [orders, legMove]);
  const commitLegMove = () => {
    if (!legMove) return;
    const m = legMove;
    setOrders((os) =>
      os.map((o) =>
        o.group === m.group && o.leg === m.leg
          ? { ...o, price: m.to, kind: kindFor({ side: o.side, price: m.to }, bid, ask), at: Date.now() }
          : o,
      ),
    );
    setLegMove(null);
  };
  const [railSel, setRailSel] = useState<number | null>(null);
  useEffect(() => {
    if (railSel == null) return;
    const down = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest?.(".tl-tag[data-leg]")) setRailSel(null);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setRailSel(null);
    window.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", key);
    };
  }, [railSel]);
  useEffect(() => {
    /* Its subject gone — position flat, order filled or cancelled — the
       mode ends. */
    if (pb && (pb.on === "pos" ? !pos.qty : !orders.some((o) => o.id === pb.on))) setPb(null);
  }, [pos.qty, orders, pb]);
  /** The bracket being drafted — an entry's or the position's. */
  const bk = draft?.bracket
    ? { from: "entry" as const, side: draft.side, entry: draft.price, qty: draft.qty ?? qty, ...draft.bracket }
    : pb && pb.on === "pos" && pos.qty
      ? { from: "pos" as const, side: (pos.qty > 0 ? "buy" : "sell") as Side, entry: pos.avg, qty: Math.abs(pos.qty), tp: pb.tp, sl: pb.sl }
      : pb && pb.on !== "pos"
        ? (() => {
            const o = orders.find((x) => x.id === pb.on);
            return o ? { from: "order" as const, side: o.side, entry: o.price, qty: o.qty, tp: pb.tp, sl: pb.sl, id: o.id } : null;
          })()
        : null;
  const togglePosBracket = () =>
    setPb((cur) => {
      if (cur?.on === "pos" || !pos.qty) return null;
      setDraft(null);
      return { on: "pos" };
    });
  /** From the position's menu: Set stop (SL only), Set limit (TP only),
      Set TP/SL (both). */
  const startPosExit = (only?: Leg) => {
    if (!pos.qty) return;
    setDraft(null);
    setPb({ on: "pos", only });
  };
  /** Bracket a working order: same click-to-set legs, held until it fills. */
  /** From a working order's ⋮: Set stop / Set limit / Set TP/SL — the
      position's pattern, legs held until the order fills. */
  const startOrderExit = (id: number, only?: Leg) => {
    setDraft(null);
    const g = orders.find((o) => o.id === id)?.group;
    setPb({ on: id, only, group: g });
  };
  const pbActive = !!bk && bk.from !== "entry";
  /** Where the legs being set will sit: beside their order, or on the
      position's closing side. */
  const legCol: Side | null = bk ? (bk.from === "order" ? bk.side : opp(bk.side)) : null;
  /** Which leg a price makes, relative to the position: the profit side
      is a take profit, the loss side a stop loss. */
  const legFor = (price: number): Leg | null => {
    if (!bk) return null;
    const d = (price - bk.entry) * (bk.side === "buy" ? 1 : -1);
    const leg: Leg | null = d > 1e-9 ? "tp" : d < -1e-9 ? "sl" : null;
    /* Set stop / Set limit: only that leg's side of the position takes. */
    return pb?.only && leg !== pb.only ? null : leg;
  };
  useEffect(() => {
    if (!pbActive) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setPb(null);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [pbActive]);
  /** Place the position's bracket: both legs live at once (the position
      exists), one-cancels-other. */
  const placePosBracket = () => {
    if (!bk || bk.from === "entry") return;
    const id = Date.now();
    /* On an order: the order joins the group and its legs wait, held,
       until it fills. On the position: the legs go live now. */
    const forOrder = bk.from === "order";
    const group = forOrder ? (orders.find((o) => o.id === bk.id)?.group ?? id) : id;
    setOrders((os) => [
      ...os.map((o) => (forOrder && o.id === bk.id ? { ...o, group } : o)),
      ...(["tp", "sl"] as Leg[]).filter((leg) => bk[leg] != null).map((leg, i) => ({
        id: id + i,
        side: opp(bk.side),
        kind: (leg === "tp" ? "LMT" : "STP") as Kind,
        price: bk[leg]!,
        qty: bk.qty,
        at: id,
        group,
        leg,
        held: forOrder,
      })),
    ]);
    setPb(null);
  };
  /** Set stop / limit / TP-SL: a click sends that leg at once. It joins
      the subject's group (so a second leg pairs one-cancels-other) — on a
      working order the legs are held until it fills. Set stop / limit end
      after one; TP/SL after both (clicking a side again re-prices it). */
  const sendLeg = (leg: Leg, price: number) => {
    if (!bk || bk.from === "entry" || !pb) return;
    const forOrder = bk.from === "order";
    const now = Date.now();
    const existing = orders.find((o) => o.leg && !o.held === !forOrder && o.group === pb.group && pb.group != null);
    const group =
      pb.group ??
      (forOrder ? (orders.find((o) => o.id === bk.id)?.group ?? now) : (posGroupRef.current ?? now));
    const had = new Set(orders.filter((o) => o.group === group && o.leg).map((o) => o.leg));
    setOrders((os) => {
      const mine = os.find((o) => o.group === group && o.leg === leg);
      const base = os.map((o) => (forOrder && o.id === bk.id ? { ...o, group } : o));
      if (mine) return base.map((o) => (o === mine || (o.group === group && o.leg === leg) ? { ...o, price, at: now } : o));
      return [
        ...base,
        {
          id: now,
          side: opp(bk.side),
          kind: (leg === "tp" ? "LMT" : "STP") as Kind,
          price,
          qty: bk.qty,
          at: now,
          group,
          leg,
          held: forOrder,
        },
      ];
    });
    void existing;
    had.add(leg);
    const done = pb.only ? true : had.has("tp") && had.has("sl");
    setPb(done ? null : { ...pb, group });
    setHover(null);
  };
  /** The position's live bracket (legs with no working entry), if any. */
  const posGroup = orders.find((o) => o.leg && !orders.some((e) => e.group === o.group && !e.leg))?.group ?? null;
  const posBracketed = posGroup != null;
  const posGroupRef = useRef<number | null>(null);
  posGroupRef.current = posGroup;

  /** Drag a draft leg: it stays on its own side of the entry (a take
      profit can't sit on the losing side). */
  const grabLeg = (leg: Leg, e: React.PointerEvent) => {
    if (e.button !== 0 || !bk) return;
    e.preventDefault();
    e.stopPropagation();
    const b0 = bk;
    const dir = b0.side === "buy" ? 1 : -1;
    const move = (ev: PointerEvent) => {
      const p = priceAtY(ev.clientY);
      if (p == null) return;
      const ok = leg === "tp" ? (p - b0.entry) * dir > 1e-9 : (b0.entry - p) * dir > 1e-9;
      if (!ok) return;
      if (b0.from === "entry") setDraft((d) => (d && d.bracket ? { ...d, bracket: { ...d.bracket, [leg]: p } } : d));
      else setPb((c) => (c ? { ...c, [leg]: p } : c));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /** The level an order is drawn on. A pending market order has no price
      of its own: it sits on the touch it will fill at, and moves with it. */
  const levelOf = (o: Order) => (o.kind === "MKT" ? (o.side === "buy" ? ask : bid) : o.price);

  /* ---------- drag to reprice ----------
     Press a resting order's tag and drag: a ghost follows to the row
     under the pointer, showing the new price, the move in cents, and the
     kind the order will be there (dragging a buy above the ask turns it
     into a stop — the ghost says so before you let go). Release to move
     every order in that tag; Esc, or dropping on its own row, cancels.
     Near the window's edge the book scrolls. */
  const [drag, setDrag] = useState<{ side: Side; kind: Kind; from: number; to: number } | null>(null);
  /** The tag under the pointer (or focus): its row draws a leader from
      the tag to its price and lights the price — "this order rests
      here". While dragging, the leader follows the drop row. */
  const [tagFocus, setTagFocus] = useState<{ side: Side; price: number } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  /* The drop re-types against the market at release, not at press. */
  const mktRef = useRef({ bid, ask });
  mktRef.current = { bid, ask };
  const priceAtY = useCallback(
    (clientY: number) => {
      const el = scrollRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      /* Screen px → layout px: the page may be CSS-zoomed (1.2 on desktop),
         and the bounding box is in screen px while scrollTop and row
         heights are in layout px. */
      const k = r.height / el.clientHeight || 1;
      const y = (Math.min(Math.max(clientY, r.top + 1), r.bottom - 1) - r.top) / k + el.scrollTop;
      const i = Math.min(LEVELS.length - 1, Math.max(0, Math.floor(y / rowH)));
      return LEVELS[i];
    },
    [rowH],
  );
  const grab = (side: Side, kind: Kind, from: number, e: React.PointerEvent, leg?: { leg: Leg; group: number }) => {
    if (kind === "MKT" || e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".tl-tag-x")) return;
    e.preventDefault();
    const y0 = e.clientY;
    let live = false;
    let lastY = e.clientY;
    let raf = 0;
    const edge = () => {
      const el = scrollRef.current;
      if (!el || !dragRef.current) return;
      const r = el.getBoundingClientRect();
      const zone = 28;
      const dy = lastY < r.top + zone ? -(r.top + zone - lastY) : lastY > r.bottom - zone ? lastY - (r.bottom - zone) : 0;
      if (dy) {
        el.scrollTop += Math.max(-14, Math.min(14, dy * 0.5));
        const to = priceAtY(lastY);
        if (to != null) setDrag((d) => (d && d.to !== to ? { ...d, to } : d));
      }
      raf = requestAnimationFrame(edge);
    };
    const move = (ev: PointerEvent) => {
      lastY = ev.clientY;
      if (!live && Math.abs(ev.clientY - y0) < 4) return;
      if (!live) {
        live = true;
        setHover(null);
        setDraft(null);
        raf = requestAnimationFrame(edge);
      }
      const to = priceAtY(ev.clientY);
      if (to != null) setDrag((d) => (d && d.to === to ? d : { side, kind, from, to }));
    };
    const end = (commit: boolean) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancelDrag);
      window.removeEventListener("keydown", key);
      cancelAnimationFrame(raf);
      const d = dragRef.current;
      setDrag(null);
      if (!commit || !d || d.to === d.from) return;
      /* A bracket leg doesn't move on drop: it stages at the new price
         and waits for its pill's confirm. */
      if (leg) {
        setLegMove({ side: d.side, kind: d.kind, leg: leg.leg, group: leg.group, from: d.from, to: d.to });
        return;
      }
      setOrders((os) =>
        os.map((o) =>
          o.side === d.side && o.kind === d.kind && o.price === d.from
            ? { ...o, price: d.to, kind: kindFor({ side: o.side, price: d.to }, mktRef.current.bid, mktRef.current.ask), at: Date.now() }
            : o,
        ),
      );
    };
    const up = () => end(live);
    const cancelDrag = () => end(false);
    const key = (ev: KeyboardEvent) => ev.key === "Escape" && end(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancelDrag);
    window.addEventListener("keydown", key);
  };

  /* Off-screen orders: per side and edge, the nearest working order out
     of view (its row's middle past the window's edge) pins a tag to
     that edge — the platform's ↑/↓ LMT. A click centres it. */
  const offscreen = (() => {
    const out: { side: Side; edge: "top" | "bottom"; kind: Kind; leg?: Leg; price: number; n: number }[] = [];
    const mid = (p: number) => Math.round((TOP - p) / TICK) * rowH + rowH / 2;
    for (const side of ["buy", "sell"] as Side[]) {
      for (const edge of ["top", "bottom"] as const) {
        const out_ = orders.filter((o) => {
          if (colOf(o, orders) !== side) return false;
          const y = mid(levelOf(o));
          return edge === "top" ? y < viewTop : y > viewTop + VIEW_H;
        });
        if (!out_.length) continue;
        const near = out_.reduce((a, o) =>
          edge === "top" ? (levelOf(o) < levelOf(a) ? o : a) : levelOf(o) > levelOf(a) ? o : a,
        );
        out.push({ side, edge, kind: near.kind, leg: near.leg, price: levelOf(near), n: out_.length });
      }
    }
    return out;
  })();

  const closed = session === "after";
  const fix = treatment === "proposed";
  const placeMarket = (side: Side, n = qty) =>
    !closed &&
    setOrders((os) => [
      ...os,
      { id: Date.now(), side, kind: "MKT", price: side === "buy" ? ask : bid, qty: n, at: Date.now() },
    ]);


  const cancel = (side: Side, kind: Kind, price: number) =>
    setOrders((os) =>
      os.filter(
        (o) =>
          !(
            colOf(o, os) === side &&
            o.kind === kind &&
            /* A market order has no level of its own, and its tag may be
               caught mid-slide between two — match it on side alone. */
            (kind === "MKT" || o.price === price)
          ),
      ),
    );

  const cancelOne = (id: number) => setOrders((os) => os.filter((o) => o.id !== id));
  /** Replace: a working order takes a new size and/or price in place. A
      new price is re-typed against the market (through it, a limit
      becomes a stop and back), and the order is re-stamped, as a
      cancel-replace is a new order to the venue. */
  const replaceOne = (id: number, next: { qty: number; price: number }) =>
    setOrders((os) =>
      os.map((o) => {
        if (o.id !== id) return o;
        const price = o.kind === "MKT" ? o.price : +(Math.round(next.price / TICK) * TICK).toFixed(2);
        const kind = o.kind === "MKT" ? "MKT" : kindFor({ side: o.side, price }, bid, ask);
        return { ...o, qty: Math.max(1, Math.round(next.qty)), price, kind, at: Date.now() };
      }),
    );

  /* Flat means flat: every working order pulled and the position closed
     at the touch. A resting order left behind would reopen one. */
  /* After hours the platform's Flatten is dead; the proposal keeps it:
     the cancel half works any time, and the close goes as a limit at
     the touch (marketable, so it fills now) instead of a market order. */
  const flattenBlocked = closed && !fix;
  /* Flatten says exactly what it will do now: only the halves that
     apply (close / cancel), and the market-hours note only after hours
     and only when there is a position to close. */
  const flattenCopy = (() => {
    const has = pos.qty !== 0;
    const close = closed
      ? `close your position with a limit order at the ${pos.qty < 0 ? "ask" : "bid"}`
      : "close your position with a market order";
    const s0 = has && orders.length ? `${cap(close)} and cancel all open orders.` : has ? `${cap(close)}.` : "Cancel all open orders.";
    return closed && has ? `${s0} Market orders open at ${OPENS}.` : s0;
  })();
  /** Close the position alone, orders untouched — the position panel's
      Close. Same session rules as Flatten's close half. */
  const closeBlocked = flattenBlocked;
  const closePosition = () => {
    if (closeBlocked || pos.qty === 0) return;
    const side: Side = pos.qty > 0 ? "sell" : "buy";
    if (closed) place({ side, price: side === "sell" ? bid : ask, qty: Math.abs(pos.qty) });
    else applyFill(side, side === "sell" ? bid : ask, Math.abs(pos.qty));
  };
  const flatten = () => {
    if (flattenBlocked) return;
    setOrders([]);
    setDraft(null);
    if (pos.qty === 0) return;
    const side: Side = pos.qty > 0 ? "sell" : "buy";
    if (closed) place({ side, price: side === "sell" ? bid : ask, qty: Math.abs(pos.qty) });
    else applyFill(side, side === "sell" ? bid : ask, Math.abs(pos.qty));
  };

  /* Shift + Option + F flattens, as the tooltip promises. `code`, not
     `key`: Option rewrites the character on a Mac (F becomes "Ï"). */
  const flattenRef = useRef(flatten);
  flattenRef.current = flatten;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && e.altKey && !e.metaKey && !e.ctrlKey && e.code === "KeyF") {
        e.preventDefault();
        flattenRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!draft) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDraft(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft]);

  const openPnl = pos.qty ? (last - pos.avg) * pos.qty * MULT : 0;
  const dayPnl = openPnl + pos.realized;
  /* The marker sits on the level nearest the average — an average of
     mixed fills need not land on a tick. */
  const avgLevel = pos.qty ? +(Math.round(pos.avg / TICK) * TICK).toFixed(2) : null;
  const nOrders = orders.length;
  /* The position line's colour: P&L up / down — and when flat (a fresh
     fill), the position's own side, so it never fades to grey. */
  const posDir = dirOf(openPnl) !== "flat" ? dirOf(openPnl) : pos.qty > 0 ? "up" : pos.qty < 0 ? "down" : "flat";
  /** Review aid: fill an order now, at its price (a market order at the
      touch) — the oldest working one, or the one named. */
  const simulateFill = (id?: number) => {
    const o =
      id != null
        ? orders.find((x) => x.id === id && !x.held)
        : [...orders].filter((x) => !x.held).sort((a, b) => a.at - b.at || a.id - b.id)[0];
    if (!o) return;
    applyFill(o.side, o.kind === "MKT" ? (o.side === "buy" ? ask : bid) : o.price, o.qty);
    setOrders((os) => settleBrackets(os, [o]));
  };
  /* Leg pills: a drafted bracket's two legs, or a placed leg's staged move. */
  const legPills: LegPillSpec[] = [];
  if (bk && bk.from === "entry") {
    const sign = bk.side === "buy" ? 1 : -1;
    for (const leg of ["tp", "sl"] as Leg[]) {
      if (bk[leg] == null) continue;
      legPills.push({
        key: `d-${leg}`,
        side: opp(bk.side),
        leg,
        price: bk[leg]!,
        qty: bk.qty,
        pnl: (bk[leg]! - bk.entry) * bk.qty * MULT * sign,
        label: leg === "tp" ? "Take profit" : "Stop loss",
        onSend: bk.from === "entry" ? send : placePosBracket,
        /* × removes this leg; the mode stays for the other. */
        onCancel: () =>
          bk.from === "entry" ? toggleBracket() : setPb((c) => (c ? { ...c, [leg]: undefined } : c)),
        onGrab: (e: React.PointerEvent) => grabLeg(leg, e),
      });
    }
  }
  if (legMove) {
    const ep = orders.find((o) => o.group === legMove.group && !o.leg)?.price ?? pos.avg;
    const q = orders.find((o) => o.group === legMove.group && o.leg === legMove.leg)?.qty ?? 0;
    const sign = legMove.side === "sell" ? 1 : -1; /* legs sell out of a long */
    legPills.push({
      key: "move",
      side: legMove.side,
      leg: legMove.leg,
      price: legMove.to,
      qty: q,
      pnl: (legMove.to - ep) * q * MULT * sign,
      label: legMove.leg === "tp" ? "Move take profit" : "Move stop loss",
      onSend: commitLegMove,
      onCancel: () => setLegMove(null),
      onGrab: (e: React.PointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const move = (ev: PointerEvent) => {
          const p = priceAtY(ev.clientY);
          if (p != null) setLegMove((m) => (m ? { ...m, to: p } : m));
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      },
    });
  }

  /* Bracket rails: the draft's, and every live bracket's (entry still
     working, or filled — then the position's average stands in). */
  const rails: RailSpec[] = (() => {
    const out: RailSpec[] = [];
    const idx = (p: number) => Math.round((TOP - p) / TICK);
    /* Bracket mode: a dashed connector in the price column from the
       position's average to each leg you've set. */
    /* Setting a leg: the connector follows the pointer — from the
       position (or order) to the price a click would send. */
    const hl = pbActive && hover ? legFor(hover.price) : null;
    if (bk && bk.from !== "entry" && hover && hl)
      out.push({
        key: "draft",
        side: legCol!,
        entry: idx(Math.round(bk.entry / TICK) * TICK),
        tp: hl === "tp" ? idx(hover.price) : undefined,
        sl: hl === "sl" ? idx(hover.price) : undefined,
        rr: 0,
        draft: true,
        chip: false,
        /* Same column as the placed connector, so a click doesn't move it. */
        anchor: "tags",
        orderEntry: bk.from === "order",
      });
    const groups = [...new Set(orders.filter((o) => o.leg).map((o) => o.group!))];
    for (const g of groups) {
      const tp = orders.find((o) => o.group === g && o.leg === "tp");
      const sl = orders.find((o) => o.group === g && o.leg === "sl");
      const entry = orders.find((o) => o.group === g && !o.leg);
      const ep = entry ? entry.price : pos.qty ? pos.avg : null;
      if ((!tp && !sl) || ep == null) continue;
      /* Placed: a quiet connector from the position (or order) to its
         legs, always; hovered or selected it brightens and shows R:R. */
      const on = g === railHot || g === railSel;
      out.push({
        key: `g${g}`,
        side: entry ? entry.side : (tp ?? sl)!.side,
        entry: idx(Math.round(ep / TICK) * TICK),
        tp: tp ? idx(tp.price) : undefined,
        sl: sl ? idx(sl.price) : undefined,
        rr: tp && sl ? Math.abs(tp.price - ep) / Math.abs(ep - sl.price) : 0,
        draft: false,
        chip: on && !!tp && !!sl,
        /* Placed: in the legs' tag column, dashed — beside the TP / SL tags. */
        anchor: "tags",
        quiet: !on,
        orderEntry: !!entry,
      });
    }
    return out;
  })();
  /* Pill → icon (user, 2026-11-05): icons at rest; hovering one opens
     its label as a pill; a click opens its panel. */
  /* The two summary panels, placed by the summary mode: in the header
     (text / pills) or as icons on the symbol (icons). */
  const posPanel = (icon: boolean) => (
    <PositionPanel
      icon={icon}
      morph={summary === "morph"}
      pos={pos}
      last={last}
      openPnl={openPnl}
      dayPnl={dayPnl}
      closeNote={
        closeBlocked
          ? "Market orders open at " + OPENS
          : closed
            ? `Closes with a limit at the ${pos.qty > 0 ? "bid" : "ask"}`
            : undefined
      }
      closeBlocked={closeBlocked}
      onClose={closePosition}
    />
  );
  const ordersPanel = (icon: boolean) => (
    <OpenOrders
      icon={icon}
      morph={summary === "morph"}
      orders={orders}
      onCancel={cancelOne}
      onReplace={replaceOne}
      onFill={(id) => simulateFill(id)}
      onCancelAll={() => setOrders([])}
      short={summary === "pills"}
    />
  );
  return (
    <section
      className="tl-root"
      aria-label="Trading ladder"
      data-variant={variant}
      data-summary={summary}
      style={width ? { width } : undefined}
    >
      {/* ---------- top bar ---------- */}
      <div className="tl-bar-top">
        <button type="button" className="tl-win" aria-label="Close the ladder" onClick={onClose}>
          <span aria-hidden="true" />
        </button>
        <span className="tl-sym">
          <SearchIcon />
          <span>{SYMBOL}</span>
        </span>
        <span className="tl-quote">
          <span className="tl-quote-px">{fmtPx(last)}</span>
          <span className="tl-quote-chg" data-dir={dirOf(last - PREV_CLOSE)}>
            <Tri dir={last >= PREV_CLOSE ? "up" : "down"} />
            {Math.abs(last - PREV_CLOSE).toFixed(2)} ({(Math.abs(last - PREV_CLOSE) / PREV_CLOSE * 100).toFixed(2)}%)
          </span>
        </span>
        <span className="tl-split" />
          <button
            type="button"
            className="tl-icon-btn tl-quick"
            aria-pressed={quick}
            aria-label="One-click trading"
            title={quick ? "One-click trading is on — a click on a level sends" : "One-click trading"}
            onClick={() => {
              setQuick((q) => !q);
              setDraft(null);
            }}
          >
            <BoltIcon />
          </button>
          <Menu
            label="Ladder options"
            direction="right"
            width="max-content"
            triggerClass="tl-icon-btn"
            renderTrigger={() => <MoreIcon />}
          >
            <MenuItem label="Column headers" onClick={() => setHeaders((h) => !h)}>
              <span>Column headers</span>
              <span className="tl-menu-check">{headers && <Check />}</span>
            </MenuItem>
            {/* Review aid: fill the oldest working order (not a held leg)
                at its price, now — to watch a bracket wake. */}
            <MenuItem label="Simulate fill" disabled={!orders.some((o) => !o.held)} onClick={() => simulateFill()}>
              <span>Simulate fill</span>
            </MenuItem>
            <MenuItem label="Cancel all orders" disabled={!nOrders} onClick={() => setOrders([])}>
              <span>Cancel all orders</span>
            </MenuItem>
          </Menu>
      </div>

      {/* ---------- header ---------- */}
      <div className="tl-top">

        <div className="tl-summary">
          <div className="tl-pnl">
            {/* No position: there is no open P&L to state — "--", as the
                platform shows; Day P&L too until something is realized. */}
            <PnlLine label="Open P&L" value={pos.qty ? openPnl : null} />
            <PnlLine label="Day P&L" value={pos.qty || pos.realized ? dayPnl : null} />
          </div>

          {/* Nothing held, nothing working: nothing to say, nothing to
              flatten — the whole cluster goes (user, 2026-11-05). */}
          {(pos.qty !== 0 || nOrders > 0) && (
            <>
          {/* Icons (vision): what you hold and what's working as icon
              buttons beside Flatten, Flatten's size — the header keeps
              P&L on the left and three squares on the right. */}
          <div className="tl-posn">
            {pos.qty ? (
              posPanel(summary === "icons")
            ) : (
              summary === "text" && <span className="tl-posn-v">No position</span>
            )}
            {nOrders ? (
              ordersPanel(summary === "icons")
            ) : (
              summary === "text" && <span className="tl-posn-o">No open orders</span>
            )}
          </div>

          <Hint
            text={flattenBlocked ? CURRENT_CLOSED_COPY : flattenCopy}
            keys={flattenBlocked ? undefined : "Shift Option F"}
            sticky={closed && fix}
          >
            <button
              type="button"
              className="tl-flatten"
              aria-label={
                flattenBlocked ? `Flatten unavailable. ${CURRENT_CLOSED_COPY}` : `Flatten — ${flattenCopy} (Shift Option F)`
              }
              aria-keyshortcuts={flattenBlocked ? undefined : "Shift+Alt+F"}
              /* aria-disabled, not disabled, so the hover that explains
                 it still reaches it. */
              aria-disabled={flattenBlocked || (!pos.qty && !nOrders) || undefined}
              data-off={flattenBlocked || (!pos.qty && !nOrders) || undefined}
              onClick={() => !(flattenBlocked || (!pos.qty && !nOrders)) && flatten()}
            >
              {fix ? <FlattenIcon /> : <SlashIcon />}
            </button>
          </Hint>
            </>
          )}
        </div>

        <OrderBar
          qty={qty}
          onQty={setQty}
          onBuy={() => placeMarket("buy")}
          onSell={() => placeMarket("sell")}
          order={variant === "lead" ? "lead" : "trail"}
          hint={variant === "tip" ? QTY_HINT : undefined}
          layoutId="tl-qty"
          blocked={closed ? { reason: PROPOSED_BLOCKED_COPY, explain: fix } : undefined}
          /* No shares to sell: selling opens (or adds to) a short — the
             button says so, and its hover explains it in plain words. */
          short={
            pos.qty <= 0
              ? {
                  note:
                    pos.qty < 0
                      ? `You’re already short ${SYMBOL} — this sells more borrowed shares, adding to your short.`
                      : `You don’t own ${SYMBOL} — this sells shares you borrow, opening a short position.`,
                }
              : undefined
          }
        />
      </div>

      {/* ---------- ladder ---------- */}
      <div className="tl-body">
        <div className="tl-table" data-thumb>
          {headers && (
          <div className="tl-grid tl-head" aria-hidden="true">
            <span className="tl-cell tl-cell--mine" />
            <span className="tl-cell tl-cell--bid tl-head-pair">
              <span className="tl-size-col">Size</span>
            </span>
            <span className="tl-cell tl-cell--px tl-head-px">{view === "pnl" ? "P&L" : ""}</span>
            <span className="tl-cell tl-cell--ask tl-head-pair">
              <span className="tl-size-col">Size</span>
            </span>
            <span className="tl-cell tl-cell--mine tl-cell--sells" />
          </div>
          )}

          <div className="tl-scroll">
          <div
            ref={scrollRef}
            className="tl-rows"
            style={{ "--row-h": `${rowH}px`, height: VIEW_H } as React.CSSProperties}
            onScroll={onScroll}
            onMouseLeave={() => setHover(null)}
            /* Setting a leg: the whole row is the target — price, bars,
               and the tag column where the connector draws — so the
               preview follows the pointer anywhere, not only over a bar
               (user, 2026-11-05: "move the mouse … it doesn't work"). */
            onPointerMove={
              pbActive
                ? (e) => {
                    const p = priceAtY(e.clientY);
                    if (p != null && hover?.price !== p) setHover({ side: legCol ?? "buy", price: p });
                  }
                : undefined
            }
            onClickCapture={
              pbActive
                ? (e) => {
                    const t = e.target as HTMLElement;
                    /* tags, × and the leg pill keep their own clicks */
                    if (t.closest(".tl-tag, .tl-pill, .tl-modebar, .tl-ptag, .tl-jump, .tl-omenu")) return;
                    const p = priceAtY(e.clientY);
                    if (p == null) return;
                    e.stopPropagation();
                    e.preventDefault();
                    stage({ side: legCol ?? "buy", price: p });
                  }
                : undefined
            }
          >
            {book.rows.map((r) => {
              const key = r.price.toFixed(2);
              const mine = (side: Side) => {
                const at = orders.filter((o) => colOf(o, orders) === side && levelOf(o) === r.price);
                /* One tag per kind — and bracket legs apart, labelled TP / SL,
                   held ones drawn as waiting. */
                const keyOf = (o: Order) => `${o.kind}|${o.leg ?? ""}|${o.held ? 1 : 0}`;
                const keys = [...new Set(at.map(keyOf))];
                return keys.map((k) => {
                  const os = at.filter((o) => keyOf(o) === k);
                  return {
                    kind: os[0].kind,
                    leg: os[0].leg,
                    held: !!os[0].held,
                    group: os[0].group,
                    id: os[0].id,
                    qty: os.reduce((n, o) => n + o.qty, 0),
                  };
                });
              };
              const rowDraft = draft && draft.price === r.price ? draft : null;
              const rowHover = !rowDraft && hover && hover.price === r.price ? hover : null;
              /* Hovering the side where you already rest an order shows
                 THAT order (leader + lit price), not a new-order pill —
                 a click still stages one. */
              const ownAt =
                rowHover && !rowHover.qty && mine(rowHover.side).some((g) => g.kind !== "MKT") ? rowHover.side : null;
              /* The position row: hover shows the position's own tag (its ×
                 closes), so the close pill would only cover the line — it
                 appears on click instead. */
              const shown = pbActive ? null : rowDraft || (ownAt || rowHover?.qty ? null : rowHover);
              /* Bracket mode: hovering a price previews the leg a click sets. */
              /* …and on a price that can't take a leg, why not. */
              const blockHint = (() => {
                if (!pbActive || !bk || !hover || hover.price !== r.price || legFor(r.price)) return null;
                const at = fmtPx(bk.entry);
                const up = bk.side === "buy" ? "above" : "below";
                const dn = bk.side === "buy" ? "below" : "above";
                if (pb?.only === "sl") return `A stop loss goes ${dn} ${at}`;
                if (pb?.only === "tp") return `A take profit goes ${up} ${at}`;
                return `${up === "above" ? "Above" : "Below"} = take profit · ${dn} = stop loss`;
              })();
              const previewLeg =
                pbActive && hover && hover.price === r.price && legFor(r.price) && bk?.[legFor(r.price)!] !== r.price
                  ? legFor(r.price)
                  : null;
              const zone = r.price >= ask ? "ask" : r.price <= bid ? "bid" : "spread";
              const link = drag
                ? drag.to !== drag.from && drag.to === r.price
                  ? drag.side
                  : null
                : tagFocus && tagFocus.price === r.price
                  ? tagFocus.side
                  : ownAt;
              const fill = fills[key];
              const pnl = pos.qty ? (r.price - pos.avg) * pos.qty * MULT : 0;
              /* Holding a position, its own level only ever offers the way
                 out: both sides stage the closing order, for the whole
                 position. Adding to it is what the rest of the ladder is
                 for. */
              const rowClose =
                r.price === avgLevel && pos.qty
                  ? { side: (pos.qty > 0 ? "sell" : "buy") as Side, qty: Math.abs(pos.qty) }
                  : undefined;
              const figure = view === "price" ? fmtPx(r.price) : pos.qty ? fmtUsd(pnl) : "—";

              return (
                <div
                  key={key}
                  className="tl-grid tl-row"
                  data-zone={zone}
                  data-lit={shown || (drag && drag.to === r.price && drag.to !== drag.from) ? "" : undefined}
                  data-drop={drag && drag.to === r.price && drag.to !== drag.from ? drag.side : undefined}
                  data-linked={link || undefined}
                  data-nope={blockHint ? "" : undefined}
                  data-pos={r.price === avgLevel || undefined}
                  onPointerEnter={r.price === avgLevel && posGroup != null ? () => setRailHot(posGroup) : undefined}
                  onPointerLeave={r.price === avgLevel && posGroup != null ? () => setRailHot(null) : undefined}
                  data-inside={r.price === bid || r.price === ask ? "" : undefined}
                >
                  {fill && (
                    <span key={fill.key} className="tl-flash" data-side={fill.side} aria-hidden="true" />
                  )}

                  {/* Position line, after the reference: a dashed rule at
                      your average, in the colour of the open P&L. It runs
                      through the empty space either side and breaks for
                      the price and for any depth on the level. Absolutely
                      placed grid children, so each segment takes its grid
                      area as its box. */}
                  {r.price === avgLevel && (
                    <>
                      {/* One dashed line across the whole row, behind it all:
                          bars and the pill cover it, figures cut it out — so
                          it runs right up to each (the platform's). */}
                      <span className="tl-posline" data-dir={posDir} style={{ gridColumn: "1 / -1" }} aria-hidden="true" />
                      {/* The position's own tag on its line — the order
                          tags' twin — with × to close from the ladder.
                          Left by default; right if a buy tag holds the
                          row's left edge. */}
                      <PosTag
                        pos={pos}
                        pnl={openPnl}
                        /* A fixed side — the closing side (right for a long,
                           left for a short) — so the tag and its menu never
                           hop as the book on this row flips with the market. */
                        edge={pos.qty > 0 ? "right" : "left"}
                        blocked={closeBlocked}
                        note={
                          closeBlocked
                            ? `Market orders open at ${OPENS}`
                            : `${pos.qty > 0 ? "Sell" : "Buy"} ${Math.abs(pos.qty)} ${closed ? `with a limit at the ${pos.qty > 0 ? "bid" : "ask"}` : "at market"}`
                        }
                        onClose={closePosition}
                        bracket={bk?.from === "pos" ? "draft" : posBracketed ? "live" : "off"}
                        onBracket={togglePosBracket}
                        onPlaceBracket={placePosBracket}
                        onExit={startPosExit}
                        mode={pb?.only === "sl" ? "Set stop" : pb?.only === "tp" ? "Set limit" : "Set TP/SL"}
                        onStop={() => setPb(null)}
                        has={{
                          tp: posGroup != null && orders.some((o) => o.group === posGroup && o.leg === "tp"),
                          sl: posGroup != null && orders.some((o) => o.group === posGroup && o.leg === "sl"),
                        }}
                        rr={
                          bk?.from === "pos" && bk.tp != null && bk.sl != null
                            ? Math.abs(bk.tp - bk.entry) / Math.abs(bk.entry - bk.sl)
                            : undefined
                        }
                        reduce={!!reduce}
                      />
                    </>
                  )}

                  {link && (
                    <span
                      className="tl-link"
                      data-side={link}
                      style={{ gridColumn: link === "buy" ? "2 / 3" : "4 / 5" }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="tl-cell tl-cell--mine">
                    <OrderTags
                      side="buy"
                      price={r.price}
                      groups={mine("buy")}
                      onCancel={cancel}
                      onGrab={(kind, e, lg) => grab("buy", kind, r.price, e, lg)}
                      onFocusTag={(on) => setTagFocus(on ? { side: "buy", price: r.price } : null)}
                      activeGroup={railSel ?? railHot}
                      onLegHover={(g, on) => setRailHot(on ? g : null)}
                      onLegSelect={(g) => setRailSel((c) => (c === g ? null : g))}
                      onExit={startOrderExit}
                      bracketing={pb && pb.on !== "pos" ? pb.on : null}
                      legsOf={(g) => ({
                        tp: g != null && orders.some((o) => o.group === g && o.leg === "tp"),
                        sl: g != null && orders.some((o) => o.group === g && o.leg === "sl"),
                      })}
                      lifted={
                        drag && drag.side === "buy" && drag.from === r.price && drag.to !== r.price
                          ? drag.kind
                          : legMove && legMove.side === "buy" && legMove.from === r.price
                            ? legMove.kind
                            : undefined
                      }
                      reduce={!!reduce}
                    />
                    {drag && drag.side === "buy" && drag.to === r.price && drag.to !== drag.from && (
                      <DragGhost drag={drag} orders={orders} bid={bid} ask={ask} />
                    )}
                    {/* Setting a leg: a ghost of the tag it will become, where
                        it will sit — the connector meets it; a click makes it
                        real in place. */}
                    {previewLeg && bk && legCol === "buy" && (
                      <span className="tl-tag tl-tag--preview" data-side="buy" data-leg={previewLeg} aria-hidden="true">
                        <span className="tl-tag-x"><CloseIcon size={10} /></span>
                        <span className="tl-tag-q">{bk.qty.toLocaleString("en-US")}</span>
                        <span className="tl-tag-k">{previewLeg.toUpperCase()}</span>
                      </span>
                    )}
                  </span>

                  <SizeCell side="buy" closing={rowClose} size={r.bidSize} max={book.max} depth={Math.round((bid - r.price) / TICK)} price={r.price} onHover={setHover} onPick={stage} />

                  <span className="tl-cell tl-cell--px">
                    {/* The position's pill always shows on its row — even when
                        the last trade lands there (a ring then marks "last"). */}
                    {r.price === last && r.price !== avgLevel ? (
                      <motion.span
                        layoutId="tl-last"
                        className="tl-last"
                        data-focus={link ? "" : undefined}
                        transition={reduce ? { duration: 0 } : LADDER_SPRING}
                      >
                        {figure}
                      </motion.span>
                    ) : r.price === avgLevel ? (
                      <span
                        className="tl-px tl-avg"
                        data-focus={link ? "" : undefined}
                        data-last={r.price === last ? "" : undefined}
                        data-dir={posDir}
                      >
                        {figure}
                      </span>
                    ) : (
                      <span
                        className="tl-px"
                        data-focus={link ? "" : undefined}
                        /* The inside-market tint is a price-view cue; in
                           P&L view the figure's own sign colours it. */
                        data-zone={view === "price" ? zone : undefined}
                        data-dir={view === "pnl" && pos.qty ? dirOf(pnl) : undefined}
                      >
                        {figure}
                      </span>
                    )}

                    <span className="tl-pill-slot">
                      <AnimatePresence initial={false}>
                        {/* Bracket legs being set — drafted, or a placed leg
                            moved — wear the staged-order pill: drag it; its
                            label places; × discards. They take the row. */}
                        {legPills
                          .filter((lp) => lp.price === r.price)
                          .map(({ key, ...lp }) => (
                            <LegPill key={key} {...lp} reduce={!!reduce} />
                          ))}
                        {blockHint && (
                          <motion.span
                            key="nope"
                            role="status"
                            className="tl-nope tl-surface"
                            initial={reduce ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, transition: { duration: 0.06 } }}
                            transition={{ duration: 0.1 }}
                          >
                            {blockHint}
                          </motion.span>
                        )}
                        {previewLeg && (
                          <LegPill
                            key="preview"
                            preview
                            side={opp(bk!.side)}
                            leg={previewLeg}
                            price={r.price}
                            qty={bk!.qty}
                            pnl={(r.price - bk!.entry) * bk!.qty * MULT * (bk!.side === "buy" ? 1 : -1)}
                            label={previewLeg === "tp" ? "Take profit" : "Stop loss"}
                            onSend={() => {}}
                            onCancel={() => {}}
                            onGrab={() => {}}
                            reduce={!!reduce}
                          />
                        )}
                        {shown && !legPills.some((lp) => lp.price === r.price) && (
                          <TradePill
                            key="pill"
                            d={shown}
                            kind={kindFor(shown, bid, ask)}
                            staged={!!rowDraft}
                            quick={quick}
                            short={shown.side === "sell" && pos.qty <= 0}
                            qty={qty}
                            onSend={send}
                            onPlace={() => place(shown)}
                            onCancel={() => setDraft(null)}
                            reduce={!!reduce}
                          />
                        )}
                      </AnimatePresence>
                    </span>
                  </span>

                  <SizeCell side="sell" closing={rowClose} size={r.askSize} max={book.max} depth={Math.round((r.price - ask) / TICK)} price={r.price} onHover={setHover} onPick={stage} />

                  <span className="tl-cell tl-cell--mine tl-cell--sells">
                    <OrderTags
                      side="sell"
                      price={r.price}
                      groups={mine("sell")}
                      onCancel={cancel}
                      onGrab={(kind, e, lg) => grab("sell", kind, r.price, e, lg)}
                      onFocusTag={(on) => setTagFocus(on ? { side: "sell", price: r.price } : null)}
                      activeGroup={railSel ?? railHot}
                      onLegHover={(g, on) => setRailHot(on ? g : null)}
                      onLegSelect={(g) => setRailSel((c) => (c === g ? null : g))}
                      onExit={startOrderExit}
                      bracketing={pb && pb.on !== "pos" ? pb.on : null}
                      legsOf={(g) => ({
                        tp: g != null && orders.some((o) => o.group === g && o.leg === "tp"),
                        sl: g != null && orders.some((o) => o.group === g && o.leg === "sl"),
                      })}
                      lifted={
                        drag && drag.side === "sell" && drag.from === r.price && drag.to !== r.price
                          ? drag.kind
                          : legMove && legMove.side === "sell" && legMove.from === r.price
                            ? legMove.kind
                            : undefined
                      }
                      reduce={!!reduce}
                    />
                    {drag && drag.side === "sell" && drag.to === r.price && drag.to !== drag.from && (
                      <DragGhost drag={drag} orders={orders} bid={bid} ask={ask} />
                    )}
                    {/* Setting a leg: a ghost of the tag it will become, where
                        it will sit — the connector meets it; a click makes it
                        real in place. */}
                    {previewLeg && bk && legCol === "sell" && (
                      <span className="tl-tag tl-tag--preview" data-side="sell" data-leg={previewLeg} aria-hidden="true">
                        <span className="tl-tag-q">{bk.qty.toLocaleString("en-US")}</span>
                        <span className="tl-tag-k">{previewLeg.toUpperCase()}</span>
                        <span className="tl-tag-x"><CloseIcon size={10} /></span>
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
            {rails.map((b) => (
              <BracketRail key={b.key} b={b} rowH={rowH} />
            ))}
          </div>
          <Scrollbar target={scrollRef} />
          {/* Mode banner: one line — what's being set, on what — and Cancel.
              A click on a price sends the leg, so no Place. */}
          <AnimatePresence>
            {pbActive && bk && (
              <motion.div
                className="tl-modebar tl-surface"
                role="status"
                initial={reduce ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6, transition: { duration: DURATION.instant } }}
                transition={{ duration: DURATION.fast, ease: EASING.standard }}
              >
                <BracketIcon />
                <b className="tl-modebar-t">
                  {/* The action alone (user, 2026-11-05): the subject is
                      already lit on the ladder. */}
                  {pb?.only === "sl" ? "Set stop" : pb?.only === "tp" ? "Set limit" : "Set TP/SL"}
                </b>
                <button type="button" className="tl-modebar-cancel" onClick={() => setPb(null)}>
                  Cancel
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {offscreen.map((t) => (
              <motion.button
                key={`${t.side}-${t.edge}`}
                type="button"
                className="tl-jump"
                data-side={t.side}
                data-edge={t.edge}
                aria-label={`Jump to your ${t.side} ${KIND_NAME[t.kind].toLowerCase()} at ${fmtPx(t.price)}${t.n > 1 ? `, ${t.n} orders ${t.edge === "top" ? "above" : "below"}` : ""}`}
                initial={reduce ? false : { opacity: 0, y: t.edge === "top" ? -4 : 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: DURATION.instant } }}
                transition={{ duration: DURATION.fast, ease: EASING.standard }}
                onClick={() => jumpTo(t.price)}
              >
                <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true" className="tl-jump-a">
                  <path
                    d={t.edge === "top" ? "M6 10V2M2.5 5.5 6 2l3.5 3.5" : "M6 2v8M2.5 6.5 6 10l3.5-3.5"}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="tl-jump-k">{t.leg ? t.leg.toUpperCase() : t.kind}</span>
              </motion.button>
            ))}
          </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ---------- footer ---------- */}
      <div className="tl-foot">
        <div className="tl-view" role="radiogroup" aria-label="Ladder shows">
          {(
            [
              ["price", "Price", "View the price at each level"],
              ["pnl", "P&L", "View the profit or loss at each level"],
            ] as const
          ).map(([id, label, aria]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={view === id}
              aria-label={aria}
              className="tl-view-btn"
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="tl-zoom">
          <button
            type="button"
            aria-label="Zoom out"
            disabled={zoom === 0}
            onClick={() => setZoom((z) => Math.max(0, z - 1))}
          >
            <ZoomIcon dir="out" />
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            disabled={zoom === DENSITY.length - 1}
            onClick={() => setZoom((z) => Math.min(DENSITY.length - 1, z + 1))}
          >
            <ZoomIcon dir="in" />
          </button>
        </div>
      </div>
    </section>
  );
}

/* ---------- parts ---------- */

function PnlLine({ label, value }: { label: string; value: number | null }) {
  if (value === null)
    return (
      <span className="tl-pnl-line">
        <span className="tl-pnl-v tl-pnl-none" data-dir="flat">
          <Tri dir="up" />
          --
        </span>
        <span className="tl-pnl-l" aria-label={`${label}: none`}>
          <span className="tl-l-full">{label}</span>
          <span className="tl-l-short" aria-hidden="true">{label.replace(" P&L", "")}</span>
        </span>
      </span>
    );
  const dir = dirOf(value);
  return (
    <span className="tl-pnl-line">
      <span className="tl-pnl-v" data-dir={dir}>
        {dir !== "flat" && <Tri dir={dir === "up" ? "up" : "down"} />}
        <span className="tl-l-full">
          <Rolling value={money(value)} />
        </span>
        {/* Narrow widget: five figures and up shorten ($29.6K) so the
            header keeps one line beside a full position pill. */}
        <span className="tl-l-short" aria-hidden="true">
          <Rolling value={moneyShort(value)} />
        </span>
      </span>
      {/* Full and short labels; the widget's width picks ("Open P&L" →
          "Open" when narrow, so the header holds one line). */}
      <span className="tl-pnl-l" aria-label={label}>
        <span className="tl-l-full">{label}</span>
        <span className="tl-l-short" aria-hidden="true">{label.replace(" P&L", "")}</span>
      </span>
    </span>
  );
}

/** A size cell is the click target for its side — the whole cell answers,
    the figure is only paint, as with the chain's bid and ask cells. */
function SizeCell({
  side,
  closing,
  size,
  max,
  depth,
  price,
  onHover,
  onPick,
}: {
  side: Side;
  /** On the position's level: whichever side is pointed at, stage this. */
  closing?: { side: Side; qty: number };
  size: number;
  max: number;
  /** Levels from the inside market — the bars fade with it. */
  depth: number;
  price: number;
  onHover: (d: Draft | null) => void;
  onPick: (d: Draft) => void;
}) {
  /* L2 colour logic: intensity reads distance from the touch, not
     size. Ten steps from the full accent at the best bid/ask down
     toward the ground; one row per price, so a price always keeps
     its step. Size stays on the bar's length. */
  const mix = `${100 - Math.min(Math.max(depth, 0), 9) * 9}%`;
  /* 10% steps of the deepest visible level, per the Figma. */
  const frac = size ? Math.min(1, Math.max(0.1, Math.ceil((size / max) * 10) / 10)) : 0;
  const d: Draft = closing ? { side: closing.side, price, qty: closing.qty } : { side, price };

  return (
    <button
      type="button"
      className={`tl-cell tl-size tl-size--${side}`}
      aria-label={
        closing
          ? `Stage a ${closing.side} for your whole position, ${closing.qty}, at ${fmtPx(price)}`
          : `Stage a ${side} order at ${fmtPx(price)}${size ? `, ${size.toLocaleString("en-US")} shares on the book` : ""}`
      }
      onMouseEnter={() => onHover(d)}
      onFocus={() => onHover(d)}
      onBlur={() => onHover(null)}
      onClick={() => onPick(d)}
    >
      {/* [track | size] — the bar packs against the price column inside
          its track; the size stands in its own fixed column on the outer
          edge, right-aligned, so the figures read down as a column (the
          user's L2 table, 2026-11-05). */}
      {/* The bar, flush to the price column; the size rides its far end
          in the side's colour (the platform's ladder). */}
      <span
        className="tl-bar"
        aria-hidden="true"
        style={{ "--f": frac, "--mix": mix, opacity: frac ? 1 : 0 } as React.CSSProperties}
      />
      <span className="tl-size-col" title={size ? `${size.toLocaleString("en-US")} shares` : undefined}>
        {size > 0 && <Rolling className="tl-size-v" value={fmtSize(size)} />}
      </span>
    </button>
  );
}

/** The trade-entry pill. On hover it says what a click would stage; once
    staged its label IS the send button, with × beside it. One element
    throughout, so the hover pill grows into the ticket. */
function TradePill({
  d,
  kind,
  staged,
  quick,
  qty,
  short = false,
  bracket = false,
  onBracket,
  onPlace,
  onSend,
  onCancel,
  reduce,
}: {
  d: Draft;
  kind: Kind;
  staged: boolean;
  /** One-click trading is on: a click sends, so the pill says so in the
      chain's "this click trades" recipe — solid, with the quantity. */
  quick: boolean;
  qty: number;
  /** A sell with no shares held: it opens a short, and says so. */
  short?: boolean;
  /** The hover pill: a click on it sends the order right away. */
  onPlace?: () => void;
  /** Bracket on for this draft, and its toggle (staged pill only). */
  bracket?: boolean;
  onBracket?: () => void;
  onSend: () => void;
  onCancel: () => void;
  reduce: boolean;
}) {
  const label = `${d.side === "buy" ? "Buy" : short ? "Short" : "Sell"} ${kind === "LMT" ? "limit" : "stop"}`;

  return (
    <motion.span
      /* No size tween: buy ↔ sell and row to row switch instantly (the
         spring read as lag). A short fade only on first appearance. */
      className="tl-pill"
      data-side={d.side}
      data-staged={staged ? "" : undefined}
      data-quick={quick ? "" : undefined}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.06 } }}
      transition={{ duration: 0.08 }}
      /* Staged, the whole pill submits — the platform's target — save
         its own small controls. */
      data-live={!staged && onPlace ? "" : undefined}
      onClick={
        staged
          ? (e) => {
              if ((e.target as HTMLElement).closest(".tl-pill-x, .tl-pill-br")) return;
              onSend();
            }
          : onPlace
            ? (e) => {
                e.stopPropagation();
                onPlace();
              }
            : undefined
      }
    >
      <span className="tl-pill-px">{fmtPx(d.price)}</span>
      {staged ? (
        <>
          {/* The label stays a real button for the keyboard; a click on it
              bubbles to the pill, which sends. */}
          <button type="button" className="tl-pill-send" autoFocus>
            {label} · {d.qty ?? qty}
          </button>
          {onBracket && (
            <button
              type="button"
              className="tl-pill-br"
              aria-pressed={bracket}
              aria-label={bracket ? "Remove bracket" : "Add bracket — take profit and stop loss"}
              title={bracket ? "Remove bracket" : "Add take profit + stop loss"}
              onClick={onBracket}
            >
              <BracketIcon />
            </button>
          )}
          <button type="button" className="tl-pill-x" aria-label="Discard" onClick={onCancel}>
            <CloseIcon />
          </button>
        </>
      ) : (
        /* The size rides every hover, not just one-click: you see what
           a click will stage before you make it. */
        <motion.span
          key={d.side}
          className="tl-pill-label"
          /* The label slides out from the pinned price toward its side. */
          initial={reduce ? false : { opacity: 0, x: d.side === "buy" ? 6 : -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.12, ease: EASING.standard }}
        >{`${label} · ${d.qty ?? qty}`}</motion.span>
      )}
    </motion.span>
  );
}

/** Your working orders at a level: a tag per order type, "1 LMT ×". */
function OrderTags({
  side,
  price,
  groups,
  onCancel,
  onGrab,
  onFocusTag,
  lifted,
  activeGroup,
  onLegHover,
  onLegSelect,
  onExit,
  bracketing,
  legsOf,
  reduce,
}: {
  /** Pointer or focus on a tag (true) / off it (false). */
  onFocusTag?: (on: boolean) => void;
  side: Side;
  price: number;
  groups: { kind: Kind; qty: number; leg?: Leg; held?: boolean; group?: number; id?: number }[];
  /** ⋮ on a working order: its menu — Cancel / Set stop / Set limit /
      Set TP/SL; which order is being set; which legs it already has. */
  onExit?: (id: number, only?: Leg) => void;
  bracketing?: number | null;
  legsOf?: (group?: number) => { tp: boolean; sl: boolean };
  /** The bracket group drawn active (hovered / selected). */
  activeGroup?: number | null;
  onLegHover?: (group: number, on: boolean) => void;
  onLegSelect?: (group: number) => void;
  onCancel: (side: Side, kind: Kind, price: number) => void;
  /** Press on a resting tag starts drag-to-reprice. */
  onGrab?: (kind: Kind, e: React.PointerEvent, leg?: { leg: Leg; group: number }) => void;
  /** The kind being dragged off this row — drawn as left behind. */
  lifted?: Kind;
  reduce: boolean;
}) {
  const [menu, setMenu] = useState<string | null>(null);
  useEffect(() => {
    if (!menu) return;
    const down = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest?.(".tl-omenu, .tl-tag-more")) setMenu(null);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [menu]);
  const x = (g: { kind: Kind; qty: number; leg?: Leg }) => (
    <button
      type="button"
      className="tl-tag-x"
      aria-label={`Cancel ${side} ${KIND_NAME[g.kind].toLowerCase()} ${g.qty} at ${fmtPx(price)}`}
      onClick={() => {
        onFocusTag?.(false);
        onCancel(side, g.kind, price);
      }}
    >
      <CloseIcon size={10} />
    </button>
  );
  return (
    <AnimatePresence initial={false}>
      {groups.map((g) => (
        <motion.span
          key={`${g.kind}-${g.leg ?? ""}-${g.held ? 1 : 0}`}
          /* A pending market order follows the touch; sharing one layoutId
             per side makes it slide level to level on the spot-line spring
             instead of blinking out of one row and into another. */
          layoutId={g.kind === "MKT" ? `tl-mkt-${side}` : undefined}
          className="tl-tag"
          data-side={side}
          /* Three-digit sizes take the compact form (12px, × on hover)
             so the tag stays inside its column. */
          data-wide={g.qty >= 100 || undefined}
          data-grab={g.kind !== "MKT" && onGrab ? "" : undefined}
          data-lifted={lifted === g.kind || undefined}
          data-leg={g.leg}
          data-held={g.held || undefined}
          title={
            g.held
              ? `${g.leg === "tp" ? "Take profit" : "Stop loss"} — waits until the entry fills; drag to change`
              : g.kind !== "MKT"
                ? "Drag to change the price"
                : undefined
          }
          onPointerDown={
            onGrab ? (e) => onGrab(g.kind, e, g.leg && g.group != null ? { leg: g.leg, group: g.group } : undefined) : undefined
          }
          onPointerEnter={() => {
            onFocusTag?.(true);
            if (g.leg && g.group != null) onLegHover?.(g.group, true);
          }}
          onPointerLeave={() => {
            onFocusTag?.(false);
            if (g.leg && g.group != null) onLegHover?.(g.group, false);
          }}
          onClick={g.leg && g.group != null ? (e) => !(e.target as HTMLElement).closest(".tl-tag-x") && onLegSelect?.(g.group!) : undefined}
          data-active={
            (g.leg && g.group != null && g.group === activeGroup) || (g.id != null && g.id === bracketing) ? "" : undefined
          }
          onFocus={() => onFocusTag?.(true)}
          onBlur={() => onFocusTag?.(false)}
          initial={reduce ? false : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8, transition: { duration: DURATION.fast } }}
          transition={
            reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 30, layout: LADDER_SPRING }
          }
        >
          {/* × on the tag's outer edge: left of a buy, right of a sell. */}
          {side === "buy" && x(g)}
          <span className="tl-tag-q">
            <Rolling value={String(g.qty)} />
          </span>
          <span className="tl-tag-k">{g.leg ? g.leg.toUpperCase() : g.kind}</span>
          {/* ⋮ on a working limit/stop: the position's menu pattern. */}
          {onExit && !g.leg && g.kind !== "MKT" && g.id != null && (
            <button
              type="button"
              className="tl-tag-x tl-tag-more"
              aria-haspopup="menu"
              aria-expanded={menu === `${g.kind}-${g.id}`}
              aria-label="Order actions"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setMenu((m) => (m === `${g.kind}-${g.id}` ? null : `${g.kind}-${g.id}`));
              }}
            >
              <MoreIcon />
            </button>
          )}
          <AnimatePresence>
            {onExit && g.id != null && menu === `${g.kind}-${g.id}` && (
              <motion.span
                role="menu"
                className="tl-ptag-menu tl-omenu tl-surface"
                data-edge={side === "buy" ? "left" : "right"}
                initial={reduce ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: DURATION.instant } }}
                transition={{ duration: DURATION.fast, ease: EASING.standard }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  role="menuitem"
                  className="tl-ptag-mi"
                  autoFocus
                  onClick={() => {
                    setMenu(null);
                    onFocusTag?.(false);
                    onCancel(side, g.kind, price);
                  }}
                >
                  <span>Cancel order</span>
                  <span className="tl-ptag-mi-s">
                    {side === "buy" ? "Buy" : "Sell"} {g.qty} {KIND_NAME[g.kind].toLowerCase()} @ {fmtPx(price)}
                  </span>
                </button>
                {(() => {
                  const has = legsOf?.(g.group) ?? { tp: false, sl: false };
                  return (
                    [
                      { label: "Set stop", only: "sl" as Leg, off: has.sl },
                      { label: "Set limit", only: "tp" as Leg, off: has.tp },
                      { label: "Set TP/SL", only: undefined, off: has.tp || has.sl },
                    ] as const
                  ).map((it) => (
                    <button
                      key={it.label}
                      type="button"
                      role="menuitem"
                      className="tl-ptag-mi"
                      aria-disabled={it.off || undefined}
                      data-off={it.off || undefined}
                      onClick={
                        it.off
                          ? undefined
                          : () => {
                              setMenu(null);
                              onExit(g.id!, it.only);
                            }
                      }
                    >
                      <span>{it.label}</span>
                      {it.off && <span className="tl-ptag-mi-s">{it.only ? "Already set" : "A leg is already set"}</span>}
                    </button>
                  ));
                })()}
              </motion.span>
            )}
          </AnimatePresence>
          {side === "sell" && x(g)}
        </motion.span>
      ))}
    </AnimatePresence>
  );
}

type LegPillSpec = {
  key: string;
  side: Side;
  leg: Leg;
  price: number;
  qty: number;
  pnl: number;
  label: string;
  onSend: () => void;
  onCancel: () => void;
  onGrab: (e: React.PointerEvent) => void;
};

/** A bracket leg being set, in the staged-order pill: price | label ·
    size and its dollar result (the send) | ×. Drag the pill to move it. */
function LegPill({
  side,
  leg,
  price,
  qty,
  pnl,
  label,
  onSend,
  onCancel,
  onGrab,
  reduce,
  preview = false,
}: Omit<LegPillSpec, "key"> & { reduce: boolean; preview?: boolean }) {
  const downAt = useRef<{ x: number; y: number } | null>(null);
  return (
    <motion.span
      className="tl-pill tl-pill--leg"
      data-side={side}
      data-leg={leg}
      data-staged={preview ? undefined : ""}
      data-preview={preview || undefined}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.06 } }}
      transition={{ duration: 0.08 }}
      title={preview ? undefined : "Click to place · drag to move"}
      onPointerDown={(e) => {
        downAt.current = { x: e.clientX, y: e.clientY };
        if ((e.target as HTMLElement).closest(".tl-pill-x")) return;
        onGrab(e);
      }}
      onClick={(e) => {
        if (preview || (e.target as HTMLElement).closest(".tl-pill-x")) return;
        /* A drag ends in a click too — only a press that stayed put places. */
        const d = downAt.current;
        if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 3) return;
        onSend();
      }}
    >
      <span className="tl-pill-px">{fmtPx(price)}</span>
      {preview ? (
        <span className="tl-pill-label">
          {label} · {qty.toLocaleString("en-US")}{" "}
          <span className="tl-leg-pnl" data-dir={dirOf(pnl)}>
            {fmtUsd(pnl)}
          </span>
        </span>
      ) : (
        <>
          <button type="button" className="tl-pill-send" title="Place">
            {label} · {qty.toLocaleString("en-US")}{" "}
            <span className="tl-leg-pnl" data-dir={dirOf(pnl)}>
              {fmtUsd(pnl)}
            </span>
          </button>
          <button type="button" className="tl-pill-x" aria-label={`Remove ${label.toLowerCase()}`} onClick={onCancel}>
            <CloseIcon />
          </button>
        </>
      )}
    </motion.span>
  );
}

type RailSpec = {
  key: string;
  side: Side;
  entry: number;
  tp?: number;
  sl?: number;
  rr: number;
  draft: boolean;
  chip?: boolean;
  /** Where it runs: the legs' tag column (placed), or the price column
      beside the pills (bracket mode). */
  anchor?: "tags" | "price";
  /** Resting state: dimmer, no ticks. */
  quiet?: boolean;
  /** The entry is a working order (no position line on its row): draw a
      link along the row from its price to the connector. */
  orderEntry?: boolean;
};

/** The bracket's rail: a hairline joining TP, entry and SL at the inner
    edge of the legs' tag column, with ticks to each and the
    reward-to-risk at the entry. */
function BracketRail({ b, rowH }: { b: RailSpec; rowH: number }) {
  const y = (i: number) => i * rowH + rowH / 2;
  const pts = [b.entry, b.tp, b.sl].filter((v): v is number => v != null);
  const top = Math.min(...pts);
  const bot = Math.max(...pts);
  /* In the tag column the line meets the tags edge-on: it stops at the
     top (or bottom) of a leg's tag, half a tag short of the row centre. */
  const inTags = (b.anchor ?? "tags") === "tags";
  const half = inTags ? 10 : 0;
  const t0 = y(top) + (top !== b.entry ? half : 0);
  const t1 = y(bot) - (bot !== b.entry ? half : 0);
  return (
    <span
      className="tl-rail"
      data-side={b.side}
      data-draft={b.draft || undefined}
      data-anchor={b.anchor ?? "tags"}
      data-quiet={b.quiet || undefined}
      style={{ top: t0, height: Math.max(0, t1 - t0) }}
      aria-hidden="true"
    >
      {!inTags &&
        (["tp", "sl"] as Leg[])
          .filter((leg) => b[leg] != null)
          .map((leg) => (
            <span key={leg} className="tl-rail-tick" data-leg={leg} style={{ top: y(b[leg]!) - t0 }} />
          ))}
      {b.orderEntry && <span className="tl-rail-entryline" style={{ top: y(b.entry) - t0 }} />}
      <span className="tl-rail-entry" style={{ top: y(b.entry) - t0 }}>
        {!!b.chip && (
          <span className="tl-rail-rr" title="Reward : risk — what the take profit makes for each $1 the stop risks">
            1 : {b.rr.toFixed(1)}
          </span>
        )}
      </span>
    </span>
  );
}

/** Where a dragged tag will land: the tag itself at the new row, plus a
    readout — new price, the move in cents, and the kind there. */
function DragGhost({
  drag,
  orders,
  bid,
  ask,
}: {
  drag: { side: Side; kind: Kind; from: number; to: number };
  orders: Order[];
  bid: number;
  ask: number;
}) {
  const qty = orders
    .filter((o) => colOf(o, orders) === drag.side && o.kind === drag.kind && o.price === drag.from)
    .reduce((n, o) => n + o.qty, 0);
  const kind = kindFor({ side: drag.side, price: drag.to }, bid, ask);
  const cents = Math.round((drag.to - drag.from) * 100);
  return (
    <span className="tl-ghost" data-side={drag.side} aria-live="polite">
      <span className="tl-tag tl-tag--ghost" data-side={drag.side} data-flip={kind !== drag.kind || undefined}>
        <span className="tl-tag-q">{qty}</span>
        <span className="tl-tag-k">{kind}</span>
      </span>
      <span className="tl-ghost-read">
        <b>{fmtPx(drag.to)}</b>
        <span>
          {cents > 0 ? "+" : "−"}
          {Math.abs(cents)}¢
        </span>
        {kind !== drag.kind && <span className="tl-ghost-flip">becomes {KIND_NAME[kind].toLowerCase()}</span>}
      </span>
    </span>
  );
}

/** The reference's hover hint: a translucent, blurred card under the
    control — what it does on the left, its shortcut on the right. Opens
    after a short rest so it does not flash as the pointer passes. */
function Hint({
  text,
  keys,
  sticky = false,
  children,
}: {
  text: string;
  keys?: string;
  /** Also opens on press, not just hover — touch has no hover. */
  sticky?: boolean;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const show = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), 350);
  };
  const hide = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setOpen(false);
  };
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), []);

  return (
    <span
      className="tl-hint-host"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onPointerDown={sticky ? () => setOpen(true) : undefined}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            className="tl-hint tl-surface"
            initial={reduce ? false : { opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: DURATION.instant } }}
            transition={{ duration: DURATION.fast, ease: EASING.standard }}
          >
            <span className="tl-hint-text">{text}</span>
            {keys && <span className="tl-hint-keys">{keys}</span>}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/** "2 open orders", and on hover or focus a panel listing them — status,
    side, type, quantity, price, submitted — with a Cancel on the row under
    the pointer. Laid out after the platform's Recent orders table; built
    on the chain's menu surface and row hover.

    Hover is forgiving: the panel closes 140ms after the pointer leaves
    both trigger and panel, so crossing the gap between them never drops
    it. */
function OpenOrders({
  orders,
  onCancel,
  onReplace,
  onFill,
  onCancelAll,
  short = false,
  icon = false,
  morph,
}: {
  orders: Order[];
  onCancel: (id: number) => void;
  onReplace: (id: number, next: { qty: number; price: number }) => void;
  /** Review aid: fill this order now. */
  onFill?: (id: number) => void;
  onCancelAll: () => void;
  /** Pill label: "2 orders" rather than "2 open orders". */
  short?: boolean;
  /** Icon mode: an icon trigger; hover opens the panel, as the pills do. */
  icon?: boolean;
  /** Pill → icon: an icon that opens into its labelled pill on hover;
      a click (not hover) opens the panel. */
  morph?: boolean;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  /** The row whose ⋮ menu is open, and the row being replaced. */
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const timer = useRef<number | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  /* Pill → icon: hover opens the label; the panel waits for a click and
     stays until a click elsewhere (or Esc). */
  const [peek, setPeek] = useState(false);
  useEffect(() => {
    if (!morph || !open) return;
    const down = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) hide(0);
    };
    window.addEventListener("pointerdown", down);
    return () => window.removeEventListener("pointerdown", down);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [morph, open]);
  /* An edit in progress holds the panel open — leaving it mid-type
     would throw the change away. */
  const busy = useRef(false);
  busy.current = editing != null;

  const show = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = (delay = 140) => {
    if (timer.current) window.clearTimeout(timer.current);
    if (busy.current) return;
    timer.current = window.setTimeout(() => {
      setOpen(false);
      setMenuFor(null);
    }, delay);
  };
  /* A row that has gone (filled, cancelled) can't stay open for edit. */
  useEffect(() => {
    if (editing != null && !orders.some((o) => o.id === editing)) setEditing(null);
    if (menuFor != null && !orders.some((o) => o.id === menuFor)) setMenuFor(null);
  }, [orders, editing, menuFor]);
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      /* Escape peels one layer: menu, then edit, then the panel. */
      if (menuFor != null) setMenuFor(null);
      else if (editing != null) setEditing(null);
      else setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, menuFor, editing]);

  /* Newest first, as the reference lists them. */
  const rows = [...orders].sort((a, b) => b.at - a.at);
  const n = orders.length;

  return (
    <div
      ref={root}
      className="tl-oo"
      data-icon={icon || undefined}
      onMouseEnter={morph ? () => setPeek(true) : show}
      onMouseLeave={morph ? () => setPeek(false) : () => hide()}
      onFocus={morph ? () => setPeek(true) : show}
      onBlur={(e) => {
        if (root.current?.contains(e.relatedTarget as Node)) return;
        setPeek(false);
        hide(0);
      }}
      onPointerDown={(e) => {
        /* A press anywhere in the panel off the menu closes the menu. */
        if (!(e.target as HTMLElement).closest(".tl-oo-more, .tl-oo-menu")) setMenuFor(null);
      }}
    >
      <button
        type="button"
        className={morph ? "tl-morph tl-oo-trigger" : icon ? "tl-ico-btn tl-oo-trigger" : "tl-posn-o tl-oo-trigger"}
        data-morph={morph ? (peek || open ? "open" : "icon") : undefined}
        onClick={morph ? () => (open ? hide(0) : show()) : undefined}
        aria-label={`${n} open order${n > 1 ? "s" : ""}`}
        aria-expanded={open}
        aria-controls="tl-oo-panel"
        data-open={open ? "" : undefined}
      >
        {morph ? (
          <>
            <OrdersIcon n={n} />
            <span className="tl-morph-l" aria-hidden={!(peek || open) || undefined}>
              <span className="tl-morph-t">{n} order{n > 1 ? "s" : ""}</span>
            </span>
          </>
        ) : icon ? (
          <>
            <OrdersIcon n={n} />
          </>
        ) : short ? (
          <>
            <svg className="tl-pill-ico" width={12} height={12} viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2 3h8M2 6h8M2 9h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <span className="tl-pill-n">{n}</span>
            <span className="tl-pill-word"> order{n > 1 ? "s" : ""}</span>
          </>
        ) : (
          <>
            {n} open order{n > 1 ? "s" : ""}
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="tl-oo-panel"
            className="tl-oo-panel"
            role="dialog"
            aria-label="Open orders"
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: DURATION.instant } }}
            transition={{ duration: DURATION.fast, ease: EASING.standard }}
          >
            <div className="tl-oo-card tl-surface">
              <div className="tl-oo-title">
                <span>Open orders</span>
                <button type="button" className="tl-oo-all" onClick={onCancelAll}>
                  Cancel all
                </button>
              </div>

              <div className="tl-oo-grid tl-oo-head" aria-hidden="true">
                <span className="tl-oo-c-status">Status</span>
                <span>Side</span>
                <span>Type</span>
                <span className="tl-oo-r">Qty</span>
                <span className="tl-oo-r">Price</span>
                <span className="tl-oo-time">Submitted</span>
                <span />
              </div>

              <AnimatePresence initial={false}>
                {rows.map((o) =>
                  editing === o.id ? (
                    <ReplaceRow
                      key={o.id}
                      order={o}
                      onDone={() => setEditing(null)}
                      onSubmit={(next) => {
                        onReplace(o.id, next);
                        setEditing(null);
                      }}
                    />
                  ) : (
                    <motion.div
                      key={o.id}
                      className="tl-oo-grid tl-oo-row"
                      data-menu={menuFor === o.id ? "" : undefined}
                      initial={reduce ? false : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 36 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: DURATION.base, ease: EASING.standard }}
                    >
                      <span className="tl-oo-c-status">
                        <span className="tl-oo-status">{o.held ? "Held" : o.kind === "MKT" ? "Queued" : "Working"}</span>
                      </span>
                      <span className="tl-oo-side" data-side={o.side}>
                        {o.side === "buy" ? "Buy" : "Sell"}
                      </span>
                      <span title={o.leg ? "Bracket leg" : undefined}>
                        {o.leg === "tp" ? "Take profit" : o.leg === "sl" ? "Stop loss" : KIND_NAME[o.kind]}
                      </span>
                      <span className="tl-oo-r">{o.qty}</span>
                      <span className="tl-oo-r">{o.kind === "MKT" ? "—" : fmtPx(o.price)}</span>
                      <span className="tl-oo-time">{fmtTime(o.at)}</span>
                      <span className="tl-oo-act">
                        <button
                          type="button"
                          className="tl-oo-cancel"
                          aria-label={`Cancel ${o.side} ${KIND_NAME[o.kind].toLowerCase()} ${o.qty}${o.kind === "MKT" ? "" : ` at ${fmtPx(o.price)}`}`}
                          onClick={() => onCancel(o.id)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="tl-oo-more"
                          aria-label="More actions"
                          aria-haspopup="menu"
                          aria-expanded={menuFor === o.id}
                          onClick={() => setMenuFor((m) => (m === o.id ? null : o.id))}
                        >
                          <MoreIcon />
                        </button>
                        <AnimatePresence>
                          {menuFor === o.id && (
                            <motion.div
                              role="menu"
                              className="tl-oo-menu tl-surface"
                              initial={reduce ? false : { opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, transition: { duration: DURATION.instant } }}
                              transition={{ duration: DURATION.fast, ease: EASING.standard }}
                            >
                              <button
                                type="button"
                                role="menuitem"
                                className="tl-oo-mi"
                                autoFocus
                                onClick={() => {
                                  setMenuFor(null);
                                  setEditing(o.id);
                                }}
                              >
                                Replace
                              </button>
                              {onFill && !o.held && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="tl-oo-mi"
                                  title="Prototype aid: fill this order now, at its price"
                                  onClick={() => {
                                    setMenuFor(null);
                                    onFill(o.id);
                                  }}
                                >
                                  Simulate fill
                                </button>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </span>
                    </motion.div>
                  ),
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A row in replace mode: size and (for a resting order) price become
    fields in their own columns, and the actions become Replace and ×.
    Enter replaces, Escape (via the panel) or × discards; ↑/↓ nudge the
    field a share or a tick. Replace stays off until something changed. */
function ReplaceRow({
  order: o,
  onSubmit,
  onDone,
}: {
  order: Order;
  onSubmit: (next: { qty: number; price: number }) => void;
  onDone: () => void;
}) {
  const [qty, setQty] = useState(String(o.qty));
  const [px, setPx] = useState(o.price.toFixed(2));
  const q = parseInt(qty, 10);
  const p = parseFloat(px);
  const valid = q >= 1 && (o.kind === "MKT" || p > 0);
  const changed = q !== o.qty || (o.kind !== "MKT" && Math.abs(p - o.price) > 1e-9);
  const ok = valid && changed;
  const submit = () => ok && onSubmit({ qty: q, price: o.kind === "MKT" ? o.price : p });
  const nudge = (e: React.KeyboardEvent, field: "qty" | "px") => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
      return;
    }
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const d = e.key === "ArrowUp" ? 1 : -1;
    if (field === "qty") setQty(String(Math.max(1, (q || 0) + d)));
    else setPx(Math.max(TICK, +((p || o.price) + d * TICK).toFixed(2)).toFixed(2));
  };

  return (
    <div className="tl-oo-grid tl-oo-row tl-oo-edit" style={{ height: 36 }}>
      <span className="tl-oo-c-status">
        <span className="tl-oo-status">Replacing</span>
      </span>
      <span className="tl-oo-side" data-side={o.side}>
        {o.side === "buy" ? "Buy" : "Sell"}
      </span>
      <span>{KIND_NAME[o.kind]}</span>
      <input
        className="tl-oo-in tl-oo-r"
        inputMode="numeric"
        aria-label="New quantity"
        autoFocus
        value={qty}
        onChange={(e) => setQty(e.target.value.replace(/\D/g, "").slice(0, 3))}
        onKeyDown={(e) => nudge(e, "qty")}
        onFocus={(e) => e.currentTarget.select()}
      />
      {o.kind === "MKT" ? (
        <span className="tl-oo-r">—</span>
      ) : (
        <input
          className="tl-oo-in tl-oo-r"
          inputMode="decimal"
          aria-label="New price"
          value={px}
          onChange={(e) => setPx(e.target.value.replace(/[^\d.]/g, ""))}
          onKeyDown={(e) => nudge(e, "px")}
          onBlur={() => Number.isFinite(p) && setPx((Math.round(p / TICK) * TICK).toFixed(2))}
          onFocus={(e) => e.currentTarget.select()}
        />
      )}
      <span className="tl-oo-time">{fmtTime(o.at)}</span>
      <span className="tl-oo-act tl-oo-act--on">
        <button type="button" className="tl-oo-cancel" disabled={!ok} onClick={submit}>
          Replace
        </button>
        <button type="button" className="tl-oo-more" aria-label="Discard changes" onClick={onDone}>
          <CloseIcon />
        </button>
      </span>
    </div>
  );
}

/** The position on its line: size and live open P&L, and × to close it.
    × waits for intent like any ladder control — its tooltip says exactly
    what a click sends (side, size, market or limit) before it does. */
function PosTag({
  pos,
  pnl,
  edge,
  blocked,
  note,
  onClose,
  bracket = "off",
  onExit,
  rr,
  mode,
  onStop,
  has,
  reduce,
}: {
  /** Which exits the position already has working. */
  has?: { tp: boolean; sl: boolean };
  /** While setting: "Set stop" etc., and the way out. */
  mode?: string;
  onStop?: () => void;
  /** Reward : risk of the drafted bracket. */
  rr?: number;
  pos: Position;
  pnl: number;
  edge: "left" | "right";
  blocked: boolean;
  note: string;
  onClose: () => void;
  /** off: none yet · draft: being set · live: has one. */
  bracket?: "off" | "draft" | "live";
  onBracket?: () => void;
  onPlaceBracket?: () => void;
  /** Set stop (sl) / Set limit (tp) / Set TP/SL (undefined). */
  onExit?: (only?: Leg) => void;
  reduce: boolean;
}) {
  /* The tag is the position's menu: click it for Close / Set stop / Set
     limit / Set TP/SL — the platform's position actions. */
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const n = Math.abs(pos.qty);
  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <motion.span
      ref={root}
      /* No layout animation: the P&L's changing width would nudge the tag
         (and its open menu) every tick. */
      className="tl-ptag"
      data-edge={edge}
      data-active={open || undefined}
      /* Setting legs: the banner names the position, so the tag steps
         out of the way of the connector, ghosts and hints. */
      data-away={bracket === "draft" || undefined}
    >
      {bracket === "draft" ? (
        <>
          <span className="tl-tag-q">
            {pos.qty > 0 ? "+" : "−"}
            {n.toLocaleString("en-US")}
          </span>
          <span className="tl-ptag-pnl" data-dir={dirOf(pnl)}>
            {fmtUsd(pnl)}
          </span>
        </>
      ) : (
        <>
          <span className="tl-tag-q">
            {pos.qty > 0 ? "+" : "−"}
            {n.toLocaleString("en-US")}
          </span>
          <span className="tl-ptag-pnl" data-dir={dirOf(pnl)}>
            {fmtUsd(pnl)}
          </span>
          {/* Only the dots open the position's actions. */}
          <button
            type="button"
            className="tl-ptag-btn tl-ptag-more"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={`Position ${pos.qty > 0 ? "+" : "−"}${n} actions`}
            onClick={() => setOpen((o) => !o)}
          >
            <MoreIcon />
          </button>
        </>
      )}
      <AnimatePresence>
        {open && (
          <motion.span
            role="menu"
            className="tl-ptag-menu tl-surface"
            data-edge={edge}
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: DURATION.instant } }}
            transition={{ duration: DURATION.fast, ease: EASING.standard }}
          >
            <button
              type="button"
              role="menuitem"
              className="tl-ptag-mi"
              aria-disabled={blocked || undefined}
              data-off={blocked || undefined}
              autoFocus
              onClick={blocked ? undefined : pick(onClose)}
            >
              <span>Close position</span>
              <span className="tl-ptag-mi-s">{note}</span>
            </button>
            {onExit && (
              <>
                {/* Always listed; a leg already working greys its option
                    (and TP/SL once either is set) — the other stays open
                    and joins the same one-cancels-other pair. */}
                {(
                  [
                    { label: "Set stop", only: "sl" as Leg, off: !!has?.sl },
                    { label: "Set limit", only: "tp" as Leg, off: !!has?.tp },
                    { label: "Set TP/SL", only: undefined, off: !!has?.tp || !!has?.sl },
                  ] as const
                ).map((it) => (
                  <button
                    key={it.label}
                    type="button"
                    role="menuitem"
                    className="tl-ptag-mi"
                    aria-disabled={it.off || undefined}
                    data-off={it.off || undefined}
                    onClick={it.off ? undefined : pick(() => onExit(it.only))}
                  >
                    <span>{it.label}</span>
                    {it.off && <span className="tl-ptag-mi-s">{it.only ? "Already set" : "A leg is already set"}</span>}
                  </button>
                ))}
              </>
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.span>
  );
}

/** Shares owned: a filled disc with a check knocked out — the platform's
    owned badge. Short: the same disc with a minus. */
function OwnedIcon({ short }: { short: boolean }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true" focusable={false}>
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      {/* Knock-out in the plate's colour (CSS, so it tracks hover —
          SVG attributes don't resolve CSS variables). */}
      {short ? (
        <path d="M4.75 8h6.5" className="tl-knock" strokeWidth="1.8" strokeLinecap="round" />
      ) : (
        <path
          d="m4.6 8.2 2.3 2.3 4.5-4.6"
          fill="none"
          className="tl-knock"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/** Open orders: a ring with the count inside (9+ past nine). */
function OrdersIcon({ n }: { n: number }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true" focusable={false}>
      <circle cx="8" cy="8" r="6.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text
        x="8"
        y="8"
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
        style={{ font: `700 ${n > 9 ? 6.5 : 8.5}px Inter, sans-serif` }}
      >
        {n > 9 ? "9+" : n}
      </text>
    </svg>
  );
}

/** "+50 @ 118.42", and on hover or focus a panel for the position — the
    open-orders panel's twin (same glass, table and forgiving hover): the
    symbol, size, average, last and P&L, with Close to trade out of it. */
function PositionPanel({
  pos,
  last,
  openPnl,
  dayPnl,
  closeBlocked,
  closeNote,
  onClose,
  icon = false,
  morph,
}: {
  pos: Position;
  last: number;
  openPnl: number;
  dayPnl: number;
  closeBlocked: boolean;
  closeNote?: string;
  onClose: () => void;
  /** Icon mode: the owned badge; hover opens the panel, as the pills do. */
  icon?: boolean;
  /** Pill → icon: an icon that opens into its labelled pill on hover;
      a click (not hover) opens the panel. */
  morph?: boolean;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  /* Pill → icon: hover opens the label; the panel waits for a click and
     stays until a click elsewhere (or Esc). */
  const [peek, setPeek] = useState(false);
  useEffect(() => {
    if (!morph || !open) return;
    const down = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) hide(0);
    };
    window.addEventListener("pointerdown", down);
    return () => window.removeEventListener("pointerdown", down);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [morph, open]);
  const show = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = (delay = 140) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), delay);
  };
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const n = Math.abs(pos.qty);
  const long = pos.qty > 0;

  return (
    <div
      ref={root}
      className="tl-oo tl-pp"
      data-icon={icon || undefined}
      onMouseEnter={morph ? () => setPeek(true) : show}
      onMouseLeave={morph ? () => setPeek(false) : () => hide()}
      onFocus={morph ? () => setPeek(true) : show}
      onBlur={(e) => {
        if (root.current?.contains(e.relatedTarget as Node)) return;
        setPeek(false);
        hide(0);
      }}
    >
      <button
        type="button"
        className={morph ? "tl-morph tl-pp-trigger" : icon ? "tl-ico-btn tl-pp-trigger" : "tl-posn-v tl-pp-trigger"}
        data-morph={morph ? (peek || open ? "open" : "icon") : undefined}
        onClick={morph ? () => (open ? hide(0) : show()) : undefined}
        aria-label={`Position ${long ? "+" : "−"}${n.toLocaleString("en-US")} at ${fmtPx(pos.avg)}`}
        aria-expanded={open}
        aria-controls="tl-pp-panel"
        data-open={open ? "" : undefined}
      >
        {morph ? (
          <>
            <OwnedIcon short={!long} />
            <span className="tl-morph-l" aria-hidden={!(peek || open) || undefined}>
              <span className="tl-morph-t">
                <span className="tl-pp-q" data-side={long ? "buy" : "sell"}>
                  {long ? "+" : "−"}
                  {n.toLocaleString("en-US")}
                </span>
                <span className="tl-pp-at"> @ {fmtPx(pos.avg)}</span>
              </span>
            </span>
          </>
        ) : icon ? (
          <>
            <OwnedIcon short={!long} />
          </>
        ) : (
          <>
            <span className="tl-pp-q" data-side={long ? "buy" : "sell"}>
              {long ? "+" : "−"}
              {n.toLocaleString("en-US")}
            </span>
            <span className="tl-pp-at"> @ {fmtPx(pos.avg)}</span>
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="tl-pp-panel"
            className="tl-oo-panel"
            role="dialog"
            aria-label="Position"
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: DURATION.instant } }}
            transition={{ duration: DURATION.fast, ease: EASING.standard }}
          >
            <div className="tl-oo-card tl-surface">
              <div className="tl-oo-title">
                <span>Position</span>
                {closeNote && <span className="tl-pp-note">{closeNote}</span>}
              </div>
              <div className="tl-pp-grid tl-oo-head" aria-hidden="true">
                <span>Symbol</span>
                <span className="tl-oo-r">Qty</span>
                <span className="tl-oo-r">Avg price</span>
                <span className="tl-oo-r tl-pp-c-last">Last</span>
                <span className="tl-oo-r">Open P&L</span>
                <span className="tl-oo-r tl-pp-c-day">Day P&L</span>
                <span />
              </div>
              <div className="tl-pp-grid tl-oo-row tl-pp-row">
                <span className="tl-pp-sym">{SYMBOL}</span>
                <span className="tl-oo-r tl-oo-side" data-side={long ? "buy" : "sell"}>
                  {long ? "+" : "−"}
                  {n.toLocaleString("en-US")}
                </span>
                <span className="tl-oo-r">{fmtPx(pos.avg)}</span>
                <span className="tl-oo-r tl-pp-c-last">{fmtPx(last)}</span>
                <span className="tl-oo-r tl-pp-pnl" data-dir={dirOf(openPnl)}>
                  {fmtUsd(openPnl)}
                </span>
                <span className="tl-oo-r tl-pp-pnl tl-pp-c-day" data-dir={dirOf(dayPnl)}>
                  {fmtUsd(dayPnl)}
                </span>
                <span className="tl-oo-act">
                  <button
                    type="button"
                    className="tl-oo-cancel"
                    aria-disabled={closeBlocked || undefined}
                    data-off={closeBlocked || undefined}
                    aria-label={`Close position: ${long ? "sell" : "buy"} ${n} ${SYMBOL}${closeNote ? `. ${closeNote}` : ""}`}
                    onClick={() => !closeBlocked && onClose()}
                  >
                    Close
                  </button>
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** "Nov 4 20:55:50", the reference's submitted stamp. */
function fmtTime(t: number) {
  const d = new Date(t);
  const md = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const hms = d.toLocaleTimeString("en-GB", { hour12: false });
  return `${md} ${hms}`;
}

/* ---------- glyphs: the house 16-unit grid, 1.6 stroke ---------- */

const stroke = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

function CloseIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...stroke}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

/** Solid triangle — the reference's P&L and change marker. */
function Tri({ dir }: { dir: "up" | "down" }) {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true" focusable={false}>
      <path d={dir === "up" ? "M1.5 10 6 2.5l4.5 7.5h-9Z" : "M10.5 2 6 9.5 1.5 2h9Z"} fill="currentColor" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width={16} height={16} {...stroke} strokeWidth={1.6}>
      <circle cx="7.2" cy="7.2" r="4.8" />
      <path d="M10.8 10.8 14 14" />
    </svg>
  );
}

/** Bracket — a square bracket: the take profit and stop loss either side
    of the entry. */
function BracketIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden="true" focusable={false}>
      <path d="M10 2.5h3v11h-3M6 8h7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="4.5" cy="8" r="1.8" fill="currentColor" />
    </svg>
  );
}

/** Lightning — one-click trading. A filled glyph on the stroke grid, so
    it reads as "on" by its plate rather than by a heavier line. */
function BoltIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden="true" focusable={false}>
      <path d="M9.2 1.6 3.6 9h4l-1 5.4L12.4 7h-4l.8-5.4Z" fill="currentColor" />
    </svg>
  );
}

/** Three dots, vertical — the reference's overflow menu. */
function MoreIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable={false}>
      <circle cx="8" cy="3.5" r="1.35" />
      <circle cx="8" cy="8" r="1.35" />
      <circle cx="8" cy="12.5" r="1.35" />
    </svg>
  );
}

/** Circle with a slash — "nothing", which is what flattening leaves. */
/** Flatten — two arrows closing on a level line: the position collapses
    to flat. Not ⊘: the platform keeps the slashed circle for
    "unavailable" (market closed for that symbol), so Flatten needs a
    glyph of its own (user, 2026-11-05). */
export function FlattenIcon() {
  return (
    <svg width={14} height={14} {...stroke}>
      <path d="M2.5 8h11" />
      <path d="M8 1.75v3.75M5.75 3.5 8 5.5l2.25-2" />
      <path d="M8 14.25V10.5M5.75 12.5 8 10.5l2.25 2" />
    </svg>
  );
}

/** The platform's slashed circle — its Flatten glyph, which it also uses
    for "unavailable". Kept only to reproduce the current treatment. */
export function SlashIcon() {
  return (
    <svg width={14} height={14} {...stroke}>
      <circle cx="8" cy="8" r="5.6" />
      <path d="M4 12 12 4" />
    </svg>
  );
}

/** The ticker pill's magnifier, with a minus or a plus in its lens. */
function ZoomIcon({ dir }: { dir: "in" | "out" }) {
  return (
    <svg width={14} height={14} {...stroke}>
      <circle cx="7.2" cy="7.2" r="4.4" />
      <path d="M10.6 10.6 13.6 13.6" />
      <path d="M5.4 7.2h3.6" />
      {dir === "in" && <path d="M7.2 5.4v3.6" />}
    </svg>
  );
}

/* ---------- scrollbar ---------- */

/** An overlay bar on the ladder's right edge, in place of the native one
    (hidden, so the grid keeps its full width). It shows while you hover
    the ladder or scroll, and fades out after; drag the thumb, or press
    the track to page toward the pointer. */
function Scrollbar({ target }: { target: React.RefObject<HTMLDivElement | null> }) {
  const track = useRef<HTMLSpanElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);
  const [dragging, setDragging] = useState(false);
  const idle = useRef<number | null>(null);

  const place = useCallback(() => {
    const el = target.current;
    const t = thumb.current;
    const tr = track.current;
    if (!el || !t || !tr) return;
    const room = tr.clientHeight;
    const h = Math.max(24, (el.clientHeight / el.scrollHeight) * room);
    const span = el.scrollHeight - el.clientHeight;
    const y = span ? (el.scrollTop / span) * (room - h) : 0;
    t.style.height = `${h}px`;
    t.style.transform = `translateY(${y}px)`;
  }, [target]);

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const wake = () => {
      setActive(true);
      if (idle.current) clearTimeout(idle.current);
      idle.current = window.setTimeout(() => setActive(false), 900);
    };
    const scroll = () => {
      place();
      wake();
    };
    const host = el.parentElement!;
    place();
    el.addEventListener("scroll", scroll, { passive: true });
    host.addEventListener("pointermove", wake);
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", scroll);
      host.removeEventListener("pointermove", wake);
      ro.disconnect();
      if (idle.current) clearTimeout(idle.current);
    };
  }, [target, place]);

  const drag = (e: React.PointerEvent<HTMLSpanElement>) => {
    const el = target.current;
    const tr = track.current;
    const t = thumb.current;
    if (!el || !tr || !t) return;
    e.preventDefault();
    e.stopPropagation();
    const y0 = e.clientY;
    const top0 = el.scrollTop;
    /* Divide out any CSS zoom: pointer deltas are screen px. */
    const k = tr.getBoundingClientRect().height / tr.clientHeight || 1;
    const ratio = (el.scrollHeight - el.clientHeight) / (tr.clientHeight - t.offsetHeight) / k;
    const node = e.currentTarget;
    node.setPointerCapture(e.pointerId);
    setDragging(true);
    const move = (ev: PointerEvent) => {
      el.scrollTop = top0 + (ev.clientY - y0) * ratio;
    };
    const up = () => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", up);
      setDragging(false);
    };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);
  };

  const page = (e: React.PointerEvent<HTMLSpanElement>) => {
    const el = target.current;
    const t = thumb.current;
    if (!el || !t || e.target === t) return;
    const below = e.clientY > t.getBoundingClientRect().bottom;
    el.scrollBy({ top: (below ? 1 : -1) * el.clientHeight * 0.9, behavior: "smooth" });
  };

  return (
    <span
      ref={track}
      className="tl-sb"
      data-active={active || dragging || undefined}
      data-dragging={dragging || undefined}
      aria-hidden="true"
      onPointerDown={page}
    >
      <span ref={thumb} className="tl-sb-thumb" onPointerDown={drag} />
    </span>
  );
}
