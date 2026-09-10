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

/** Stops a click inside a bid/ask cell from reaching the row button. */
function swallow(e: React.MouseEvent) {
  e.stopPropagation();
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
  isOpen,
  onToggle,
}: {
  row: ChainRowData;
  side: OptionSide;
  isOpen: boolean;
  onToggle: () => void;
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
        {/* The pills are their own targets: a click on a price is a
            price action, not a request to open the row. Swallowing it
            here keeps the rest of the row expanding as before. */}
        <span className="oc-cell oc-cell--pill" onClick={swallow}>
          <span className="oc-pill oc-pill--bid oc-num">
            ${formatCurrency(quote.bid)}
          </span>
        </span>
        <span className="oc-cell oc-cell--pill" onClick={swallow}>
          <span className="oc-pill oc-pill--ask oc-num">
            ${formatCurrency(quote.ask)}
          </span>
        </span>
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

interface ChainTableProps {
  rows: ChainRowData[];
  side: OptionSide;
  spot: number;
  expiry: Expiry;
  openStrike: number | null;
  onToggleStrike: (strike: number) => void;
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
}: ChainTableProps) {
  const reduce = useReducedMotion();
  const spring = reduce ? { duration: 0 } : LADDER_SPRING;
  const scrollRef = useRef<HTMLDivElement | null>(null);

  /* Open centred on the money. The ladder runs well past the widget in
     both directions, and the strikes worth seeing first are the ones
     around spot — landing at the top would show eleven strikes nobody is
     trading. Runs once per expiry, not on every tick. */
  useEffect(() => {
    let frame = 0;
    let tries = 0;

    /* Deferred to a frame, and retried until it takes.
       
       Running straight from the effect landed on a scroller that had not
       been laid out yet — clientHeight 0, so the delta computed to
       nothing and the ladder opened pinned to $230 with the money 165px
       below the fold. Waiting a frame is usually enough; the retry covers
       the hydration order not being guaranteed. */
    const centre = () => {
      const box = scrollRef.current;
      const line = box?.querySelector<HTMLElement>(".oc-spot");
      if (!box || !line) return;

      if (box.clientHeight === 0 && tries < 10) {
        tries += 1;
        frame = requestAnimationFrame(centre);
        return;
      }

      /* Measured from rects, not offsetTop: the line is positioned, and
         its offsetParent is the card rather than this scroller, so
         offsetTop overshoots and pins the ladder to its bottom. */
      const lineBox = line.getBoundingClientRect();
      const viewBox = box.getBoundingClientRect();
      const delta =
        lineBox.top + lineBox.height / 2 - (viewBox.top + viewBox.height / 2);
      box.scrollTop += delta;

      /* A sub-pixel remainder is the spot line's own half-pixel, not a
         failure — anything larger means the scroll did not stick, so try
         again next frame. */
      if (Math.abs(delta) > 1 && tries < 10) {
        tries += 1;
        frame = requestAnimationFrame(centre);
      }
    };

    frame = requestAnimationFrame(centre);
    return () => cancelAnimationFrame(frame);
  }, [expiry.id, side]);

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
          isOpen={openStrike === row.strike}
          onToggle={() => onToggleStrike(row.strike)}
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
