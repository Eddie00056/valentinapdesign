import { FractionalSharesBanner } from "./FractionalSharesBanner";

/** Homepage thumbnail: the banner opens and collapses on a loop; clicks fall
 *  through to the card link. */
export function FractionalSharesBannerPreview() {
  return (
    <div
      aria-hidden="true"
      style={{
        transform: "scale(0.82)",
        transformOrigin: "center",
        fontFamily:
          '"DM Sans", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <FractionalSharesBanner auto expandedWidth={300} stageWidth={360} />
    </div>
  );
}
