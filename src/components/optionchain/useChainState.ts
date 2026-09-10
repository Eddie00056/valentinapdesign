import { useCallback, useMemo, useState } from "react";
import { applyTickToRow, buildChain, EXPIRIES } from "./mock";
import { type ChainRow, type OptionSide } from "./types";

/** Strikes step $5 either side of the spot line. Five rows above, five
    below, and no scroll — the whole ladder is on screen at once. */
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
   * The ladder is anchored, not derived from the live price: five strikes
   * above the line and five below, fixed at $5 apart. Deriving it from a
   * moving spot would let a row pop in and out as the price crosses a
   * strike, and this table does not scroll — the rows have to hold still.
   */
  const ladder = useMemo(() => {
    const anchor = ANCHOR_SPOT;
    const perSide = ROWS_PER_SIDE;
    const wanted = new Set<number>();
    for (let i = 1; i <= perSide; i++) {
      wanted.add(anchor + i * STRIKE_STEP);
      wanted.add(anchor - i * STRIKE_STEP);
    }

    const byStrike = new Map<number, ChainRow>();
    for (const row of buildChain(expiry, anchor, ROWS_PER_SIDE * 4 + 1)) {
      if (wanted.has(row.strike)) byStrike.set(row.strike, row);
    }

    const pick = (from: number, dir: 1 | -1) =>
      Array.from({ length: perSide }, (_, i) =>
        byStrike.get(from + dir * (i + 1) * STRIKE_STEP),
      ).filter((r): r is ChainRow => r !== undefined);

    return {
      // Highest strike first, so the ladder reads down to the spot line.
      above: pick(anchor, 1).reverse(),
      below: pick(anchor, -1),
    };
  }, [expiry]);

  /* The ladder itself is stable; only the quotes on it walk. Ticking here
     rather than inside the builder keeps the strike set from being rebuilt
     every beat. */
  const above = useMemo(
    () => ladder.above.map((row) => applyTickToRow(row, tick)),
    [ladder.above, tick],
  );
  const below = useMemo(
    () => ladder.below.map((row) => applyTickToRow(row, tick)),
    [ladder.below, tick],
  );

  return {
    side,
    setSide,
    expiryId,
    setExpiryId,
    expiry,
    openStrike,
    toggleStrike,
    above,
    below,
    spot,
  };
}

/** The line sits at $175; the ladder is built off that, not off the tick. */
export const ANCHOR_SPOT = 175;
