/**
 * Value formatting for chain cells.
 *
 * Kept separate from the components so the same rules can be reused by the
 * order ticket, the leg tray and the CSV export without drifting.
 */

import { type ColumnFormat, type OptionQuote } from './types';

const compact = new Intl.NumberFormat('en-CA', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const integer = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 0 });

export function formatCurrency(value: number, dp = 2): string {
  return value.toLocaleString('en-CA', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

export function formatSigned(value: number, dp = 2): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${formatCurrency(Math.abs(value), dp)}`;
}

export function formatPercent(value: number, dp = 1): string {
  return `${(value * 100).toFixed(dp)}%`;
}

export function formatSignedPercent(value: number, dp = 2): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${(Math.abs(value) * 100).toFixed(dp)}%`;
}

/** Counts above 10k get compacted so the column never reflows. */
export function formatCount(value: number): string {
  return value >= 10_000 ? compact.format(value) : integer.format(value);
}

export function formatCell(quote: OptionQuote, format: ColumnFormat, columnId: string): string {
  switch (format) {
    case 'currency':
      return formatCurrency(readNumeric(quote, columnId));
    case 'currencySigned':
      return formatSigned(readNumeric(quote, columnId));
    case 'percent':
      return formatPercent(readNumeric(quote, columnId));
    case 'percentSigned':
      return formatSignedPercent(readNumeric(quote, columnId));
    case 'integer':
      return formatCount(readNumeric(quote, columnId));
    case 'decimal2':
      return readNumeric(quote, columnId).toFixed(2);
    case 'decimal4':
      return readNumeric(quote, columnId).toFixed(4);
    case 'size':
      return `${quote.bidSize} × ${quote.askSize}`;
    default:
      return '—';
  }
}

function readNumeric(quote: OptionQuote, columnId: string): number {
  const value = (quote as unknown as Record<string, unknown>)[columnId];
  return typeof value === 'number' ? value : 0;
}

/** Screen-reader label for a chain cell. The visual value alone is not enough. */
export function cellAriaLabel(
  quote: OptionQuote,
  columnLabel: string,
  value: string,
): string {
  const side = quote.side === 'call' ? 'call' : 'put';
  return `${columnLabel} ${value}, ${quote.strike} ${side}`;
}
