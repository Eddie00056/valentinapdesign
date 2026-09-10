import { type Underlying } from "./types";
import { formatCurrency, formatSignedPercent } from "./format";
import { Rolling } from "../shared/RollingNumber";
import { Search } from "./icons";

/**
 * Symbol and price.
 *
 * The price is the options strategy builder's Bid/Ask treatment: 12px/400
 * tabular figures that odometer-roll digit by digit on a 300/30 spring,
 * from the shared `Rolling`. Same component, so the two pages tick
 * identically.
 */
export function QuoteBar({
  underlying,
  price,
  change,
  changePct,
}: {
  underlying: Underlying;
  /** Live values off the shared clock — `underlying` supplies identity only. */
  price: number;
  change: number;
  changePct: number;
}) {
  const isUp = change >= 0;

  return (
    <div className="oc-quote">
      {/* Symbol is fixed for this study — the field is shown in its
          disabled state rather than hidden, so the chrome still reads as
          a searchable chain. */}
      <span className="oc-search" aria-disabled="true">
        <Search size={12} />
        {underlying.symbol}
      </span>

      <span className="oc-quote-box">
        <Rolling
          className="oc-quote-px"
          value={`$${formatCurrency(price)}`}
        />
        <span className={`oc-quote-chg ${isUp ? "oc-up" : "oc-down"}`}>
          <Rolling
            value={`${isUp ? "+" : "−"}$${formatCurrency(Math.abs(change))} ${formatSignedPercent(changePct)}`}
          />
        </span>
      </span>
    </div>
  );
}
