import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { pxHub, PX_BASE } from "../alertscreen/priceHub";
import type { PriceState } from "../alertscreen/priceHub";
import { Close, WidgetShell } from "../shared/WidgetShell";
/* The two unit marks, shared with the mobile order screen — its own
   "Share quantity" / "Dollar amount" menu wears the same pair. */
import { StackIcon } from "../glasslab/icons";
import { TickerPill } from "../shared/TickerPill";
import {
  AutoHeight,
  Dropdown,
  Lock,
  Plus,
  PriceField,
  StepperField,
} from "../shared/TicketControls";
/* The ticket design system — tokens, panels, fields, the CTA. This card
   and the options ticket are the same object, so they wear the same
   stylesheet and the same `.ob-stage` root rather than a second copy of
   it under another name. Only what is genuinely new here is below. */
import "../optionsbuilder/options-builder.css";
import "./stock-ticket.css";

/**
 * The stock order ticket.
 *
 * Same card as the options ticket next door, asking the questions a share
 * order actually asks. The two differ in exactly one way that matters:
 * an options ticket is written by a CHAIN — which contract, which side,
 * at what price are all decided by the cell you click, and the ticket is
 * a manifest of what came back — while a share order has no chain to be
 * written by. There is one instrument, it is the symbol at the top, and
 * every part of the order is set here.
 *
 * So the legs are gone and what is left is a list of questions, in the
 * order a ticket is filled: what kind of order, at what price, how much,
 * for how long — and then what that adds up to against the market it will
 * trade in.
 *
 * The direction is not among them. It is the ACT, not a setting: the
 * ticket ends in Buy and Sell, and which one you press is what makes the
 * order a purchase or a sale. Nothing above has to be told first, so
 * nothing above asks.
 *
 * Everything is live: the price, the bid and ask and every figure
 * derived from them move on the shared pxHub clock, the same one the
 * alert and order-placement screens run on.
 */

type Side = "buy" | "sell";

/* The four order types a retail share ticket offers, in the order they
   are learned. Anything past these — trailing stops, brackets — is a
   second surface, not a fifth item in this menu. */
const TYPES = ["Market", "Limit", "Stop", "Stop limit"] as const;
type OrderType = (typeof TYPES)[number];

/**
 * What the size field is counted in — the choice options do not get: you
 * can buy $500 of a stock, never $500 of a contract.
 *
 * It is asked in the field's own prefix, which is the Atlas part named
 * for exactly this ("Clickable Prefix + Quantity field"). It had a line
 * of its own, "Order in", and that line asked in one place what the field
 * beside it then had to print in another — and once the size moved to the
 * top of the ticket, the row that governed it sat underneath it.
 */
const UNITS = ["Shares", "Dollars"] as const;
type Unit = (typeof UNITS)[number];

/**
 * What each unit looks like — in the prefix cell, and on its menu row.
 *
 * Shares is the stack from the mobile order screen rather than the word:
 * "Shares" is 39px of label in a cell whose whole job is to say which of
 * two things the number is, and the mark says it at a glance and at the
 * same size as the "$" it alternates with.
 *
 * Drawn on a 24-unit grid, so the stroke is scaled with the size to hold
 * a painted weight: 2.21 at 13px paints 1.2. That is measured against the
 * "$" it ALTERNATES WITH, whose stems are 1.01 at 12px (DM Sans sets the
 * l and the I at the same 1.01) — a unit mark that changed weight when
 * you switched units would make the cell itself look like it had moved.
 * It was briefly matched to the chevron's 1.37 instead, which is the
 * heavier mark in that cell and always was; an outline icon sitting a
 * touch lighter than a solid chevron is correct.
 *
 * 13 rather than 12: at 12 its ink stood 10.3 against the "$"'s 10.54 and
 * the value digits' 8.4 cap — already the 1.2x an outline mark wants
 * beside type. 13 takes it to 11.16, a hair over the "$", which is the
 * whole of the size correction it needed.
 */
const UNIT_MARK: Record<Unit, ReactNode> = {
  Shares: <StackIcon size={13} stroke={2.21} />,
  Dollars: <span className="ob-dd-mark">$</span>,
};

/**
 * What the limit price IS — the Atlas clickable prefix, in the spec's own
 * words.
 *
 * A limit is either a price you name, or one locked to a quote with an
 * offset from it. The two "Follow" modes are the locked ones, and the
 * padlock in their menu rows is the spec's: the number in the field is no
 * longer a price, it is how far off the bid or the ask you are willing to
 * sit, and the price itself is wherever that quote goes.
 */
const LIMIT_MODES = [
  "Limit price",
  "Follow bid price",
  "Follow ask price",
] as const;
type LimitMode = (typeof LIMIT_MODES)[number];

/**
 * What can be hung off the order.
 *
 * A bracket is the pair of orders that only exist because this one does:
 * the price you would take the profit at and the price you would cut the
 * loss at, both priced now rather than watched for later. They were two
 * attachments and are one, because nobody sets half a bracket — a take
 * profit with no stop under it is a position you are still watching, and
 * the ticket was offering that as a thing you could deliberately build.
 *
 * Special instructions are conditions on the parent order itself. Both
 * are attachments: the ticket sends one order, and these ride with it.
 */
const ATTACHMENTS = [
  { id: "bracket", title: "Bracket order" },
  { id: "special", title: "Special instructions" },
] as const;
type Attachment = (typeof ATTACHMENTS)[number]["id"];

/** The two legs of a bracket, in the order they would happen to you. */
const BRACKET = [
  { id: "profit", label: "Profit", tone: "up", aria: "Take-profit price" },
  { id: "loss", label: "Loss", tone: "down", aria: "Stop-loss price" },
] as const;

/**
 * What a bracket leg's number is — the clickable prefix again, on the
 * choice the spec's own popover describes: "an offset dollar amount or
 * percentage". A leg is either a price you name or a distance from the
 * one you are about to pay, and the second is how most people think about
 * a bracket: up five percent, out at two.
 */
const LEG_UNITS = ["Dollar amount", "Percentage"] as const;
type LegUnit = (typeof LEG_UNITS)[number];

/** A bracket leg holds both, so switching the prefix never loses the
    number you had — see `switchLeg`. */
type Leg = { unit: LegUnit; price: number; pct: number };

/** The conditions a share order can carry. */
const INSTRUCTIONS = [
  "All or none",
  "Fill or kill",
  "Immediate or cancel",
  "Extended hours",
] as const;
type Instruction = (typeof INSTRUCTIONS)[number];

/**
 * The confirmation's entrance — a command-palette open, not a sheet.
 *
 * 96% to 100% and 6px up, settled by a spring stiff enough that it does
 * not bounce: 500/35 at 0.8 mass is over in about 180ms and stops dead.
 * The scale is deliberately tiny. Four percent for a sixth of a second is
 * under the threshold where type reads as resizing — the panel is legible
 * only once it has arrived — where the same move at 0.9 would put every
 * glyph through sizes the font was never hinted for.
 *
 * The exit is a tween, not the spring: a spring settling is the wrong
 * shape for something leaving, and it should be gone faster than it came.
 */
const MODAL_SPRING = {
  type: "spring",
  stiffness: 500,
  damping: 35,
  mass: 0.8,
} as const;
const MODAL_OUT = { duration: 0.14, ease: [0.22, 1, 0.36, 1] } as const;

/**
 * And the ground it opens onto.
 *
 * The page is not dimmed so much as taken out of focus: 5% of overlay and
 * the rest is the filter — 12px of blur with the saturation pushed to
 * 140, which keeps the colour in what is behind it while removing every
 * edge you could read. Nothing under it moves; only its appearance
 * changes.
 */
const BACKDROP_OFF = "blur(0px) saturate(100%)";
const BACKDROP_ON = "blur(12px) saturate(140%)";
const BACKDROP = { duration: 0.2, ease: [0.22, 1, 0.36, 1] } as const;

/** The spec's popover, verbatim. */
const OFFSET_HINT =
  "Select an offset dollar amount or percentage to determine the limit price that will trigger your order";

/** How long the order stands — "Duration" here, as on the options
    ticket, which is the word the fields around it are written in. */
const TIFS = ["Good for day", "Good till cancelled"] as const;
type Tif = (typeof TIFS)[number];

/** The symbol this ticket is written on — the same one the alert and
    order-placement screens use, which is why it shares their clock. */
const SYMBOL = "DASH";

/** Yesterday's close, shared verbatim with the order-placement screens so
    the change this pill reports matches the one they do. */
const PREV_CLOSE = 192.91;

/** A price, as prices are written on this ticket. */
const money = (x: number) => `$${Math.abs(x).toFixed(2)}`;

/* Money that can run past a thousand — what the order costs, which on a
   round lot of a $194 stock does immediately. */
const total = (x: number) =>
  `$${Math.abs(x).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** A signed percentage, with the typographic minus the rest of the
    trading UI uses. */
const pct = (x: number) => `${x < 0 ? "−" : "+"}${Math.abs(x).toFixed(2)}%`;

export function StockTicket({
  onClose,
  onGrip,
}: {
  /** Given, the title bar's X dismisses the ticket. */
  onClose?: () => void;
  /**
   * Given, the title bar grows a drag grip and this fires when it is
   * taken hold of. The ticket does not move itself — whoever placed it on
   * the page decides where it can go.
   */
  onGrip?: (e: ReactPointerEvent) => void;
}) {
  const reduce = useReducedMotion();
  const spring: Transition = reduce
    ? { duration: 0 }
    : { type: "spring", stiffness: 460, damping: 40 };

  /* The card's own height, and the only thing that MOVES when the order
     type changes. 500/45 is critical damping for that stiffness, so the
     block travels as fast as an underdamped spring and stops dead —
     see the options ticket, where the same value carries a leg. */
  const sizeSpring: Transition = reduce
    ? { duration: 0 }
    : { type: "spring", stiffness: 500, damping: 45 };

  /* Arriving content does not move. It is revealed by the height above it
     opening, so all a new line does is come up to full opacity while it
     is uncovered. */
  const enterTransition: Transition = reduce
    ? { duration: 0 }
    : { duration: 0.16, ease: "easeOut" };

  /* Leaving content gets out of the way fast: down 10, blurred, gone in
     0.12 — already out of the layout by then (popLayout), so the stack is
     closing underneath it at the same time. */
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

  const S = px.price;
  /* A cent either side, the spread the order-placement screens quote on
     this same symbol. */
  const bid = S - 0.01;
  const ask = S + 0.01;
  const change = S - PREV_CLOSE;

  const [type, setType] = useState<OrderType>("Market");
  const [unit, setUnit] = useState<Unit>("Shares");
  const [limitMode, setLimitMode] = useState<LimitMode>("Limit price");
  /* How far off the followed quote the limit sits, as a percentage. */
  const [offset, setOffset] = useState(1);
  const [qty, setQty] = useState(10);
  const [amount, setAmount] = useState(500);
  const [limitPx, setLimitPx] = useState(+(PX_BASE + 0.01).toFixed(2));
  const [stop, setStop] = useState<Leg>({
    unit: "Percentage",
    price: +(PX_BASE * 0.99).toFixed(2),
    pct: 1,
  });
  const [tif, setTif] = useState<Tif>(TIFS[0]);
  /* Which attachments are on the order, in the order they were added —
     see `open` below, which puts them back into the canonical one. */
  const [attached, setAttached] = useState<Attachment[]>([]);
  const [take, setTake] = useState<Leg>({
    unit: "Dollar amount",
    price: +(PX_BASE * 1.05).toFixed(2),
    pct: 5,
  });
  const [loss, setLoss] = useState<Leg>({
    unit: "Dollar amount",
    price: +(PX_BASE * 0.95).toFixed(2),
    pct: 5,
  });
  const [instruction, setInstruction] = useState<Instruction>(INSTRUCTIONS[0]);
  /* Which button was pressed, and null the rest of the time. The ticket
     has no side of its own — see the note at the top — so this is the
     only place a direction exists, and only for as long as the
     acknowledgement stands. */
  /* The order, once it has been sent. One confirmation, not two: the
     footer used to swap its estimate for "Buy order submitted" and the
     snackbar would have said the same thing again a moment later, in a
     louder voice. */
  const [toast, setToast] = useState<number | null>(null);
  /* The check draws itself with CSS transitions, which only run if the
     element is painted in its undrawn state first. Two frames: one to
     commit the initial dashoffset, one to change it. */
  const [checked, setChecked] = useState(false);
  /* Which direction is waiting on a confirmation. The buttons no longer
     place anything: they ask, and the modal is where the order is sent. */
  const [confirming, setConfirming] = useState<Side | null>(null);
  const subT = useRef<number | undefined>(undefined);

  const wantsLimit = type === "Limit" || type === "Stop limit";
  const wantsStop = type === "Stop" || type === "Stop limit";
  /* Dollars only exist on a market order.

     A dollar amount buys whatever fraction of a share it buys, and that
     can only be settled at whatever the market is when it fills — name a
     price and the question becomes how many shares you meant, which is a
     question this ticket has no way to answer. So the moment the order
     type is anything but Market the size is a share count, the prefix
     that offers the choice goes with it, and the field is the plain
     stepper it was before there was a choice to make.

     `unit` is kept rather than reset, so a ticket that was in dollars is
     in dollars again the moment it goes back to market. */
  const dollars = unit === "Dollars" && type === "Market";
  const sized = type === "Market";

  /* A limit that is following is not a price at all: the field holds an
     offset, and the price is derived from whichever quote it is locked
     to, on every tick. A limit that is not following is a price, and it
     tracks the last until somebody types over it — the ticket's old
     behaviour, which is now just one of the three modes. */
  const following = limitMode !== "Limit price";
  const followed = limitMode === "Follow ask price" ? ask : bid;
  const limit = following
    ? +Math.max(0.01, followed * (1 + offset / 100)).toFixed(2)
    : limitPx;

  /* While the confirmation is open it is the only thing on the page:
     Escape backs out of it, Tab cycles inside it rather than wandering
     into the ticket behind the scrim, the page cannot scroll under it,
     and closing it puts the caret back on the button that opened it.
     `aria-modal` is a claim, and this is what makes the claim true. */
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!confirming) return;
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusable = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.tabIndex >= 0);

    const frame = requestAnimationFrame(() =>
      (focusable()[0] ?? panelRef.current)?.focus(),
    );

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setConfirming(null);
        return;
      }
      if (e.key !== "Tab") return;
      const els = focusable();
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [confirming]);

  useEffect(() => {
    if (!toast) {
      setChecked(false);
      return;
    }
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setChecked(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [toast]);

  const limitEdited = useRef(false);
  useEffect(() => {
    if (following || limitEdited.current) return;
    setLimitPx(+S.toFixed(2));
  }, [following, S]);

  /* A bracket leg's actual price: the one you named, or the distance you
     named applied to what this order is about to pay. The profit sits
     above that and the loss below it — which assumes the position is a
     long one, as a bracket on a share ticket nearly always is. */
  const legPrice = (l: Leg, up: boolean, ref: number) =>
    l.unit === "Percentage"
      ? +Math.max(0.01, ref * (1 + (up ? l.pct : -l.pct) / 100)).toFixed(2)
      : l.price;

  /* The stop is a leg too: a price you name, or a distance under the
     last. It opens on the distance — 1% under — which is the only way a
     stop is ever actually set, and which means it tracks the market
     without needing to be told to. */
  const stopAt = legPrice(stop, false, S);

  /* The price this order is written at. A market order has none of its
     own and takes the market's; a stop has not got a limit, so what it
     is estimated against is the price that would trigger it. */
  const orderPx = wantsLimit ? limit : wantsStop ? stopAt : S;

  /* What it comes to. In shares the amount is a count and the cost is
     derived; in dollars the amount IS the cost and the share count is. */
  const shares = dollars ? (orderPx > 0 ? amount / orderPx : 0) : qty;
  const cost = dollars ? amount : qty * orderPx;

  /* Questrade's own equity schedule: a cent a share, floored at 4.95 and
     capped at 9.95. A real number rather than a placeholder, because the
     confirmation is the one place on this flow where what it costs to
     trade is the thing you are being asked to accept. */
  const commission = Math.min(9.95, Math.max(4.95, shares * 0.01));

  function send() {
    if (!confirming) return;
    setConfirming(null);
    setToast(Date.now());
    window.clearTimeout(subT.current);
    /* 2.6s. It was 4.2 — the toast stack's own default, which is set for
       messages you may need to act on: ones with an Undo, or a line of
       detail under the title. This one is five words confirming something
       you just pressed twice to do, so it is read in about a second and
       every frame after that is a thing on screen with nothing left to
       say. Short enough to feel dismissed, long enough to be certain you
       saw it. */
    subT.current = window.setTimeout(() => setToast(null), 2600);
  }

  function bumpQty(delta: number) {
    setQty((q) => Math.min(9999, Math.max(1, q + delta)));
  }

  function bumpAmount(delta: number) {
    setAmount((a) => Math.min(999999, Math.max(1, +(a + delta).toFixed(2))));
  }

  function bumpLimit(delta: number) {
    if (following) {
      setOffset((v) => Math.min(99.99, Math.max(0, +(v + delta).toFixed(2))));
      return;
    }
    limitEdited.current = true;
    setLimitPx((v) => Math.min(9999.99, Math.max(0.01, +(v + delta).toFixed(2))));
  }

  /* Switching a leg's prefix keeps the number meaning what it says: the
     distance it had becomes the percentage, or the price it had resolved
     to becomes the price. Neither hands you a figure you did not set. */
  function switchLeg(l: Leg, unit: LegUnit, up: boolean, ref: number): Leg {
    if (unit === l.unit) return l;
    if (unit === "Percentage") {
      const d = ((legPrice(l, up, ref) - ref) / ref) * 100;
      return { ...l, unit, pct: +Math.max(0.01, up ? d : -d).toFixed(2) };
    }
    return { ...l, unit, price: legPrice(l, up, ref) };
  }

  /* Switching modes keeps the number meaning what it says: leaving a
     follow mode hands the absolute price it had resolved to over to the
     price field, so the limit on the order does not jump because you
     changed how you were expressing it. */
  function pickLimitMode(m: LimitMode) {
    if (m === "Limit price" && following) {
      limitEdited.current = true;
      setLimitPx(limit);
    }
    setLimitMode(m);
  }

  /* The order in one line, which is what a confirmation is FOR: not the
     fields again, but the sentence they add up to, in the words a
     statement would use. Built in the order it would be said out loud —
     how much, of what, at what price, for how long, and whatever rides
     with it. */
  const priceClause =
    type === "Market"
      ? "at market"
      : type === "Limit"
        ? `limit ${money(limit)}`
        : type === "Stop"
          ? `stop ${money(stopAt)}`
          : `stop ${money(stopAt)}, limit ${money(limit)}`;

  const sentence = [
    dollars ? `${total(amount)} of ${SYMBOL}` : `${qty} ${SYMBOL}`,
    priceClause,
    tif.toLowerCase(),
    attached.includes("bracket")
      ? `bracket ${money(legPrice(take, true, orderPx))} / ${money(
          legPrice(loss, false, orderPx),
        )}`
      : null,
    attached.includes("special") ? instruction.toLowerCase() : null,
  ]
    .filter(Boolean)
    .join(", ");

  /* The title names the instrument, which is the options ticket's rule
     read straight: there it is the contract — "DASH $195 Call" — and here
     it is the only instrument a share ticket can be written on. It cannot
     name the order instead, because until a button at the bottom is
     pressed the order has no direction to name. */
  const title = `${SYMBOL} Common Stock`;

  return (
    <div className="ob-stage st-stage">
      {/* The ticket and its confirmation share one box, so the panel can
          be placed on the WIDGET rather than on the window — see
          .st-deck. The scrim stays outside it: that one belongs to the
          page. */}
      <div className="st-deck">
      <WidgetShell
        title={title}
        className="ob-shell st-shell"
        onClose={onClose}
        onGrip={onGrip}
      >
        <div className="ob-card">
          {/* ONE container, with rules across it.

              It was three surfaces — the quote on the card's own ground,
              the fields in a panel, the attachments in another — which is
              three grounds for what is one ticket, and 8 of air at each
              seam doing the work a 1px line does better. A single box with
              a rule between its bands says the same thing more quietly:
              still three questions, but plainly parts of one order. Same
              call the options ticket made when its legs and its fields
              stopped being two boxes.

              The rules are drawn on the bands, not on the container, so
              they land inset by the same 6 as everything else — a border
              on the box would run to its own edge and be the one line on
              the card that does. */}
          <div className="st-body">
          {/* ---- what you are trading ---- */}
          <div className="st-quote">
            <TickerPill
              symbol={SYMBOL}
              price={S}
              change={change}
              changePct={change / PREV_CLOSE}
              className="st-id"
            />
          </div>

          {/* ---- what you set ----
              A list of questions, one per line, each with its name on the
              left and one control on a shared right edge. Two of them are
              only asked when the order type asks them — the block springs
              open to let them in rather than the card jumping. */}
          <AutoHeight transition={sizeSpring} enabled={!reduce}>
              <div className="ob-params">
                {/* How much, first. It is the one thing on the ticket
                    you always have to say — every other line has an
                    answer it can open with, and this one does not mean
                    anything until you set it — so it leads, and the rest
                    of the ticket qualifies it: what kind of order, at what
                    price, for how long.

                    Its unit lives in its own prefix. That was a line of
                    its own ("Order in") directly below, which asked in one
                    place what this field then had to print in another —
                    and with the size at the top, the row that governed it
                    would have sat underneath it. */}
                <div className="ob-line">
                  <span className="ob-line-k">
                    <span className="ob-line-label">
                      {dollars ? "Amount" : "Quantity"}
                    </span>
                  </span>
                  {dollars ? (
                    <PriceField
                      ariaLabel="Amount"
                      prefix={unit}
                      prefixLabel={UNIT_MARK[unit]}
                      prefixOptions={UNITS}
                      onPrefixSelect={(v) => setUnit(v as Unit)}
                      prefixIcon={(v) => UNIT_MARK[v as Unit]}
                      prefixAria="What the order is counted in"
                      value={amount}
                      reduce={reduce}
                      spring={spring}
                      onCommit={(v) => setAmount(Math.min(999999, Math.max(1, v)))}
                      onStep={bumpAmount}
                    />
                  ) : (
                    <StepperField
                      ariaLabel="Quantity"
                      /* The prefix IS the unit picker, and there is no
                         unit to pick unless this is a market order — see
                         `dollars` above. Without it the field is what a
                         share count has always been: a number and its
                         arrows. */
                      prefix={sized ? unit : undefined}
                      prefixLabel={sized ? UNIT_MARK[unit] : undefined}
                      prefixOptions={sized ? UNITS : undefined}
                      onPrefixSelect={sized ? (v) => setUnit(v as Unit) : undefined}
                      prefixIcon={(v) => UNIT_MARK[v as Unit]}
                      prefixAria="What the order is counted in"
                      value={String(qty)}
                      reduce={reduce}
                      spring={spring}
                      onChange={(raw) => {
                        const v = parseInt(raw.replace(/\D/g, ""), 10);
                        setQty(
                          Number.isFinite(v) ? Math.min(9999, Math.max(1, v)) : 1,
                        );
                      }}
                      onStep={bumpQty}
                    />
                  )}
                </div>

                <div className="ob-line">
                  <span className="ob-line-k">
                    <span className="ob-line-label">Order type</span>
                  </span>
                  <Dropdown
                    className="ob-field ob-field--switch"
                    ariaLabel="Order type"
                    value={type}
                    options={TYPES}
                    onSelect={setType}
                  />
                </div>

                {/* popLayout, so a line on its way out is out of the flow
                    immediately and the block closes underneath it rather
                    than holding both open for the length of the exit. */}
                <AnimatePresence initial={false} mode="popLayout">
                  {wantsStop && (
                    <motion.div
                      key="stop"
                      className="ob-line"
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
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
                      <span className="ob-line-k">
                        <span className="ob-line-label">Stop price</span>
                        {/* What the stop is measured from, under the name
                            of the thing it measures — see the limit row
                            below, which is where this arrangement is
                            argued. */}
                        <span className="ob-line-sub">
                          <span className="ob-sub">
                            <span className="ob-sub-k">Last</span>
                            <span className="ob-sub-v">{money(S)}</span>
                          </span>
                        </span>
                      </span>
                      {/* The same picker the bracket's legs wear, on the
                          same two units: a stop is a price you name or a
                          distance under the last, and the distance is how
                          one is actually set. It opens there, which is
                          also what makes it track the market without a
                          rule of its own. */}
                      <PriceField
                        ariaLabel="Stop price"
                        prefix={stop.unit}
                        prefixLabel={stop.unit === "Percentage" ? "%" : "$"}
                        prefixOptions={LEG_UNITS}
                        onPrefixSelect={(v) =>
                          setStop((cur) => switchLeg(cur, v as LegUnit, false, S))
                        }
                        prefixIcon={(v) => (
                          <span className="ob-dd-mark">
                            {v === "Percentage" ? "%" : "$"}
                          </span>
                        )}
                        prefixHint={OFFSET_HINT}
                        prefixAria="What the stop price is set in"
                        value={stop.unit === "Percentage" ? stop.pct : stop.price}
                        reduce={reduce}
                        spring={spring}
                        onCommit={(v) =>
                          setStop((cur) =>
                            cur.unit === "Percentage"
                              ? { ...cur, pct: Math.min(99.99, Math.max(0.01, v)) }
                              : { ...cur, price: Math.min(9999.99, Math.max(0.01, v)) },
                          )
                        }
                        onStep={(d) =>
                          setStop((cur) =>
                            cur.unit === "Percentage"
                              ? {
                                  ...cur,
                                  pct: Math.min(
                                    99.99,
                                    Math.max(0.01, +(cur.pct + d * 0.01).toFixed(2)),
                                  ),
                                }
                              : {
                                  ...cur,
                                  price: Math.min(
                                    9999.99,
                                    Math.max(0.01, +(cur.price + d * 0.01).toFixed(2)),
                                  ),
                                },
                          )
                        }
                      />
                    </motion.div>
                  )}

                  {wantsLimit && (
                    <motion.div
                      key="limit"
                      className="ob-line"
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
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
                      <span className="ob-line-k">
                        <span className="ob-line-label">Limit price</span>
                        {/* The two prices the field is sitting between,
                            under the label rather than under the field.

                            They are what the market says, and what the
                            market says belongs on the side of the row
                            that names things — the right-hand edge is
                            where every control on this card lines up, and
                            a reading hanging under one of them made that
                            column read as two rows deep. Under the label
                            the row is a question with its context, and
                            one column of controls beside it. */}
                        <span className="ob-line-sub">
                          <span className="ob-sub">
                            <span className="ob-sub-k">Bid</span>
                            <span className="ob-sub-v">{money(bid)}</span>
                          </span>
                          <span className="ob-sub">
                            <span className="ob-sub-k">Ask</span>
                            <span className="ob-sub-v">{money(ask)}</span>
                          </span>
                        </span>
                      </span>
                      <PriceField
                        ariaLabel="Limit price"
                        /* "$" for a price you name, "Offset %" for one
                           locked to a quote — the spec's two prefix
                           labels, for the spec's two kinds of number. */
                        prefix={limitMode}
                        prefixLabel={following ? "Offset %" : "$"}
                        prefixOptions={LIMIT_MODES}
                        onPrefixSelect={(v) => pickLimitMode(v as LimitMode)}
                        prefixIcon={(v) =>
                          v === "Limit price" ? (
                            <span className="ob-dd-mark">$</span>
                          ) : (
                            <Lock size={12} />
                          )
                        }
                        prefixHint={OFFSET_HINT}
                        prefixAria="What the limit price is"
                        value={following ? offset : limitPx}
                        reduce={reduce}
                        spring={spring}
                        onCommit={(v) => {
                          if (following) {
                            setOffset(Math.min(99.99, Math.max(0, v)));
                            return;
                          }
                          limitEdited.current = true;
                          setLimitPx(Math.min(9999.99, Math.max(0, v)));
                        }}
                        onStep={(d) => bumpLimit(d * 0.01)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

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
          </AutoHeight>

          {/* ---- what rides with the order ----

              The band that was here read out where the order sat against
              the market — the market price, the distance to it, the day's
              range. Useful, and none of it was something you could DO:
              three readings taking a surface of their own on a card whose
              every other surface is a control, with the live price
              already stated in the pill at the top.

              What belongs in that space is the rest of the order. A
              profit and a loss are the two orders that exist only because
              this one does, and special instructions are conditions on
              this one — all three are things you add, so they sit under a
              row that says so and open in place when you do.

              The container is the legs panel's, value for value, and the
              add row lives INSIDE it: with nothing attached it is the
              only child and its rule is suppressed, so the panel is a
              single row until it has something to divide. */}
          <AutoHeight transition={sizeSpring} enabled={!reduce}>
              <div className="st-attach-stack">
                <AnimatePresence initial={false} mode="popLayout">
                  {ATTACHMENTS.filter((a) => attached.includes(a.id)).map((a) => (
                    <motion.div
                      key={a.id}
                      className="ob-attach"
                      /* The section's own name, so its heading can be
                         nudged onto the same optical line as the other's
                         — see the padding note in stock-ticket.css. */
                      data-attach={a.id}
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
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
                      <div className="ob-attach-head">
                        {/* Ink. A section heading names a part of the
                            ticket; tinted it would read as a status —
                            green for "in profit", coral for "at a loss" —
                            which is what those colours mean everywhere
                            else on this card. */}
                        <span className="ob-attach-title" data-tone="neutral">
                          {a.title}
                        </span>
                        <motion.button
                          type="button"
                          className="ob-attach-x"
                          aria-label={`Remove ${a.title.toLowerCase()}`}
                          onClick={() =>
                            setAttached((cur) => cur.filter((x) => x !== a.id))
                          }
                          whileTap={reduce ? undefined : { scale: 0.97 }}
                          transition={spring}
                        >
                          <Close size={12} />
                        </motion.button>
                      </div>

                      {/* The parent's own rows, repeated — a label and one
                          control on the same right edge, so an attachment
                          reads as more of the same ticket rather than a
                          form nested in one. */}
                      <div className="ob-params">
                        {a.id === "special" ? (
                          <div className="ob-line">
                            <span className="ob-line-k">
                              <span className="ob-line-label">Condition</span>
                            </span>
                            <Dropdown
                              className="ob-field ob-field--switch"
                              ariaLabel="Condition"
                              value={instruction}
                              options={INSTRUCTIONS}
                              onSelect={setInstruction}
                            />
                          </div>
                        ) : (
                          /* The two halves of the bracket, in the order
                             they would happen to you: the one you are
                             hoping for, then the one you are guarding
                             against. Each is a price like any other on
                             this card, so each wears the same field and
                             the same prefix. */
                          BRACKET.map((b) => {
                            const up = b.id === "profit";
                            const leg = up ? take : loss;
                            const setLeg = up ? setTake : setLoss;
                            const pct = leg.unit === "Percentage";
                            const at = legPrice(leg, up, orderPx);
                            /* What the leg is worth if it fills: the
                               distance from what this order pays, times
                               what it buys. */
                            const est = Math.abs(at - orderPx) * shares;
                            return (
                              <div className="ob-line" key={b.id}>
                                <span className="ob-line-k">
                                  {/* Green and coral, where every other
                                      label on the card is muted. These
                                      two do not name a field, they name
                                      the two directions a position can
                                      go — the one thing on this ticket
                                      the palette exists to say. The
                                      heading above them stays ink:
                                      "Bracket order" is a section, and
                                      tinting it would read as a status. */}
                                  <span className="ob-line-label" data-tone={b.tone}>
                                    {b.label}
                                  </span>
                                  {/* The reading the limit row's Bid and
                                      Ask are: what the market says about
                                      the number beside it — here, what
                                      this leg comes to if it fills. */}
                                  <span className="ob-line-sub">
                                    <span className="ob-sub">
                                      <span className="ob-sub-k">
                                        Est. {up ? "profit" : "loss"}
                                      </span>
                                      <span className="ob-sub-v">{total(est)}</span>
                                    </span>
                                  </span>
                                </span>
                                <PriceField
                                  ariaLabel={b.aria}
                                  prefix={leg.unit}
                                  prefixLabel={pct ? "%" : "$"}
                                  prefixOptions={LEG_UNITS}
                                  onPrefixSelect={(v) =>
                                    setLeg((cur) =>
                                      switchLeg(cur, v as LegUnit, up, orderPx),
                                    )
                                  }
                                  prefixIcon={(v) => (
                                    <span className="ob-dd-mark">
                                      {v === "Percentage" ? "%" : "$"}
                                    </span>
                                  )}
                                  prefixHint={OFFSET_HINT}
                                  prefixAria={`What the ${b.label.toLowerCase()} leg is set in`}
                                  value={pct ? leg.pct : leg.price}
                                  reduce={reduce}
                                  spring={spring}
                                  onCommit={(v) =>
                                    setLeg((cur) =>
                                      pct
                                        ? { ...cur, pct: Math.min(99.99, Math.max(0.01, v)) }
                                        : { ...cur, price: Math.min(9999.99, Math.max(0.01, v)) },
                                    )
                                  }
                                  onStep={(d) =>
                                    setLeg((cur) =>
                                      pct
                                        ? {
                                            ...cur,
                                            pct: Math.min(
                                              99.99,
                                              Math.max(0.01, +(cur.pct + d * 0.01).toFixed(2)),
                                            ),
                                          }
                                        : {
                                            ...cur,
                                            price: Math.min(
                                              9999.99,
                                              Math.max(0.01, +(cur.price + d * 0.01).toFixed(2)),
                                            ),
                                          },
                                    )
                                  }
                                />
                              </div>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* No button chrome at all: a 14px plus and an 11px label
                    sitting on the panel. The plus's own ink is pulled onto
                    the row's left edge by .ob-add button svg, so these
                    start on the same line as everything else on the card
                    rather than a bearing's width inside it.

                    The label is the section's own name and nothing else.
                    It read "Add profit" beside a plus, which is the verb
                    twice — the glyph is the whole of what the button
                    does, and what follows it is what you get.

                    A button LEAVES when its attachment arrives, rather
                    than dimming: a disabled "Profit" under an open Profit
                    section is a control offering what is already on
                    screen directly above it. The row goes with the last
                    one, so a fully attached order ends in its fields and
                    not in an empty band. */}
                <AnimatePresence initial={false} mode="popLayout">
                  {attached.length < ATTACHMENTS.length && (
                    <motion.div
                      key="add"
                      className="ob-add"
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, transition: exitTransition }}
                      transition={enterTransition}
                    >
                      <AnimatePresence initial={false} mode="popLayout">
                        {ATTACHMENTS.filter((a) => !attached.includes(a.id)).map(
                          (a) => (
                            <motion.button
                              key={a.id}
                              type="button"
                              /* "position", not plain layout: the buttons
                                 left of a departing one slide across, and
                                 Motion's default would also correct their
                                 SCALE on the way — which puts 11px type
                                 through sizes it was never hinted for and
                                 reads as the labels wobbling. */
                              layout="position"
                              onClick={() =>
                                setAttached((cur) => [...cur, a.id])
                              }
                              initial={reduce ? false : { opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={
                                reduce
                                  ? { opacity: 0 }
                                  : { opacity: 0, transition: exitTransition }
                              }
                              whileTap={reduce ? undefined : { scale: 0.97 }}
                              transition={reduce ? { duration: 0 } : sizeSpring}
                            >
                              <Plus size={14} />
                              {a.title}
                            </motion.button>
                          ),
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </AutoHeight>
          </div>

          {/* ---- what it comes to, and the two acts it can become ----

              One line, as on the options ticket: the figure at one end and
              what commits to it at the other. There are two of those now,
              and they are the only place the order's direction is
              expressed — press Buy and it was a purchase, press Sell and
              it was a sale. Nothing above them had to be told first, which
              is why nothing above them asks.

              The acknowledgement lands on the LEFT, in place of the
              estimate. The buttons are a fixed pair and must not resize
              under the pointer that just pressed them — and "what this
              would cost" giving way to "this is what happened" is the
              right substitution anyway: the estimate has been answered. */}
          <div className="ob-foot">
            <span className="ob-cost">
              <span className="ob-cost-k">
                {dollars ? "Estimated shares" : "Estimated total"}
              </span>
              <span className="ob-cost-v">
                {dollars ? shares.toFixed(4) : total(cost)}
              </span>
            </span>

            <div className="st-ctas">
              {/* Sell first, Buy last. A pair of actions puts the one you
                  are most likely to want at the trailing edge — where the
                  eye finishes the line and the pointer already is, having
                  just come down the column of fields — which is the same
                  reason a dialog ends in its affirmative rather than
                  opening with it. */}
              {(["sell", "buy"] as const).map((s) => (
                <motion.button
                  key={s}
                  type="button"
                  className="ob-cta st-cta"
                  data-side={s}
                  onClick={() => setConfirming(s)}
                  /* The same 0.97 the title-bar icons and the glass button
                     set all take on press. */
                  whileTap={reduce ? undefined : { scale: 0.97 }}
                  transition={spring}
                >
                  {/* The label in its own span, which is the shape the
                      options ticket's CTA has — there it comes from Swap's
                      motion.span, and `.ob-cta-label > span` is written
                      for it: the black ink, the centring, the grid cell.
                      A bare text node picked up none of that and had to be
                      coloured by a rule of its own. Same DOM, same rules,
                      one CTA. */}
                  <span className="ob-cta-label">
                    <span>{s === "buy" ? "Buy" : "Sell"}</span>
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </WidgetShell>

      {/* ---- the confirmation ----

          The buttons ask; this is where the order is sent. It wears the
          same shell the ticket does — a named bar with an X — because it
          is the same object saying one more thing, not a different kind
          of surface arriving on top of one.

          Fixed and centred over the whole stage rather than over the card,
          so the ticket cannot be half-read behind a panel pinned to it;
          the scrim takes the ticket back to something you can see but not
          touch, which is exactly its state while this is open. */}
      <AnimatePresence>
        {confirming && (
            <div key="modal" className="st-modal-wrap">
            <motion.div
              ref={panelRef}
              className="st-modal-card"
              role="dialog"
              aria-modal="true"
              aria-label="Order confirmation"
              tabIndex={-1}
              initial={
                reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 6 }
              }
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={
                reduce
                  ? { opacity: 0, transition: MODAL_OUT }
                  : { opacity: 0, scale: 0.96, y: 6, transition: MODAL_OUT }
              }
              transition={reduce ? { duration: 0.12 } : MODAL_SPRING}
            >
              <WidgetShell
                title="Order confirmation"
                className="ob-shell st-modal"
                onClose={() => setConfirming(null)}
              >
                <div className="ob-card">
                  <div className="st-body">
                    {/* What you are about to do, as one statement: the
                        direction as a badge, then the order in words. The
                        badge is a stadium where every control on this card
                        is a 6 — a shape nobody can mistake for something
                        to press. */}
                    <div className="st-conf-lead">
                      <span className="st-badge" data-side={confirming}>
                        {confirming === "buy" ? "Buy" : "Sell"}
                      </span>
                      <span className="st-conf-order">{sentence}</span>
                    </div>

                    <div className="st-conf-group">
                      <Line k="Account" v="TFSA · 12345678" />
                      <Line
                        k="Trade value"
                        v={`${
                          dollars ? shares.toFixed(4) : qty
                        } × ${money(orderPx)} = ${total(cost)} USD`}
                      />
                      <Line k="Commission" v={`${total(commission)} USD`} />
                    </div>

                    <div className="st-conf-group">
                      {/* Signed, because the sign is the whole reading:
                          one direction takes buying power and the other
                          gives it back, and the commission comes out of
                          the account either way. */}
                      <Line
                        k="Change in buying power"
                        v={`${confirming === "buy" ? "−" : "+"}${total(
                          confirming === "buy"
                            ? cost + commission
                            : cost - commission,
                        )} USD`}
                      />
                      {/* Genuinely not applicable rather than unfinished:
                          maintenance excess is a margin figure, and the
                          account above is registered. */}
                      <Line k="Change in maintenance excess" v="N/A" />
                    </div>

                    <div className="st-conf-group st-conf-fine">
                      <p>All values are estimates.</p>
                      <p>
                        *Exchange and ECN fees, SEC fees and ADRs annual
                        custody fees may apply. Commissions may vary if your
                        order is filled over multiple days. Borrow fees may
                        apply if you hold a short investment overnight.{" "}
                        <a href="#" onClick={(e) => e.preventDefault()}>
                          Learn more
                        </a>
                      </p>
                    </div>
                  </div>

                  {/* Cancel in coral and Send in mint, in that order — the
                      same reasoning as the ticket's own pair: the act you
                      are most likely to want sits at the trailing edge. */}
                  <div className="ob-foot st-conf-foot">
                    <div className="st-ctas">
                      <motion.button
                        type="button"
                        className="ob-cta st-cta"
                        data-side="sell"
                        onClick={() => setConfirming(null)}
                        whileTap={reduce ? undefined : { scale: 0.97 }}
                        transition={spring}
                      >
                        <span className="ob-cta-label">
                          <span>Cancel order</span>
                        </span>
                      </motion.button>
                      <motion.button
                        type="button"
                        className="ob-cta st-cta"
                        data-side="buy"
                        onClick={send}
                        whileTap={reduce ? undefined : { scale: 0.97 }}
                        transition={spring}
                      >
                        <span className="ob-cta-label">
                          <span>Send order</span>
                        </span>
                      </motion.button>
                    </div>
                  </div>
                </div>
              </WidgetShell>
            </motion.div>
            </div>
        )}
      </AnimatePresence>
      </div>

      {/* ---- the order has been placed ----

          Bottom of the page, not attached to the ticket: what it reports
          is done and gone, and the card behind it has already gone back
          to being a blank ticket. The house green callout — a mint plate
          in a mint rim — which is what this palette says "that worked"
          in.

          Its motion is the toast stack's: a spring up from 22 below with
          the blur and the 0.96 scale resolving together, so it arrives
          the way a notification does rather than sliding into place. The
          blur is what makes the scale safe on type — it is gone by the
          time the glyphs are legible, so nothing is read at a size the
          font was not hinted for.

          6px of it, not the reference's 10: blur is absolute and that
          surface is a card two lines tall, where this is a single 32px
          bar. At 10 the bar is gone entirely on the first frame and the
          entrance reads as a smear resolving rather than an object
          arriving — the same proportion, measured against this object.

          Draggable sideways to dismiss, at the reference's own thresholds:
          72px of travel or 520 of velocity, whichever it reaches first. */}
      <div className="st-toast-wrap">
        {/* Default mode, not popLayout. popLayout wraps every child in a
            measuring component so a leaver can be taken out of flow
            without the survivors jumping — which is what a STACK needs.
            There is one toast here, so all that machinery bought was an
            extra wrapper measuring a box nothing follows. */}
        <AnimatePresence initial={false}>
          {toast && (
            <motion.div
              key={toast}
              /* The animated box carries NO paint — no ground, no rim, no
                 shadow. That is the reference's own split, and it is why
                 it runs smoothly: transform, opacity and filter on a box
                 with nothing to draw can be composited, where the same
                 three on the bordered, shadowed surface make every frame
                 a repaint of the whole bar AND a re-blur of its shadow. */
              className="st-toast-item"
              role="status"
              aria-live="polite"
              initial={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, y: 22, scale: 0.96, filter: "blur(6px)" }
              }
              animate={
                reduce
                  ? { opacity: 1 }
                  : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
              }
              exit={
                reduce
                  ? { opacity: 0 }
                  : {
                      opacity: 0,
                      x: 32,
                      scale: 0.96,
                      filter: "blur(5px)",
                      transition: { duration: 0.18, ease: [0.33, 1, 0.68, 1] },
                    }
              }
              transition={{
                type: "spring",
                stiffness: 420,
                damping: 34,
                mass: 0.75,
              }}
              drag={reduce ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={(_, info) => {
                if (
                  Math.abs(info.offset.x) > 72 ||
                  Math.abs(info.velocity.x) > 520
                ) {
                  window.clearTimeout(subT.current);
                  setToast(null);
                }
              }}
            >
              <div className="st-toast">
                {/* The ring draws round, then the tick draws in behind
                    it — both as stroke-dashoffset, which is the one way
                    to animate a line being DRAWN rather than revealed.

                    `pathLength` normalises each path to the dash numbers
                    the effect is written against: 151 for the ring and 28
                    for the tick, whatever the geometry actually measures.
                    Without it those two constants are a circumference and
                    an arc length that have to be recomputed the moment
                    anything about the drawing changes. */}
                <svg
                  className={`st-check${checked ? " is-done" : ""}`}
                  viewBox="0 0 52 52"
                  width="16"
                  height="16"
                  aria-hidden="true"
                >
                  <circle
                    className="st-check-ring"
                    cx="26"
                    cy="26"
                    r="24"
                    pathLength={151}
                  />
                  <path
                    className="st-check-tick"
                    d="M16 27l6.5 6.5L36 18.5"
                    pathLength={28}
                  />
                </svg>
                Your order has been placed
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* The scrim is the page's, not the widget's: it covers everything
          and it is what makes the ticket readable-but-untouchable. Kept
          outside the deck so it paints over the card rather than under
          it — inside, it would sit in the same box it is meant to dim. */}
      <AnimatePresence>
        {confirming && (
          <motion.button
            key="scrim"
            type="button"
            className="st-scrim"
            aria-label="Close order confirmation"
            /* Out of the tab order: the focus trap above keeps Tab inside
               the panel, and this is a click target, not a stop. */
            tabIndex={-1}
            onClick={() => setConfirming(null)}
            /* Only the standard property: Motion's types do not carry the
               -webkit- alias, and every engine that ships backdrop-filter
               today accepts it unprefixed. */
            initial={{
              opacity: 0,
              backdropFilter: BACKDROP_OFF,
            }}
            animate={{
              opacity: 1,
              backdropFilter: BACKDROP_ON,
            }}
            exit={{
              opacity: 0,
              backdropFilter: BACKDROP_OFF,
            }}
            transition={BACKDROP}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** One reading on the confirmation: what it is on the left, what it says
    on the right, on the panel's two edges. */
function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="st-conf-row">
      <span className="st-conf-k">{k}</span>
      <span className="st-conf-v">{v}</span>
    </div>
  );
}
