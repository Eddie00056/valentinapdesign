import type React from "react";
import { type Underlying } from "./types";
import { formatCurrency, formatSignedPercent } from "./format";
import { Search } from "./icons";

/**
 * Symbol and price.
 *
 * The price keeps the options strategy builder's Bid/Ask type — 12px/400
 * tabular figures at zero letter-spacing — but not its odometer. Nothing
 * on this widget rotates as it changes now; figures update in place.
 */
export function QuoteBar({
  underlying,
  price,
  change,
  changePct,
  children,
}: {
  /** Trailing controls, folded into the same row. */
  children?: React.ReactNode;
  underlying: Underlying;
  /** Live values off the shared clock — `underlying` supplies identity only. */
  price: number;
  change: number;
  changePct: number;
}) {
  const isUp = change >= 0;

  return (
    <div className="oc-quote">
      {/* Symbol and price share one pill. They were two, and the seam
          between them was doing no work: what a chain is showing and what
          that underlying costs are one statement, read left to right. The
          field keeps the search affordance at its head. */}
      <span className="oc-quote-id">
        {/* Symbol is fixed for this study — shown in its disabled state
            rather than hidden, so the chrome still reads as a searchable
            chain. */}
        <span className="oc-search" aria-disabled="true">
          <Search size={14} />
          {underlying.symbol}
        </span>

        <span className="oc-quote-box">
          <span className="oc-quote-px oc-num">${formatCurrency(price)}</span>
          <span className={`oc-quote-chg oc-num ${isUp ? "oc-up" : "oc-down"}`}>
            {isUp ? "+" : "−"}${formatCurrency(Math.abs(change))}{" "}
            {formatSignedPercent(changePct)}
          </span>
        </span>
      </span>

      {children}
    </div>
  );
}
