import { AlertCreationScreen } from "./AlertCreationScreen";

/**
 * Homepage thumbnail — top-cropped, non-interactive.
 *
 * The crop ends mid-chart, so the cut is masked into a fade rather than
 * left as a hard edge across the card. Same treatment the screen itself
 * uses at the bottom of its phone frame.
 */
export function AlertCreationPreview() {
  return (
    <div
      aria-hidden="true"
      style={{
        pointerEvents: "none",
        width: 320,
        height: 240,
        overflow: "hidden",
        borderRadius: 8,
        maskImage:
          "linear-gradient(to bottom, #000 0%, #000 78%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, #000 0%, #000 78%, transparent 100%)",
      }}
    >
      <div
        style={{
          width: 406,
          transform: "scale(0.788)",
          transformOrigin: "top left",
        }}
      >
        <AlertCreationScreen frame="bare" fractionalBanner={false} />
      </div>
    </div>
  );
}
