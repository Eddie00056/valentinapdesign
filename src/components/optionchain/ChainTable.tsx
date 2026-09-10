import type React from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import {
  type ChainRow as ChainRowData,
  type Expiry,
  type OptionQuote,
  type OptionSide,
} from "./types";
import { formatCount, formatCurrency, formatPercent } from "./format";
import { DURATION, EASING, LADDER_SPRING } from "./motion";
import { useQuoteFlash } from "./useQuoteFlash";
import { ChevronRight } from "./icons";
import { Rolling } from "../shared/RollingNumber";

/* Each header takes its column's own alignment, the way Robinhood's chain
   does: the strike reads from the left, the plain figures right-align onto
   the same edge their digits stack on, and the two pill columns centre
   over their pills. A header that doesn't share its values' alignment
   stops reading as that column's label. */
const COLUMNS = [
  { label: "Strike", align: "start" },
  { label: "Volume", align: "end" },
  { label: "Open interest", align: "end" },
  { label: "IV", align: "center" },
  { label: "Bid", align: "center" },
  { label: "Ask", align: "center" },
] as const;

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
  const bidFlash = useQuoteFlash(quote.bid);
  const askFlash = useQuoteFlash(quote.ask);

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
        <span className="oc-cell">
          <Rolling value={formatCount(quote.volume)} />
        </span>
        <span className="oc-cell">
          <Rolling value={formatCount(quote.openInterest)} />
        </span>
        <span className="oc-cell oc-cell--mid">
          <Rolling value={formatPercent(quote.iv, 2)} />
        </span>
        {/* The pills are their own targets: a click on a price is a
            price action, not a request to open the row. Swallowing it
            here keeps the rest of the row expanding as before. */}
        <span className="oc-cell oc-cell--pill" onClick={swallow}>
          <span className="oc-pill oc-pill--bid" data-flash={bidFlash ?? undefined}>
            <Rolling value={`$${formatCurrency(quote.bid)}`} />
          </span>
        </span>
        <span className="oc-cell oc-cell--pill" onClick={swallow}>
          <span className="oc-pill oc-pill--ask" data-flash={askFlash ?? undefined}>
            <Rolling value={`$${formatCurrency(quote.ask)}`} />
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
 * Every figure is a `Rolling` odometer, so a value that changes rolls to
 * its new digits instead of swapping. At a 7s cadence that reads as a
 * market breathing rather than a table repainting.
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
        {COLUMNS.map((c) => (
          <span key={c.label} className={`oc-cell oc-cell--h-${c.align}`}>
            {c.label}
          </span>
        ))}
      </div>

      <LayoutGroup id={`ladder-${expiry.id}`}>{ladder}</LayoutGroup>
    </div>
  );
}

/**
 * The spot line.
 *
 * `layout="position"` animates where it sits without touching its size,
 * so the dotted rule and the pill travel together and neither gets
 * scale-distorted on the way.
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
