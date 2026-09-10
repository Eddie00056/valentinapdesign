import "./ticker-pill.css";

/** Magnifier, on the same 16px grid / 1.6 stroke as the rest of the set. */
export function Search({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
    >
      <circle cx="7.2" cy="7.2" r="4.4" />
      <path d="M10.6 10.6 13.6 13.6" />
    </svg>
  );
}

function currency(value: number, dp = 2): string {
  return value.toLocaleString("en-CA", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

export interface TickerPillProps {
  symbol: string;
  price: number;
  /** Against the previous close, in dollars. */
  change: number;
  /** Against the previous close, as a fraction — 0.0154 renders +1.54%. */
  changePct: number;
  /**
   * Symbol is fixed in these studies, so the field is shown in its
   * disabled state rather than hidden — the chrome still reads as
   * searchable without pretending the search works.
   */
  disabled?: boolean;
  className?: string;
}

/**
 * The underlying, as one pill: magnifier, symbol, price, change.
 *
 * Shared by the option chain and the options strategy builder, which show
 * the same thing at the top of the same card.
 */
export function TickerPill({
  symbol,
  price,
  change,
  changePct,
  disabled = true,
  className,
}: TickerPillProps) {
  const up = change >= 0;
  const sign = up ? "+" : "−";

  return (
    <span
      className={className ? `tpill ${className}` : "tpill"}
      aria-disabled={disabled || undefined}
    >
      <span className="tpill-sym">
        <Search size={14} />
        {symbol}
      </span>

      <span className="tpill-quote">
        <span className="tpill-px">${currency(price)}</span>
        <span className="tpill-chg" data-dir={up ? "up" : "down"}>
          {sign}${currency(Math.abs(change))}{" "}
          {sign}
          {(Math.abs(changePct) * 100).toFixed(2)}%
        </span>
      </span>
    </span>
  );
}
