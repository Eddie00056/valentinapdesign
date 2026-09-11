import type React from "react";
import { useEffect, useRef } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import {
  type ChainRow as ChainRowData,
  type Expiry,
  type OptionQuote,
  type OptionSide,
} from "./types";
import { formatCount, formatCurrency, formatPercent } from "./format";
import { DURATION, EASING, LADDER_SPRING } from "./motion";
import { ChevronRight } from "./icons";

/* Everything reads from the left — label and figure share one edge in
   every column, so a header always sits directly over its own values. */
const COLUMNS = ["Strike", "Volume", "Open int.", "IV", "Bid", "Ask"] as const;

function quoteFor(row: ChainRowData, side: OptionSide): OptionQuote {
  return side === "call" ? row.call : row.put;
}

/**
 * A price cell: the whole cell is the target, not the chip inside it.
 *
 * The chip is 42 x 20 and the cell it sits in is up to 94 x 30 — so under
 * half of what reads as "the price" was actually clickable, and the rest
 * was worse than inert: the cell stopped the click to keep the row from
 * expanding, so a press a few pixels off the chip did nothing at all. It
 * looked exactly like a click that had not registered, and the fix people
 * reach for is to click again — which, on a quote already taken, takes it
 * back off.
 *
 * The handler lives here and the chip is only paint.
 */
function PriceCell({
  tone,
  value,
  picked,
  onPick,
  label,
}: {
  tone: "bid" | "ask";
  value: string;
  picked: boolean;
  onPick?: () => void;
  label: string;
}) {
  return (
    <span
      className="oc-cell oc-cell--pill"
      role={onPick ? "button" : undefined}
      aria-label={onPick ? label : undefined}
      aria-pressed={onPick ? picked : undefined}
      onClick={(e) => {
        /* Always, even with nothing to pick: a click on a price is about
           the price, and must not open the row underneath it. */
        e.stopPropagation();
        onPick?.();
      }}
    >
      <span
        className={`oc-pill oc-pill--${tone} oc-num`}
        data-picked={picked || undefined}
      >
        {value}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Expanded detail                                                     */
/* ------------------------------------------------------------------ */

/** The day's range and prior close aren't quoted fields — they're derived
    from the mark and the day's change so the panel stays internally
    consistent with the row above it.

    Ordering is column-wise on purpose: with five per row, bid sits above
    ask, high above low, and volume above open interest. */
function StatsPanel({ quote }: { quote: OptionQuote }) {
  const prevClose = quote.last - quote.change;
  const high = quote.mark * 1.35;
  const low = quote.mark * 0.62;

  return (
    <div className="oc-detail">
      <div className="oc-detail-h">Stats</div>
      <div className="oc-detail-rule" />
      <div className="oc-detail-grid">
        <Detail label="Bid" value={`$${formatCurrency(quote.bid)}`} />
        <Detail label="High" value={`$${formatCurrency(high)}`} />
        <Detail label="Last Trade" value={`$${formatCurrency(quote.last)}`} />
        <Detail label="Volume" value={formatCount(quote.volume)} />
        <Detail label="Prev Close" value={`$${formatCurrency(prevClose)}`} />
        <Detail label="Ask" value={`$${formatCurrency(quote.ask)}`} />
        <Detail label="Low" value={`$${formatCurrency(low)}`} />
        <Detail label="IV" value={formatPercent(quote.iv, 2)} />
        <Detail label="Open Interest" value={formatCount(quote.openInterest)} />
      </div>

      <div className="oc-detail-h">The Greeks</div>
      <div className="oc-detail-rule" />
      <div className="oc-detail-grid oc-detail-grid--greeks">
        <Detail label="Delta" value={quote.delta.toFixed(4)} />
        <Detail label="Gamma" value={quote.gamma.toFixed(4)} />
        <Detail label="Theta" value={quote.theta.toFixed(4)} />
        <Detail label="Vega" value={quote.vega.toFixed(4)} />
        <Detail label="Rho" value={quote.rho.toFixed(4)} />
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="oc-detail-cell">
      <span className="oc-detail-k">{label}</span>
      <span className="oc-detail-v oc-num">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Row                                                                 */
/* ------------------------------------------------------------------ */

function Row({
  row,
  side,
  expiry,
  isOpen,
  onToggle,
  onPick,
  picked,
}: {
  row: ChainRowData;
  side: OptionSide;
  /** ISO date — travels with every pick made on this row. */
  expiry: string;
  isOpen: boolean;
  onToggle: () => void;
  onPick?: (pick: QuotePick) => void;
  /** Which of THIS row's pills is on the ticket, if either. */
  picked?: "bid" | "ask";
}) {
  const quote = quoteFor(row, side);

  return (
    <>
      <button
        type="button"
        className="oc-grid oc-row"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <span className="oc-cell oc-cell--strike">
          <span className="oc-row-caret">
            <ChevronRight size={11} />
          </span>
          <span className="oc-num oc-bold">${row.strike}</span>
        </span>
        <span className="oc-cell oc-num">{formatCount(quote.volume)}</span>
        <span className="oc-cell oc-num">{formatCount(quote.openInterest)}</span>
        <span className="oc-cell oc-num">
          {formatPercent(quote.iv, 2)}
        </span>
        {/* Each price is its own target, and the target is the whole
            cell — see PriceCell. */}
        <PriceCell
          tone="bid"
          value={`$${formatCurrency(quote.bid)}`}
          picked={picked === "bid"}
          label={`Sell ${row.strike} ${side} at ${formatCurrency(quote.bid)}`}
          onPick={
            onPick &&
            (() =>
              onPick({
                strike: row.strike,
                kind: side,
                /* You SELL into the bid. The side a click implies is the
                   whole point of picking a price off a chain. */
                action: "sell",
                price: quote.bid,
                expiry,
              }))
          }
        />
        <PriceCell
          tone="ask"
          value={`$${formatCurrency(quote.ask)}`}
          picked={picked === "ask"}
          label={`Buy ${row.strike} ${side} at ${formatCurrency(quote.ask)}`}
          onPick={
            onPick &&
            (() =>
              onPick({
                strike: row.strike,
                kind: side,
                /* And you BUY at the ask. */
                action: "buy",
                price: quote.ask,
                expiry,
              }))
          }
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DURATION.base, ease: EASING.standard }}
            style={{ overflow: "hidden" }}
          >
            <StatsPanel quote={quote} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Table                                                               */
/* ------------------------------------------------------------------ */

/** What a click on a bid or an ask says. */
export type QuotePick = {
  strike: number;
  kind: OptionSide;
  action: "buy" | "sell";
  price: number;
  /* The expiry the chain is showing, as an ISO date. The chain owns which
     contract this is — all four of strike, side, expiry and price are
     decided here, which is what lets the ticket beside it stop offering
     to change any of them. */
  expiry: string;
};

interface ChainTableProps {
  rows: ChainRowData[];
  side: OptionSide;
  spot: number;
  expiry: Expiry;
  openStrike: number | null;
  onToggleStrike: (strike: number) => void;
  /** Given, the price pills become buttons that quote into a ticket. */
  onPick?: (pick: QuotePick) => void;
  /**
   * Which quotes are on the ticket, as `strike:kind:action:expiry`. Held by
   * whoever owns the ticket rather than by the table, so the lit pills
   * and the ticket's legs are one fact instead of two that can drift.
   */
  pickedKeys?: ReadonlySet<string>;
}

/**
 * The ladder.
 *
 * Five strikes above the spot line and five below, fixed at $5 apart, with
 * no scroll — the whole ladder is on screen at once, so the eye compares
 * strikes by position rather than by scrolling.
 *
 * Figures update in place: no per-digit roll, and no flash behind them.
 * Fifty-odd numbers rotating or lighting up at once read as the table
 * churning rather than as a market moving. Tabular figures keep the
 * columns from shivering as digits swap, and that is the whole treatment.
 *
 * Nothing here remounts on a side or expiry change. The ladder is
 * anchored, so the same eleven strikes are on screen either way — only
 * their numbers differ, and the odometers carry that. Replaying an
 * entrance stagger would be staging a load for data that never arrives,
 * which is what made switching call/put feel like a page fetch.
 *
 * The one thing that does move is the spot line: it sits between the two
 * strikes that straddle price, so crossing a strike slides it past that
 * row on a spring.
 */
export function ChainTable({
  rows,
  side,
  spot,
  expiry,
  openStrike,
  onToggleStrike,
  onPick,
  pickedKeys,
}: ChainTableProps) {
  const reduce = useReducedMotion();
  const spring = reduce ? { duration: 0 } : LADDER_SPRING;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  /* True while the effect below is still putting the ladder on the money.
     That is a scroll the reader did not ask for, and it must not flash
     the scrollbar on load. */
  const centring = useRef(true);

  /* Open centred on the money. The ladder runs well past the widget in
     both directions, and the strikes worth seeing first are the ones
     around spot — landing at the top would show eleven strikes nobody is
     trading. Runs once per expiry, not on every tick. */
  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;

    let done = false;
    let abandoned = false;

    /* Centred on the money, and it has to keep trying to get there.

       Done once from the effect, this landed at the top with the money
       165px below the fold: at that moment the scroller is not taller
       than its content yet, so `scrollTop +=` clamps to 0. Retrying on
       requestAnimationFrame fixed it on a focused tab and still did
       nothing on a background one — rAF does not fire while a document is
       hidden, which is exactly how this widget loads inside the gallery's
       iframes. A timer runs either way, so the retry is a timer. */
    const attempt = () => {
      if (done || abandoned) return true;

      const line = box.querySelector<HTMLElement>(".oc-spot");
      /* No line, or nothing to scroll, means the ladder is not laid out
         yet. Not a failure — just not yet. */
      if (!line || box.scrollHeight <= box.clientHeight) return false;

      /* Measured from rects, not offsetTop: the line is positioned, and
         its offsetParent is the card rather than this scroller, so
         offsetTop overshoots and pins the ladder to its bottom. */
      const lineBox = line.getBoundingClientRect();
      const viewBox = box.getBoundingClientRect();
      const delta =
        lineBox.top + lineBox.height / 2 - (viewBox.top + viewBox.height / 2);

      /* A sub-pixel remainder is the line's own half-pixel, not a miss. */
      if (Math.abs(delta) <= 1) {
        done = true;
        centring.current = false;
        return true;
      }

      box.scrollTop += delta;
      return false;
    };

    attempt();
    const tick = setInterval(() => {
      if (attempt()) clearInterval(tick);
    }, 50);
    /* A ceiling, so a piece that never lays out cannot leave a timer
       running for the life of the page. */
    const ceiling = setTimeout(() => {
      centring.current = false;
      clearInterval(tick);
    }, 2000);

    /* A tab that was hidden through all of the above gets one more go the
       moment it is looked at. */
    const onShow = () => {
      if (!document.hidden) attempt();
    };
    document.addEventListener("visibilitychange", onShow);

    /* The moment the reader touches the ladder it is theirs — a retry
       that outlived the first scroll would yank them back to the money. */
    const abandon = () => {
      abandoned = true;
      centring.current = false;
      clearInterval(tick);
    };
    box.addEventListener("wheel", abandon, { passive: true, once: true });
    box.addEventListener("pointerdown", abandon, { passive: true, once: true });
    box.addEventListener("keydown", abandon, { once: true });

    return () => {
      clearInterval(tick);
      clearTimeout(ceiling);
      document.removeEventListener("visibilitychange", onShow);
      box.removeEventListener("wheel", abandon);
      box.removeEventListener("pointerdown", abandon);
      box.removeEventListener("keydown", abandon);
    };
  }, [expiry.id, side]);

  /* The scrollbar is drawn only while the ladder is being scrolled.

     A flag on the element rather than React state: this fires on every
     scroll event, and re-rendering twenty-three rows and their layout
     projections to paint an 8px bar would be the most expensive thing on
     the widget. The style is in the CSS, keyed on [data-scrolling]. */
  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    let idle: number | undefined;
    const onScroll = () => {
      /* Not the opening scroll-to-the-money — nobody asked for that one. */
      if (centring.current) return;
      box.dataset.scrolling = "";
      window.clearTimeout(idle);
      idle = window.setTimeout(() => delete box.dataset.scrolling, 700);
    };
    box.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      box.removeEventListener("scroll", onScroll);
      window.clearTimeout(idle);
    };
  }, []);

  /* Rows descend through price, so the line belongs just above the first
     strike that spot has not cleared. Crossing a strike changes this
     index by one, and that index change is the whole animation. */
  const lineIndex = rows.findIndex((row) => row.strike <= spot);
  const insertAt = lineIndex === -1 ? rows.length : lineIndex;

  /* One flat array with stable keys, so React MOVES the line's node
     rather than unmounting and remounting it — that is what lets Motion
     animate it from its old position to its new one instead of having it
     blink out and reappear a row up. */
  const ladder: React.ReactNode[] = [];
  rows.forEach((row, i) => {
    if (i === insertAt) ladder.push(<SpotLine key="spot" spot={spot} spring={spring} />);
    ladder.push(
      <motion.div key={row.strike} layout="position" transition={spring}>
        <Row
          row={row}
          side={side}
          expiry={expiry.date}
          isOpen={openStrike === row.strike}
          onToggle={() => onToggleStrike(row.strike)}
          onPick={onPick}
          picked={
            /* The bid is the sell side and the ask the buy side — see the
               pick handlers on the pills themselves. */
            pickedKeys?.has(`${row.strike}:${side}:sell:${expiry.date}`)
              ? "bid"
              : pickedKeys?.has(`${row.strike}:${side}:buy:${expiry.date}`)
                ? "ask"
                : undefined
          }
        />
      </motion.div>,
    );
  });
  if (insertAt === rows.length) {
    ladder.push(<SpotLine key="spot" spot={spot} spring={spring} />);
  }

  return (
    <div className="oc-table">
      <div className="oc-grid oc-head" role="row">
        {COLUMNS.map((c, i) => (
          <span
            key={c}
            className={`oc-cell${i === 0 ? " oc-cell--strike" : ""}`}
          >
            {c}
          </span>
        ))}
      </div>

      <div className="oc-scroll" ref={scrollRef}>
        <LayoutGroup id={`ladder-${expiry.id}`}>{ladder}</LayoutGroup>
      </div>
    </div>
  );
}

/**
 * The spot line.
 *
 * `layout="position"` animates where it sits without touching its size,
 * so the dotted rule and the pill travel together and neither gets
 * scale-distorted on the way. The row it renders between never moves —
 * the slot is zero-height and the rule is drawn on it, so crossing a
 * strike slides the line across a table that holds still.
 */
function SpotLine({
  spot,
  spring,
}: {
  spot: number;
  spring: object;
}) {
  return (
    <motion.div className="oc-spot" role="separator" layout="position" transition={spring}>
      <span className="oc-spot-pill oc-num">${formatCurrency(spot)}</span>
    </motion.div>
  );
}
