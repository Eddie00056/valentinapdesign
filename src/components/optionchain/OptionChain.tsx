import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { QuoteBar } from "./QuoteBar";
import { ChainTable } from "./ChainTable";
import { ExpiryPicker } from "./ExpiryPicker";
import { ANCHOR_SPOT, useChainState } from "./useChainState";
import { pxHub, PX_BASE, type PriceState } from "../alertscreen/priceHub";
import { UNDERLYING } from "./mock";
import { SEG_SPRING } from "./motion";
import { type OptionSide } from "./types";
import { Close, LinkOut } from "./icons";
import "./option-chain.css";

const SIDES: { id: OptionSide; label: string }[] = [
  { id: "call", label: "Call" },
  { id: "put", label: "Put" },
];

/** Render cadence. Everything on the table updates on this beat. */
const TICK_MS = 7000;

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
  /* The price source stays the shared one — `pxHub` is the site-wide walk
     the alert screen and the order builder already run on, re-based from
     its 194.29 onto this widget's $175 spot. What differs here is the
     cadence: the hub steps every 2.2s, this table renders every 7s. So it
     samples the hub rather than subscribing to it, which means each update
     lands three steps of the walk at once — a visible move rather than a
     twitch, and still one price for the whole site. */
  const [px, setPx] = useState<PriceState>({
    price: PX_BASE,
    prev: PX_BASE,
    dir: 0,
    n: 0,
  });
  const [tick, setTick] = useState(0);
  /* Bumping this remounts the glow span, which restarts its one-shot
     keyframe — the same replay trick the order-placed animation uses. */
  const [glow, setGlow] = useState(0);

  useEffect(() => {
    const hub = pxHub();
    const id = setInterval(() => {
      setPx({ price: hub.price, prev: hub.prev, dir: hub.dir, n: hub.n });
      setTick((t) => t + 1);
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  const spot = ANCHOR_SPOT + (px.price - PX_BASE);
  const state = useChainState(spot, tick);

  const change = spot - (ANCHOR_SPOT - UNDERLYING.change);

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
          above={state.above}
          below={state.below}
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
