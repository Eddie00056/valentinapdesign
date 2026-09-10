import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { QuoteBar } from "./QuoteBar";
import { ChainTable } from "./ChainTable";
import { ExpiryPicker } from "./ExpiryPicker";
import { useChainState } from "./useChainState";
import { pxHub } from "../alertscreen/priceHub";
import { UNDERLYING } from "./mock";
import { SEG_SPRING } from "./motion";
import { type OptionSide } from "./types";
import { Close, LinkOut } from "./icons";
import "./option-chain.css";

const SIDES: { id: OptionSide; label: string }[] = [
  { id: "call", label: "Call" },
  { id: "put", label: "Put" },
];

/* ONE clock drives everything on this widget.

   Price used to step on its own timer while the columns walked on
   another, so the two drifted and a price change never landed on the same
   frame as a column update. Both now come off the same tick: the beat is
   5s, price holds low for two beats and high for one, so every figure on
   the table — spot, quotes, volume, open interest — changes together. */
const TICK_MS = 5000;

/** Beats per demo loop: low, low, high. */
const LOOP = 3;

/* Scripted price beat.

   The point of the piece is the spot line crossing a strike, so price is
   staged rather than left to wander: it rests just under $175 with the
   line sitting below the $175 row (2 beats = 10s), steps over the strike
   so the line springs up past that row (1 beat = 5s), then drops back. */
const LOW = 174.93;
const HIGH = 175.01;

export interface OptionChainProps {
  onClose?: () => void;
}

/**
 * Options chain, as a floating widget.
 *
 * Bands, top to bottom: what you are looking at (title), what it costs
 * (quote), what you would trade (call/put, expiry), then the strike
 * ladder.
 */
export function OptionChain({ onClose }: OptionChainProps) {
  const [tick, setTick] = useState(0);
  /* Bumping this remounts the glow span, which restarts its one-shot
     keyframe — the same replay trick the order-placed animation uses. */
  const [glow, setGlow] = useState(0);

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
  const spot = tick % LOOP === LOOP - 1 ? HIGH : LOW;
  const state = useChainState(spot, tick);

  const change = spot - (LOW - UNDERLYING.change);

  return (
    <section className="oc-root" aria-label="Options chain">
      <header className="oc-titlebar">
        <h2>Options chain</h2>
        <div className="oc-titlebar-actions">
          <button
            type="button"
            className="oc-linkout"
            aria-label="Open in a new window"
            onClick={() => setGlow((g) => g + 1)}
          >
            {glow > 0 && <span key={glow} className="oc-glow" aria-hidden="true" />}
            <LinkOut size={14} />
          </button>
          <button type="button" aria-label="Close" onClick={onClose}>
            <Close size={15} />
          </button>
        </div>
      </header>

      <div className="oc-body">
        <QuoteBar
          underlying={UNDERLYING}
          price={spot}
          change={change}
          changePct={change / (spot - change)}
        />

        <div className="oc-toolbar">
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
        </div>

        <ChainTable
          rows={state.rows}
          side={state.side}
          spot={spot}
          expiry={state.expiry}
          openStrike={state.openStrike}
          onToggleStrike={state.toggleStrike}
        />
      </div>
    </section>
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
