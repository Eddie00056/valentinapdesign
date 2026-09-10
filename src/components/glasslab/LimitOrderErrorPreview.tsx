import { PreviewStage } from "../gallery/PreviewStage";
import { LimitOrderError } from "./LimitOrderError";

/**
 * Homepage thumbnail: the error animation loops; clicks fall through to the
 * card link (pointer events are disabled inside the component in auto mode).
 *
 * Scaled slightly DOWN, not up. At 1.05 its natural 400x160 painted 420x168
 * inside a 397-wide tile and spilled past the card on both sides.
 */
export function LimitOrderErrorPreview() {
  return (
    <div
      style={{
        fontFamily:
          '"DM Sans", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <PreviewStage
        width={364}
        height={150}
        contentWidth={400}
        contentHeight={160}
        scale={0.9}
      >
        <LimitOrderError auto />
      </PreviewStage>
    </div>
  );
}
