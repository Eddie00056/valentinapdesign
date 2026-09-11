import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { motion } from "motion/react";
import { WidgetShell } from "../shared/WidgetShell";
import { QuoteBar } from "./QuoteBar";
import {
  ChainTable,
  type HoveredQuote,
  type QuotePick,
} from "./ChainTable";
import { ExpiryPicker } from "./ExpiryPicker";
import { useChainState } from "./useChainState";
import { pxHub } from "../alertscreen/priceHub";
import { UNDERLYING } from "./mock";
import { SEG_SPRING } from "./motion";
import { type OptionSide } from "./types";
import "./option-chain.css";

const SIDES: { id: OptionSide; label: string }[] = [
  { id: "call", label: "Call" },
  { id: "put", label: "Put" },
];

/* ONE clock drives everything on this widget.

   Price used to step on its own timer while the columns walked on
   another, so the two drifted and a price change never landed on the same
   frame as a column update. Both now come off the same tick, so every
   figure on the table — spot, quotes, volume, open interest — changes
   together.

   2200ms is pxHub's own step, so each render lands exactly one step of
   the site-wide walk rather than several at once. */
const TICK_MS = 2200;

/* Scripted price walk.

   Every value sits strictly inside the $170-$175 band, so the spot line
   stays on one seam for the life of the demo and never re-seats between
   rows. The line's position is still derived from price — cross a strike
   and it would move — the staged data simply never asks it to, because a
   row-height jump every few seconds is the one thing on this table that
   pulls the eye away from the numbers.

   Deterministic rather than random: the same sequence every load, so the
   piece reads identically each time it is opened. */
const SPOT_SEQ = [
  174.62, 174.08, 173.31, 172.76, 173.14, 173.85, 174.41, 174.07, 173.52,
  172.94, 173.63, 174.26,
];

/** Yesterday's close, set so the demo opens at the familiar +$3.18. */
const PREV_CLOSE = SPOT_SEQ[0] - UNDERLYING.change;

/* Resize bounds.

   The floor is not the table's — six columns would happily go on
   shrinking. It is the control row: symbol, price, Call/Put and the
   expiry are fixed widths that total about 550, so below this they start
   to crowd each other. */
/* All three carry the width the ladder now holds back for its scrollbar
   (see .oc-scroll), so the six columns keep the measure they were drawn
   at rather than paying for the gutter out of their own width.

   600 rather than the 598 that reservation strictly needs: it is 25 of
   the workspace canvas's 24px grid units, so the card's right edge lands
   on a dot. The spare 2 falls into the five flexible columns, 0.4px
   each. */
const MIN_W = 570;
const MAX_W = 1110;
const DEFAULT_W = 600;

export interface OptionChainProps {
  onClose?: () => void;
  /**
   * Given, the title bar grows a drag grip and this fires when it is
   * taken hold of. The widget does not move itself — whoever placed it on
   * the page decides where it can go. Same contract as the order
   * ticket's, because it is the same title bar.
   */
  onGrip?: (e: React.PointerEvent) => void;
  /** Given, a click on a bid or ask quotes it into a ticket. */
  onPick?: (pick: QuotePick) => void;
  /** Which quotes are on that ticket — see ChainTable. */
  pickedKeys?: ReadonlySet<string>;
  /** Passed through to the table — see ChainTableProps.beamKey. */
  beamKey?: string | null;
  /** Which quote the pointer is on — see ChainTableProps. */
  onHoverQuote?: (q: HoveredQuote | null) => void;
  /**
   * The underlying this chain is showing, on every tick. Given, a ticket
   * beside it can quote the same symbol at the same price instead of
   * running its own.
   */
  onSpotChange?: (u: {
    symbol: string;
    price: number;
    change: number;
    changePct: number;
  }) => void;
}

/**
 * Options chain, as a floating widget.
 *
 * Bands, top to bottom: what you are looking at (title), what it costs
 * (quote), what you would trade (call/put, expiry), then the strike
 * ladder.
 */
export function OptionChain({
  onClose,
  onGrip,
  onPick,
  pickedKeys,
  beamKey,
  onHoverQuote,
  onSpotChange,
}: OptionChainProps) {
  const [tick, setTick] = useState(0);
  const [width, setWidth] = useState(DEFAULT_W);
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const hub = pxHub();
    const id = setInterval(() => {
      // Reading the hub keeps this widget on the same walk as the rest of
      // the site even though the spot itself is staged below.
      void hub.price;
      setTick((t) => t + 1);
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  /* Derived from the same tick, not a second timer — which is what keeps
     the price step and the column walk on the same frame. */
  const spot = SPOT_SEQ[tick % SPOT_SEQ.length];
  const state = useChainState(spot, tick);

  const change = spot - PREV_CLOSE;

  /* Published on every step of the walk, so anything beside this widget
     can show the same underlying rather than a second one. */
  useEffect(() => {
    onSpotChange?.({
      symbol: UNDERLYING.symbol,
      price: spot,
      change,
      changePct: change / (spot - change),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spot]);

  /* The widget is centred, so width is driven from the pointer's distance
     to its centre rather than from a delta. That way the edge sits under
     the cursor the whole drag instead of trailing it at half speed. */
  const onResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (!root) return;
    e.preventDefault();
    // Capture is a nicety — it keeps the drag alive if the pointer leaves
    // the handle — but it throws if the pointer is already gone, and that
    // must not take the whole drag down with it.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* not capturable; the window listeners below still carry the drag */
    }
    const centre = root.getBoundingClientRect().left + root.offsetWidth / 2;
    const ceiling = Math.min(MAX_W, window.innerWidth - 32);

    const move = (ev: PointerEvent) => {
      const next = (ev.clientX - centre) * 2;
      setWidth(Math.round(Math.min(ceiling, Math.max(MIN_W, next))));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, []);

  /* Keyboard equivalent — a drag handle that only responds to a pointer
     is unreachable for anyone not using one. */
  const onResizeKey = useCallback((e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 50 : 10;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      setWidth((w) =>
        Math.round(
          Math.min(
            Math.min(MAX_W, window.innerWidth - 32),
            Math.max(MIN_W, w + (e.key === "ArrowRight" ? step : -step)),
          ),
        ),
      );
    }
  }, []);

  return (
    <WidgetShell
      title="Options chain"
      className="oc-root"
      onClose={onClose}
      onGrip={onGrip}
      innerRef={rootRef}
      style={{ width }}
    >
      <div className="oc-body">
        <QuoteBar
          underlying={UNDERLYING}
          price={spot}
          change={change}
          changePct={change / (spot - change)}
        >
          <span className="oc-quote-split" />
          <Segmented
            label="Call or put"
            layoutId="oc-side"
            options={SIDES}
            value={state.side}
            onChange={state.setSide}
          />
          <ExpiryPicker
            selectedId={state.expiryId}
            onSelect={state.setExpiryId}
          />
        </QuoteBar>


        <ChainTable
          rows={state.rows}
          side={state.side}
          spot={spot}
          expiry={state.expiry}
          openStrike={state.openStrike}
          onToggleStrike={state.toggleStrike}
          onPick={onPick}
          pickedKeys={pickedKeys}
          beamKey={beamKey}
          onHoverQuote={onHoverQuote}
        />
      </div>

      <div
        className="oc-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the widget"
        aria-valuenow={width}
        aria-valuemin={MIN_W}
        aria-valuemax={MAX_W}
        tabIndex={0}
        onPointerDown={onResize}
        onKeyDown={onResizeKey}
        onDoubleClick={() => setWidth(DEFAULT_W)}
        title="Drag to resize — double-click to reset"
      >
        <span className="oc-resize-grip" aria-hidden="true" />
      </div>
    </WidgetShell>
  );
}

/**
 * The Stock/Option toggle from the options strategy builder — same track,
 * same mint plate, same 460/40 spring. Generic over its option ids so a
 * second selector can be dropped in beside it without duplication.
 */
function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  layoutId,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  layoutId: string;
}) {
  return (
    <div className="oc-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className="oc-seg-btn"
            onClick={() => onChange(o.id)}
          >
            {selected && (
              <motion.span
                className="oc-seg-ind"
                layoutId={layoutId}
                transition={SEG_SPRING}
              />
            )}
            <span style={{ position: "relative", zIndex: 1 }}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
