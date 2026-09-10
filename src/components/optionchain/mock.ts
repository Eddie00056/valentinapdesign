/**
 * Deterministic synthetic option chain.
 *
 * Prices come from a real Black-Scholes evaluation with a volatility smile, so
 * the numbers in the mock behave correctly relative to each other: deltas cross
 * 0.5 at the money, theta accelerates into expiry, extrinsic value peaks at ATM.
 * That matters for a design review: a chain with random numbers reads as noise
 * and reviewers cannot judge the colour/heatmap encodings.
 */

import {
  type ChainRow,
  type Expiry,
  type ExpiryKind,
  type Moneyness,
  type OptionQuote,
  type OptionSide,
  type Underlying,
} from './types';

/* ------------------------------------------------------------------ */
/* Deterministic RNG                                                   */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Black-Scholes                                                       */
/* ------------------------------------------------------------------ */

const SQRT_2PI = Math.sqrt(2 * Math.PI);

function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / SQRT_2PI;
}

/** Abramowitz & Stegun 7.1.26 approximation. */
function normCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}

interface BsResult {
  price: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

function blackScholes(
  side: OptionSide,
  spot: number,
  strike: number,
  years: number,
  vol: number,
  rate = 0.0425,
): BsResult {
  const t = Math.max(years, 1 / 365 / 8);
  const sqrtT = Math.sqrt(t);
  const d1 =
    (Math.log(spot / strike) + (rate + 0.5 * vol * vol) * t) / (vol * sqrtT);
  const d2 = d1 - vol * sqrtT;
  const df = Math.exp(-rate * t);
  const nd1 = normCdf(d1);
  const nd2 = normCdf(d2);
  const pdf = normPdf(d1);

  const gamma = pdf / (spot * vol * sqrtT);
  const vega = (spot * pdf * sqrtT) / 100;

  if (side === 'call') {
    return {
      price: spot * nd1 - strike * df * nd2,
      delta: nd1,
      gamma,
      vega,
      theta:
        (-(spot * pdf * vol) / (2 * sqrtT) - rate * strike * df * nd2) / 365,
      rho: (strike * t * df * nd2) / 100,
    };
  }
  return {
    price: strike * df * (1 - nd2) - spot * (1 - nd1),
    delta: nd1 - 1,
    gamma,
    vega,
    theta:
      (-(spot * pdf * vol) / (2 * sqrtT) + rate * strike * df * (1 - nd2)) / 365,
    rho: (-strike * t * df * (1 - nd2)) / 100,
  };
}

/* ------------------------------------------------------------------ */
/* Volatility smile                                                    */
/* ------------------------------------------------------------------ */

/** Downside skew plus a term-structure lift, which is what equity chains look like. */
function impliedVol(
  spot: number,
  strike: number,
  years: number,
  baseVol: number,
): number {
  const moneyness = Math.log(strike / spot);
  const skew = -0.55 * moneyness;
  const smile = 1.9 * moneyness * moneyness;
  const term = 0.06 * Math.sqrt(Math.max(years, 0.02));
  return Math.max(0.08, baseVol + skew + smile + term);
}

/* ------------------------------------------------------------------ */
/* Underlying                                                          */
/* ------------------------------------------------------------------ */

export const UNDERLYING: Underlying = {
  symbol: 'PLTR',
  name: 'Palantir Technologies',
  last: 175,
  change: 3.18,
  changePct: 0.0185,
  currency: 'USD',
  marketStatus: 'open',
  ivRank: 63,
};

/* ------------------------------------------------------------------ */
/* Expiries                                                            */
/* ------------------------------------------------------------------ */

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Fixed "today" so the mock is reproducible in screenshots and Chromatic. */
export const MOCK_TODAY = new Date('2026-09-09T14:30:00Z');

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatExpiryLabel(d: Date): string {
  return `${MONTH_LABELS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function classifyExpiry(dte: number, d: Date): ExpiryKind {
  if (dte > 365) return 'leaps';
  const isThirdFriday =
    d.getUTCDay() === 5 && d.getUTCDate() >= 15 && d.getUTCDate() <= 21;
  if (!isThirdFriday) return 'weekly';
  return [2, 5, 8, 11].includes(d.getUTCMonth()) ? 'quarterly' : 'monthly';
}

export function buildExpiries(): Expiry[] {
  const rand = mulberry32(20260909);
  const offsets = [
    2, 9, 16, 23, 30, 37, 44, 58, 72, 100, 128, 191, 282, 373, 464, 555, 737,
  ];
  return offsets.map((dte, i) => {
    const date = addDays(MOCK_TODAY, dte);
    const kind = classifyExpiry(dte, date);
    const liquidityWeight = kind === 'weekly' ? 1 : kind === 'monthly' ? 3.4 : 2.1;
    return {
      id: `exp-${isoDate(date)}`,
      date: isoDate(date),
      label: formatExpiryLabel(date),
      dte,
      kind,
      totalOpenInterest: Math.round(
        (120_000 / Math.sqrt(dte)) * liquidityWeight * (0.7 + rand() * 0.6),
      ),
      // One earnings-bearing expiry, the one straddling the next report.
      isEarnings: i === 4,
    };
  });
}

export const EXPIRIES = buildExpiries();

/* ------------------------------------------------------------------ */
/* Chain                                                               */
/* ------------------------------------------------------------------ */

function strikeIncrement(spot: number): number {
  if (spot < 25) return 1;
  if (spot < 100) return 2.5;
  if (spot < 250) return 5;
  return 10;
}

function occSymbol(
  symbol: string,
  isoExpiry: string,
  side: OptionSide,
  strike: number,
): string {
  const [y, m, d] = isoExpiry.split('-');
  const strikeField = String(Math.round(strike * 1000)).padStart(8, '0');
  return `${symbol.padEnd(6, ' ')}${y.slice(2)}${m}${d}${side === 'call' ? 'C' : 'P'}${strikeField}`;
}

function moneynessFor(
  side: OptionSide,
  strike: number,
  spot: number,
  increment: number,
): Moneyness {
  if (Math.abs(strike - spot) <= increment / 2) return 'atm';
  if (side === 'call') return strike < spot ? 'itm' : 'otm';
  return strike > spot ? 'itm' : 'otm';
}

function roundTo(value: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

function buildQuote(
  side: OptionSide,
  strike: number,
  spot: number,
  expiry: Expiry,
  baseVol: number,
  rand: () => number,
): OptionQuote {
  const years = expiry.dte / 365;
  const iv = impliedVol(spot, strike, years, baseVol);
  const bs = blackScholes(side, spot, strike, years, iv);
  const mark = Math.max(0.01, bs.price);

  // Spread widens with distance from the money and with time to expiry.
  const absDelta = Math.abs(bs.delta);
  const spreadPct = 0.012 + 0.09 * (1 - absDelta * 2 > 0 ? 1 - absDelta * 2 : 0);
  const halfSpread = Math.max(0.01, mark * spreadPct * (0.7 + rand() * 0.6)) / 2;
  const bid = Math.max(0, roundTo(mark - halfSpread, 2));
  const ask = roundTo(mark + halfSpread, 2);

  // Volume and OI peak near the money and decay into the wings.
  const atmProximity = Math.exp(-((Math.log(strike / spot) / 0.09) ** 2) / 2);
  const roundStrikeBonus = strike % 10 === 0 ? 1.6 : 1;
  const oi = Math.round(
    atmProximity * roundStrikeBonus * (18_000 / Math.sqrt(expiry.dte)) * (0.35 + rand() * 1.3),
  );
  const volume = Math.round(oi * (0.12 + rand() * 0.55));

  const intrinsic = Math.max(
    0,
    side === 'call' ? spot - strike : strike - spot,
  );
  const changePct = (rand() - 0.42) * 0.34 * (side === 'call' ? 1 : -1);

  return {
    occSymbol: occSymbol(UNDERLYING.symbol, expiry.date, side, strike),
    side,
    strike,
    bid,
    ask,
    bidSize: Math.max(1, Math.round(rand() * 90 * atmProximity + 2)),
    askSize: Math.max(1, Math.round(rand() * 90 * atmProximity + 2)),
    last: roundTo(bid + (ask - bid) * rand(), 2),
    mark: roundTo(mark, 2),
    change: roundTo(mark * changePct, 2),
    changePct: roundTo(changePct, 4),
    volume,
    openInterest: oi,
    iv: roundTo(iv, 4),
    delta: roundTo(bs.delta, 3),
    gamma: roundTo(bs.gamma, 4),
    theta: roundTo(bs.theta, 3),
    vega: roundTo(bs.vega, 3),
    rho: roundTo(bs.rho, 3),
    breakEven: roundTo(side === 'call' ? strike + mark : strike - mark, 2),
    intrinsic: roundTo(intrinsic, 2),
    extrinsic: roundTo(Math.max(0, mark - intrinsic), 2),
    moneyness: moneynessFor(side, strike, spot, strikeIncrement(spot)),
    isIlliquid: bid === 0 || oi < 25,
  };
}

export function buildChain(
  expiry: Expiry,
  spot: number = UNDERLYING.last,
  strikeCount = 41,
): ChainRow[] {
  const rand = mulberry32(expiry.dte * 7919 + 13);
  const increment = strikeIncrement(spot);
  const atmStrike = Math.round(spot / increment) * increment;
  const half = Math.floor(strikeCount / 2);
  const baseVol = 0.42 + (UNDERLYING.ivRank / 100) * 0.1;

  return Array.from({ length: strikeCount }, (_, i) => {
    const strike = roundTo(atmStrike + (i - half) * increment, 2);
    return {
      strike,
      call: buildQuote('call', strike, spot, expiry, baseVol, rand),
      put: buildQuote('put', strike, spot, expiry, baseVol, rand),
      isAtm: strike === atmStrike,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Derived helpers used by the heatmap encodings                       */
/* ------------------------------------------------------------------ */

export interface ChainScale {
  maxVolume: number;
  maxOpenInterest: number;
}

export function computeChainScale(rows: ChainRow[]): ChainScale {
  return rows.reduce<ChainScale>(
    (acc, row) => ({
      maxVolume: Math.max(acc.maxVolume, row.call.volume, row.put.volume),
      maxOpenInterest: Math.max(
        acc.maxOpenInterest,
        row.call.openInterest,
        row.put.openInterest,
      ),
    }),
    { maxVolume: 1, maxOpenInterest: 1 },
  );
}

/** Clip the chain to ±n strikes around the money. */
export function sliceAroundAtm(rows: ChainRow[], count: number): ChainRow[] {
  if (count >= rows.length) return rows;
  const atmIndex = Math.max(0, rows.findIndex((r) => r.isAtm));
  const half = Math.floor(count / 2);
  const start = Math.max(0, Math.min(atmIndex - half, rows.length - count));
  return rows.slice(start, start + count);
}

/* ------------------------------------------------------------------ */
/* Simulated live feed                                                 */
/* ------------------------------------------------------------------ */

/** Stable per-contract hash so each strike jitters on its own rhythm. */
function hashSymbol(symbol: string): number {
  let h = 2166136261;
  for (let i = 0; i < symbol.length; i += 1) {
    h ^= symbol.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Nudges the price fields of a quote for tick `n`.
 *
 * Only about a third of contracts move on any given tick, which is what a real
 * chain looks like. A wall of simultaneously flashing cells reads as a bug.
 */
export function applyTick(quote: OptionQuote, n: number): OptionQuote {
  if (n === 0) return quote;

  const rand = mulberry32(hashSymbol(quote.occSymbol) + n * 2654435761);

  /* Liquidity always advances: volume only accumulates through a session,
     and open interest drifts. These move on every tick so no row is ever
     completely frozen. */
  const volume = quote.volume + Math.round(rand() * quote.volume * 0.03);
  const openInterest = Math.max(
    0,
    quote.openInterest + Math.round((rand() - 0.45) * quote.openInterest * 0.02),
  );

  /* Price moves on about half of contracts per tick. Walking every quote
     at once reads as a bug rather than as a market. */
  if (rand() > 0.5) return { ...quote, volume, openInterest };

  const step = Math.max(0.01, quote.mark * 0.012);
  const drift = (rand() - 0.5) * 2 * step;
  const mark = Math.max(0.01, roundTo(quote.mark + drift, 2));
  const halfSpread = Math.max(0.01, (quote.ask - quote.bid) / 2);

  return {
    ...quote,
    volume,
    openInterest,
    mark,
    bid: Math.max(0, roundTo(mark - halfSpread, 2)),
    ask: roundTo(mark + halfSpread, 2),
    last: roundTo(mark, 2),
    change: roundTo(quote.change + drift, 2),
    changePct: roundTo(quote.changePct + drift / Math.max(mark, 0.01) / 10, 4),
    // Break-even tracks the premium, so chance of profit moves with it.
    breakEven: roundTo(
      quote.side === 'call' ? quote.strike + mark : quote.strike - mark,
      2,
    ),
  };
}

export function applyTickToRow(row: ChainRow, n: number): ChainRow {
  if (n === 0) return row;
  return { ...row, call: applyTick(row.call, n), put: applyTick(row.put, n) };
}
