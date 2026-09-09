/**
 * Homepage gallery thumbnail for a full prototype page — renders the real,
 * live page in an iframe, scaled down and cropped to a detail rather than
 * an abstract icon mark. Non-interactive (pointer-events:none + tabIndex
 * -1 + aria-hidden), matching the existing *Preview components' contract.
 *
 * Each prototype page has its own fixed-position chrome (a back button,
 * usually top-left) that isn't part of the "wireframe" the tile should
 * show — `offsetX`/`offsetY` shift the iframe's content within the crop
 * window to push that chrome out of view instead of trying to hide it
 * per-page in CSS (iframes are cross-document, so this component can't
 * reach into the page's own stylesheet at all).
 */
export function IframePreview({
  src,
  cropWidth,
  cropHeight,
  frameWidth,
  frameHeight,
  scale,
  offsetX = 0,
  offsetY = 0,
}: {
  src: string;
  cropWidth: number;
  cropHeight: number;
  frameWidth: number;
  frameHeight: number;
  scale: number;
  offsetX?: number;
  offsetY?: number;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        pointerEvents: "none",
        width: cropWidth,
        height: cropHeight,
        overflow: "hidden",
        borderRadius: 8,
        position: "relative",
      }}
    >
      <iframe
        src={src}
        title=""
        tabIndex={-1}
        loading="lazy"
        style={{
          position: "absolute",
          top: offsetY,
          left: offsetX,
          width: frameWidth,
          height: frameHeight,
          border: "none",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      />
    </div>
  );
}
