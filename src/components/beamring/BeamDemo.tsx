import { useState } from "react";
import { BeamRing } from "./BeamRing";

/**
 * The piece: one component, shown on the three sizes of thing it is
 * actually asked to go round — a quote chip, a button, a card — plus the
 * two knobs that change what it means rather than what it looks like.
 *
 * The switches are the point of the demo, not decoration on it. A ring
 * that only reads when it is moving is a ring you cannot ship; turning
 * the light off is how you check the border it leaves behind, and turning
 * the bloom off is how you check the ring is doing the work.
 */
export function BeamDemo() {
  const [running, setRunning] = useState(true);
  const [glow, setGlow] = useState(true);

  return (
    <div className="bd-stage">
      <div className="bd-row">
        {/* A quote off an option chain: the case this was built for. The
            ring is the chip's own 1px border at 12px type — the smallest
            thing on the page it has to survive. */}
        <figure className="bd-item">
          <BeamRing
            running={running}
            glow={glow}
            radius={6}
            background="#2c3334"
            color="#48d597"
            core="#e8f7ef"
            style={{ width: 44, height: 22 }}
          >
            <span className="bd-quote">$4.39</span>
          </BeamRing>
          <figcaption className="bd-cap">Quote · 1px</figcaption>
        </figure>

        {/* The sell side, stopped: the same component with the light off,
            so the border it leaves is visible beside the one that moves. */}
        <figure className="bd-item">
          <BeamRing
            running={running}
            glow={glow}
            radius={6}
            background="#2c3334"
            color="#ff557d"
            core="#ffe4ea"
            style={{ width: 44, height: 22 }}
          >
            <span className="bd-quote bd-quote--down">$4.31</span>
          </BeamRing>
          <figcaption className="bd-cap">Quote · sell</figcaption>
        </figure>
      </div>

      <div className="bd-row">
        {/* A CTA. 1.5px, because a ring scales with what it is around:
            the same 1 that reads as an edge on a 22px chip reads as a
            hairline on a 40px button. */}
        <figure className="bd-item">
          <BeamRing
            running={running}
            glow={glow}
            width={1.5}
            radius={10}
            duration={4}
            background="#12181a"
            color="#48d597"
            core="#ffffff"
          >
            <button type="button" className="bd-cta">
              Place order
            </button>
          </BeamRing>
          <figcaption className="bd-cap">Button · 1.5px</figcaption>
        </figure>
      </div>

      <div className="bd-row">
        {/* A card, slower. One turn has to take longer on a longer
            perimeter or the light appears to accelerate as the box
            grows — the arc is a fraction of the turn, not a length. */}
        <figure className="bd-item">
          <BeamRing
            running={running}
            glow={glow}
            width={1}
            radius={12}
            duration={7}
            background="#0f1719"
            color="#4a90ff"
            core="#e7f0ff"
          >
            <div className="bd-card">
              <span className="bd-card-k">Working</span>
              <span className="bd-card-v">Order sent to the exchange</span>
            </div>
          </BeamRing>
          <figcaption className="bd-cap">Card · 7s</figcaption>
        </figure>
      </div>

      <div className="bd-controls">
        <label className="bd-switch">
          <input
            type="checkbox"
            checked={running}
            onChange={(e) => setRunning(e.target.checked)}
          />
          <span>Light</span>
        </label>
        <label className="bd-switch">
          <input
            type="checkbox"
            checked={glow}
            onChange={(e) => setGlow(e.target.checked)}
          />
          <span>Bloom</span>
        </label>
      </div>
    </div>
  );
}
