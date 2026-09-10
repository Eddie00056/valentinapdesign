/**
 * Option chain domain types. Mockup only.
 * Shapes intentionally mirror what an `optionChain` GraphQL query would return
 * so the mock can be swapped for real data without touching the view layer.
 */

export type OptionSide = 'call' | 'put';

export type Moneyness = 'itm' | 'atm' | 'otm';

export interface OptionQuote {
  /** OCC-style contract symbol, e.g. AAPL  260918C00230000 */
  occSymbol: string;
  side: OptionSide;
  strike: number;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  last: number;
  mark: number;
  /** Absolute change on the contract's own price, in dollars. */
  change: number;
  changePct: number;
  volume: number;
  openInterest: number;
  /** Implied volatility as a decimal, e.g. 0.284 === 28.4% */
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  breakEven: number;
  intrinsic: number;
  extrinsic: number;
  moneyness: Moneyness;
  /** True when this contract has no resting quote on at least one side. */
  isIlliquid: boolean;
}

export interface ChainRow {
  strike: number;
  call: OptionQuote;
  put: OptionQuote;
  /** Row nearest to spot. Used to pin the ATM marker and auto-scroll. */
  isAtm: boolean;
}

export type ExpiryKind = 'weekly' | 'monthly' | 'quarterly' | 'leaps';

export interface Expiry {
  id: string;
  /** ISO date, YYYY-MM-DD */
  date: string;
  label: string;
  dte: number;
  kind: ExpiryKind;
  /** Aggregate open interest across the expiry. Drives the "most active" hint. */
  totalOpenInterest: number;
  isEarnings: boolean;
}

export interface Underlying {
  symbol: string;
  name: string;
  last: number;
  change: number;
  changePct: number;
  currency: 'CAD' | 'USD';
  marketStatus: 'open' | 'closed' | 'pre' | 'post';
  /** 30-day implied volatility rank, 0-100. */
  ivRank: number;
}

/* ------------------------------------------------------------------ */
/* Columns                                                             */
/* ------------------------------------------------------------------ */

export type ColumnId =
  | 'bid'
  | 'ask'
  | 'mark'
  | 'last'
  | 'change'
  | 'changePct'
  | 'volume'
  | 'openInterest'
  | 'bidAskSize'
  | 'iv'
  | 'delta'
  | 'gamma'
  | 'theta'
  | 'vega'
  | 'breakEven'
  | 'extrinsic';

export type ColumnGroup = 'price' | 'liquidity' | 'greeks' | 'analytics';

export type ColumnFormat =
  | 'currency'
  | 'currencySigned'
  | 'percent'
  | 'percentSigned'
  | 'integer'
  | 'decimal2'
  | 'decimal4'
  | 'size';

export interface ColumnDef {
  id: ColumnId;
  label: string;
  /** Used in the compact density and on narrow viewports. */
  shortLabel: string;
  group: ColumnGroup;
  format: ColumnFormat;
  /** Fixed px width so calls and puts stay mirrored across the strike gutter. */
  width: number;
  tooltip: string;
  /** Renders a horizontal magnitude bar behind the value. */
  heatmap?: boolean;
  /** Colour the value green/red by sign. */
  signed?: boolean;
}

export const COLUMN_DEFS: Record<ColumnId, ColumnDef> = {
  bid: {
    id: 'bid',
    label: 'Bid',
    shortLabel: 'Bid',
    group: 'price',
    format: 'currency',
    width: 72,
    tooltip: 'Highest price a buyer is currently willing to pay.',
  },
  ask: {
    id: 'ask',
    label: 'Ask',
    shortLabel: 'Ask',
    group: 'price',
    format: 'currency',
    width: 72,
    tooltip: 'Lowest price a seller is currently willing to accept.',
  },
  mark: {
    id: 'mark',
    label: 'Mark',
    shortLabel: 'Mark',
    group: 'price',
    format: 'currency',
    width: 72,
    tooltip: 'Midpoint between bid and ask. Used for estimated cost.',
  },
  last: {
    id: 'last',
    label: 'Last',
    shortLabel: 'Last',
    group: 'price',
    format: 'currency',
    width: 72,
    tooltip: 'Price of the most recent trade on this contract.',
  },
  change: {
    id: 'change',
    label: 'Change',
    shortLabel: 'Chg',
    group: 'price',
    format: 'currencySigned',
    width: 76,
    tooltip: "Change in the contract's price since the previous close.",
    signed: true,
  },
  changePct: {
    id: 'changePct',
    label: 'Change %',
    shortLabel: 'Chg %',
    group: 'price',
    format: 'percentSigned',
    width: 76,
    tooltip: "Percent change in the contract's price since the previous close.",
    signed: true,
  },
  volume: {
    id: 'volume',
    label: 'Volume',
    shortLabel: 'Vol',
    group: 'liquidity',
    format: 'integer',
    width: 80,
    tooltip: 'Contracts traded today. Higher volume usually means tighter spreads.',
    heatmap: true,
  },
  openInterest: {
    id: 'openInterest',
    label: 'Open interest',
    shortLabel: 'OI',
    group: 'liquidity',
    format: 'integer',
    width: 88,
    tooltip: 'Contracts currently outstanding at this strike.',
    heatmap: true,
  },
  bidAskSize: {
    id: 'bidAskSize',
    label: 'Size',
    shortLabel: 'Size',
    group: 'liquidity',
    format: 'size',
    width: 76,
    tooltip: 'Number of contracts available at the bid and at the ask.',
  },
  iv: {
    id: 'iv',
    label: 'Implied vol',
    shortLabel: 'IV',
    group: 'greeks',
    format: 'percent',
    width: 76,
    tooltip:
      "The market's expectation for how much the underlying will move, annualized.",
  },
  delta: {
    id: 'delta',
    label: 'Delta',
    shortLabel: 'Δ',
    group: 'greeks',
    format: 'decimal2',
    width: 68,
    tooltip: 'Expected change in the option price per $1 move in the underlying.',
  },
  gamma: {
    id: 'gamma',
    label: 'Gamma',
    shortLabel: 'Γ',
    group: 'greeks',
    format: 'decimal4',
    width: 72,
    tooltip: 'Rate of change of delta per $1 move in the underlying.',
  },
  theta: {
    id: 'theta',
    label: 'Theta',
    shortLabel: 'Θ',
    group: 'greeks',
    format: 'decimal2',
    width: 72,
    tooltip: 'Estimated value lost per day from time decay.',
  },
  vega: {
    id: 'vega',
    label: 'Vega',
    shortLabel: 'ν',
    group: 'greeks',
    format: 'decimal2',
    width: 68,
    tooltip: 'Change in option price per 1 point move in implied volatility.',
  },
  breakEven: {
    id: 'breakEven',
    label: 'Break even',
    shortLabel: 'B/E',
    group: 'analytics',
    format: 'currency',
    width: 88,
    tooltip: 'Underlying price at which this contract breaks even at expiry.',
  },
  extrinsic: {
    id: 'extrinsic',
    label: 'Time value',
    shortLabel: 'Time',
    group: 'analytics',
    format: 'currency',
    width: 80,
    tooltip: 'Portion of the premium that is not intrinsic value.',
  },
};

export const COLUMN_ORDER: ColumnId[] = [
  'bid',
  'ask',
  'mark',
  'last',
  'change',
  'changePct',
  'bidAskSize',
  'volume',
  'openInterest',
  'iv',
  'delta',
  'gamma',
  'theta',
  'vega',
  'breakEven',
  'extrinsic',
];

export type PresetId = 'basic' | 'liquidity' | 'greeks' | 'custom';

export const COLUMN_PRESETS: Record<Exclude<PresetId, 'custom'>, ColumnId[]> = {
  basic: ['bid', 'ask', 'last', 'change', 'volume'],
  liquidity: ['bid', 'ask', 'bidAskSize', 'volume', 'openInterest', 'iv'],
  greeks: ['mark', 'iv', 'delta', 'gamma', 'theta', 'vega'],
};

/* ------------------------------------------------------------------ */
/* View state                                                          */
/* ------------------------------------------------------------------ */

export type Density = 'comfortable' | 'compact';

export type StrikeRange = 'atm10' | 'atm20' | 'atm40' | 'all';

export const STRIKE_RANGE_LABELS: Record<StrikeRange, string> = {
  atm10: '±5 strikes',
  atm20: '±10 strikes',
  atm40: '±20 strikes',
  all: 'All strikes',
};

/* ------------------------------------------------------------------ */
/* Multi-leg builder                                                   */
/* ------------------------------------------------------------------ */

export type LegAction = 'buy' | 'sell';

export interface Leg {
  id: string;
  action: LegAction;
  side: OptionSide;
  strike: number;
  expiryId: string;
  quantity: number;
  quote: OptionQuote;
}

export type StrategyName =
  | 'Single'
  | 'Call debit spread'
  | 'Call credit spread'
  | 'Put debit spread'
  | 'Put credit spread'
  | 'Straddle'
  | 'Strangle'
  | 'Calendar spread'
  | 'Iron condor'
  | 'Custom';
