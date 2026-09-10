import { PreviewStage } from "../gallery/PreviewStage";
import { FractionalSharesBanner } from "./FractionalSharesBanner";

/**
 * Homepage thumbnail: the banner opens and collapses on a loop; clicks fall
 * through to the card link.
 *
 * It runs at its natural 590/680 rather than a squeezed 300 — the copy is
 * sized for that width, and narrowing the component clipped the sentence
 * mid-word ("Fractional shares availabl").
 */
export function FractionalSharesBannerPreview() {
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
        contentWidth={680}
        contentHeight={160}
        scale={0.52}
      >
        <FractionalSharesBanner auto />
      </PreviewStage>
    </div>
  );
}
