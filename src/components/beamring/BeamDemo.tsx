import { BeamRing } from "./BeamRing";

/**
 * The piece: one ring, round one button.
 *
 * It was three objects and two switches, which is a catalogue of the
 * component rather than a look at it. A ring is a thing you judge at one
 * size, moving, with nothing beside it to compare it to.
 *
 * The button takes the reference's own geometry — 12/14 of padding around
 * 14px type set solid — so the ring is being asked to go round the size
 * of thing it is actually for.
 */
export function BeamDemo() {
  return (
    <div className="bd-stage">
      {/* A pill, as the reference sets it. 20 is half of the 40 the ring
          adds up to — 38 of button plus 1 either side — so the outer
          curve is a true semicircle, and the face's `calc(20 - 1)` lands
          at 19, half of its own 38. Both ends round exactly, and the ring
          holds its thickness round them.

          1px, not 1.5: the ring reads as a border at this size, and a
          border is thinner than the light travelling along it needs to
          be for anyone to notice. */}
      <BeamRing
        width={1}
        radius={20}
        duration={4}
        background="#171e20"
        color="#48d597"
        core="#ffffff"
        glow
      >
        <button type="button" className="bd-cta">
          Place order
        </button>
      </BeamRing>
    </div>
  );
}
