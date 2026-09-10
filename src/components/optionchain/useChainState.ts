import { useCallback, useMemo, useState } from "react";
import { applyTickToRow, buildChain, EXPIRIES } from "./mock";
import { type ChainRow, type OptionSide } from "./types";

/** Strikes step $5 either side of the $175 anchor, and the anchor itself
    is a row. Eleven rows, no scroll — the whole ladder is on screen at
    once, and the spot line rides between whichever two straddle price. */
export const STRIKE_STEP = 5;
export const ROWS_PER_SIDE = 5;

/**
 * View state for the widget: what you'd trade (call/put), when it
 * expires, and which strike is opened for detail.
 */
export function useChainState(spot: number, tick: number) {
  const [side, setSide] = useState<OptionSide>("call");
  const [expiryId, setExpiryId] = useState(EXPIRIES[0].id);
  const [openStrike, setOpenStrike] = useState<number | null>(null);

  const expiry = useMemo(
    () => EXPIRIES.find((e) => e.id === expiryId) ?? EXPIRIES[0],
    [expiryId],
  );

  const toggleStrike = useCallback((strike: number) => {
    setOpenStrike((prev) => (prev === strike ? null : strike));
  }, []);

  /**
   * The ladder is anchored, not derived from the live price: $150 to $200
   * at $5 steps, the $175 anchor included as its own row. Deriving the
   * set from a moving spot would let rows pop in and out as price crosses
   * a strike, and this table does not scroll — the rows have to hold
   * still so the only thing that moves is the line between them.
   */
  const ladder = useMemo(() => {
    const anchor = ANCHOR_SPOT;
    const wanted = new Set<number>();
    for (let i = -ROWS_PER_SIDE; i <= ROWS_PER_SIDE; i++) {
      wanted.add(anchor + i * STRIKE_STEP);
    }

    const byStrike = new Map<number, ChainRow>();
    for (const row of buildChain(expiry, anchor, ROWS_PER_SIDE * 4 + 1)) {
      if (wanted.has(row.strike)) byStrike.set(row.strike, row);
    }

    // Highest strike first, so the ladder reads downward through price.
    return [...wanted]
      .sort((a, b) => b - a)
      .map((strike) => byStrike.get(strike))
      .filter((r): r is ChainRow => r !== undefined);
  }, [expiry]);

  /* The ladder itself is stable; only the quotes on it walk. Ticking here
     rather than inside the builder keeps the strike set from being rebuilt
     every beat. */
  const rows = useMemo(
    () => ladder.map((row) => applyTickToRow(row, tick)),
    [ladder, tick],
  );

  return {
    side,
    setSide,
    expiryId,
    setExpiryId,
    expiry,
    openStrike,
    toggleStrike,
    rows,
    spot,
  };
}

/** The line sits at $175; the ladder is built off that, not off the tick. */
export const ANCHOR_SPOT = 175;
