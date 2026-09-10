import type React from "react";
import { type Underlying } from "./types";
import { TickerPill } from "../shared/TickerPill";

/**
 * The control row: the underlying on the left, whatever you would trade
 * with it pushed right.
 *
 * The pill itself is shared with the options strategy builder. Nothing on
 * this widget rotates as it changes — figures update in place.
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
  return (
    <div className="oc-quote">
      {/* Symbol and price share one pill — see shared/TickerPill. */}
      <TickerPill
        symbol={underlying.symbol}
        price={price}
        change={change}
        changePct={changePct}
        className="oc-quote-id"
      />

      {children}
    </div>
  );
}
