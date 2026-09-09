import type { ReactNode } from "react";
import "./PhoneFrame.css";

/* Shared iPhone-mockup chrome — the frame every stock-detail-flow screen
   mounts inside (quote screen, order placement, …). Geometry below was
   measured/circle-fit off iphone17pro.png through a long trial-and-error
   pass on the quote screen; reuse it verbatim rather than re-deriving it.

   - object-fit-free natural scaling (406 wide -> ~825 tall); the frame's
     `overflow:hidden` crops the bottom, the PNG's own baked-in rounded top
     corners show through untouched.
   - the content overlay is pure #000 to match the PNG's black screen —
     any other near-black shows a visible wedge at the screen's corner,
     because a CSS `border-radius` can't perfectly trace the render's own
     corner curve. Black-on-black hides a few-px mismatch completely.
   - status bar (time + signal/wifi/battery) and the Dynamic Island are
     baked into the PNG — never render your own, it'll double up.
   - the render also has a stray bright bar baked in just under the
     signal/wifi/battery cluster; a small #000 patch covers it.
   - IMPORTANT: no `filter` (e.g. drop-shadow) on the masked outer wrapper —
     filter + mask on one box hard-clips the filter to a rectangle, which
     shows as a "triangle edge" artifact. Put a shadow on a *different*,
     unmasked element if you want one.
   - the bottom-fade mask value can be tuned per screen (a taller screen
     needs the fade to start later) via `fadeAt` (0-100, % of frame height
     where the fade begins; default matches the quote screen). */

const ASSETS = "/prototypes/uploads";
const PHONE = `${ASSETS}/iphone17pro.png`;

export function PhoneFrame({
  children,
  fadeAt = 73,
  footer,
  overlay,
  fullDevice = false,
}: {
  children: ReactNode;
  fadeAt?: number;
  /** Optional slot pinned to the bottom of the screen area, outside the
      scrolling content — e.g. a screen's primary action buttons. Sized to
      its own content and never scrolled away, so it can't get cut off by
      the frame's own `overflow: hidden`. */
  footer?: ReactNode;
  /** Full-screen layer over the whole screen area (scroll content + footer),
      anchored to the screen box rather than the scrolling content — for
      scrims and bottom sheets. The wrapper is `pointer-events: none`; the
      overlay's own interactive parts opt back in. */
  overlay?: ReactNode;
  /** Show the whole device instead of cropping its bottom. The default
      renders a fixed 748px window (bottom of the PNG cropped, softened by
      the bottom-fade mask) — tuned for the scrolling quote screen. With
      `fullDevice`, the frame is the PNG's natural height (~825 @406), the
      screen box rounds all four corners and insets 8px on every side, and
      the fade mask is dropped so the titanium bottom edge is visible. */
  fullDevice?: boolean;
}) {
  const phoneMask = fullDevice
    ? "none"
    : `linear-gradient(to bottom, #000 0%, #000 ${fadeAt}%, transparent 100%)`;

  return (
    <div
      style={{
        flex: "none",
        WebkitMaskImage: phoneMask,
        maskImage: phoneMask,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "100% 100%",
        maskSize: "100% 100%",
        fontFamily: "'Open Sans', Helvetica, Arial, sans-serif",
        letterSpacing: 0,
      }}
    >
      <div
        style={{
          position: "relative",
          width: 406,
          height: fullDevice ? "auto" : 748,
          overflow: fullDevice ? "visible" : "hidden",
        }}
      >
        <img src={PHONE} alt="iPhone" style={{ width: "100%", display: "block" }} />
        <div
          style={{
            // screen inset L/R ~10.6px, top ~7.5px, corner radius ~58px @406.
            // the bottom bezel is ~symmetric with the top (~8px @406), shown
            // only in `fullDevice` mode.
            position: "absolute",
            left: 10,
            right: 10,
            top: 8,
            bottom: fullDevice ? 8 : 0,
            borderRadius: fullDevice ? 58 : "58px 58px 0 0",
            overflow: "hidden",
            background: "transparent",
            paddingTop: 50,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 44,
              right: 40,
              width: 78,
              height: 15,
              background: "#000",
              zIndex: 5,
            }}
          />

          <div
            style={{
              flex: 1,
              minHeight: 0,
              background: "#000",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            <div
              className="pf-scroll"
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                padding: footer ? "16px 24px 12px" : "16px 24px 20px",
              }}
            >
              {children}
            </div>
            {footer && (
              <div style={{ flex: "none", padding: "0 24px 24px", background: "#000" }}>
                {footer}
              </div>
            )}
            {overlay != null && (
              <div style={{ position: "absolute", inset: 0, zIndex: 40, overflow: "hidden", pointerEvents: "none" }}>
                {overlay}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The centred, ambient-lit backdrop the frame sits on — same as the quote screen. */
export function PhoneStage({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 28px",
        background: "linear-gradient(180deg, #131417 0%, #0b0b0d 100%)",
      }}
    >
      {children}
    </div>
  );
}
