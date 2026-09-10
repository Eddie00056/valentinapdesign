import type { ReactNode } from "react";

/**
 * Fixed-size, centred, clipping stage for a homepage thumbnail.
 *
 * Two things make gallery previews go wrong, and this handles both:
 *
 * 1. `transform: scale()` changes what an element paints but not what it
 *    occupies, so a tile sized by its content's layout box collapses — the
 *    toggle's 20px track left a 21px tile showing a sliver of one word.
 *    The stage declares the box instead.
 *
 * 2. Grid/flex centring does NOT centre an item wider than its container;
 *    it anchors it at the start. Most previews are deliberately larger
 *    than the tile and scaled down, so `place-items: center` silently put
 *    them off to one side. Centring here is absolute — `translate(-50%,
 *    -50%)` on the content's own box, then scaled about that same centre —
 *    which holds at any content size.
 */
export function PreviewStage({
  width,
  height,
  contentWidth,
  contentHeight,
  scale = 1,
  children,
}: {
  /** The tile's box — what the thumbnail actually reserves. */
  width: number;
  height: number;
  /** The content's natural, unscaled size. */
  contentWidth: number;
  contentHeight: number;
  scale?: number;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        position: "relative",
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: contentWidth,
          height: contentHeight,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
