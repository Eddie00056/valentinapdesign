import type { CSSProperties, ReactNode } from "react";
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
     baked into the PNG — never render your own, it'll double up. The one
     exception is `statusBar="drawn"` (see below), which covers the baked
     one because a light screen needs dark glyphs.
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

/* Screen box, in frame px @406 wide. The render's own screen starts at
   x=9 / y=6 with a ~59.7px corner radius (circle-fit against the titanium
   rail's inner edge, sampled row by row). The box below sits 1-2.5px
   inside that everywhere, so a black screen can never spill onto the rail. */
const SCREEN_L = 10;
const SCREEN_T = 8;
const SCREEN_R = 58;
const SCREEN_W = 406 - SCREEN_L * 2; // 386

/* Dynamic Island. The PNG draws only the two sensor cutouts (they're
   invisible on a black screen, so the render never bothered with the pill
   around them) — measured at x 151-173 and 230-245, both centred on y 46.5
   in frame space. A light screen has to paint the pill itself, and it has
   to cover both cutouts: 122 x 35 centred in the screen swallows them with
   ≥9px to spare on every side. */
const ISLAND_W = 122;
const ISLAND_H = 35;
const ISLAND_TOP = 46.5 - SCREEN_T - ISLAND_H / 2; // 21

/* Status-bar glyph placement, matched to where the PNG bakes its own so a
   drawn bar lands in the same place as a baked one on a neighbouring
   screen: "9:41" centred on x=73, the right cluster ending at x=345, both
   on the island's centre line. */
const SB_TIME_CX = 73;
const SB_RIGHT = SCREEN_W - 345;
const SB_CY = ISLAND_TOP + ISLAND_H / 2;

/** iOS status bar, drawn rather than baked — for light screens. */
function StatusBar({ color, time }: { color: string; time: string }) {
  const row: CSSProperties = {
    position: "absolute",
    top: 0,
    height: SB_CY * 2,
    display: "flex",
    alignItems: "center",
    color,
  };
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 6, pointerEvents: "none" }}>
      <div
        style={{
          ...row,
          left: 0,
          width: SB_TIME_CX * 2,
          justifyContent: "center",
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        {time}
      </div>

      <div style={{ ...row, right: SB_RIGHT, gap: 7 }}>
        {/* cellular — four bars, the last two full strength */}
        <svg width="17" height="11" viewBox="0 0 17 11" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={i * 4.5}
              y={11 - (4 + i * 2.33)}
              width="3"
              height={4 + i * 2.33}
              rx="1"
              fill="currentColor"
            />
          ))}
        </svg>

        {/* wifi — three nested arcs + the dot */}
        <svg width="16" height="11" viewBox="0 0 16 11" fill="none" aria-hidden="true">
          <path d="M1 3.6a10.6 10.6 0 0 1 14 0" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M3.7 6.5a6.7 6.7 0 0 1 8.6 0" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M6.4 9.3a2.6 2.6 0 0 1 3.2 0" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>

        {/* battery — shell at 35% opacity, nub, fill */}
        <svg width="27" height="13" viewBox="0 0 27 13" fill="none" aria-hidden="true">
          <rect
            x="0.6"
            y="0.6"
            width="23"
            height="11.8"
            rx="3.6"
            stroke="currentColor"
            strokeOpacity="0.35"
            strokeWidth="1.2"
          />
          <path
            d="M25.3 4.4v4.2a2.2 2.2 0 0 0 0-4.2Z"
            fill="currentColor"
            fillOpacity="0.4"
          />
          <rect x="2.2" y="2.2" width="16" height="8.6" rx="2.2" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

export function PhoneFrame({
  children,
  fadeAt = 73,
  footer,
  overlay,
  fullDevice = false,
  screenBg = "#000",
  statusBar = "baked",
  statusColor = "#000",
  statusTime = "9:41",
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
  /** The screen's own surface colour. Stays #000 for every dark screen —
      see the corner-wedge note at the top. A light value is painted on a
      plate inset 1px inside the screen box instead of on the box itself,
      so the render's black screen border still frames it and a sub-pixel
      radius mismatch can never spill light onto the titanium rail. */
  screenBg?: string;
  /** "baked" keeps the PNG's own white status bar (correct on #000).
      "drawn" covers it and paints our own — the only way a light screen
      gets dark glyphs — plus the Dynamic Island, which the render leaves
      out because it is invisible against black. */
  statusBar?: "baked" | "drawn";
  statusColor?: string;
  statusTime?: string;
}) {
  const phoneMask = fullDevice
    ? "none"
    : `linear-gradient(to bottom, #000 0%, #000 ${fadeAt}%, transparent 100%)`;
  const drawn = statusBar === "drawn";

  /* The screen's content. In `drawn` mode this is mounted INSIDE the light
     plate, not beside it — a full-bleed row (a banner cancelling the
     scroller's insets) otherwise runs to the screen box's own edge, which is
     1px outside the plate, and that 1px of colour reads as the screen
     spilling onto the bezel. Clipping everything to the plate makes that
     impossible rather than something each screen has to remember. */
  const body = (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        background: drawn ? "transparent" : "#000",
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
        <div
          style={{
            flex: "none",
            padding: "0 24px 24px",
            background: drawn ? screenBg : "#000",
          }}
        >
          {footer}
        </div>
      )}
      {overlay != null && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 40,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          {overlay}
        </div>
      )}
    </div>
  );

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
            left: SCREEN_L,
            right: SCREEN_L,
            top: SCREEN_T,
            bottom: fullDevice ? 8 : 0,
            borderRadius: fullDevice ? SCREEN_R : `${SCREEN_R}px ${SCREEN_R}px 0 0`,
            overflow: "hidden",
            background: drawn ? "#000" : "transparent",
            paddingTop: drawn ? 0 : 50,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {drawn ? (
            <div
              style={{
                position: "absolute",
                left: 1,
                right: 1,
                top: 1,
                bottom: fullDevice ? 1 : 0,
                borderRadius: fullDevice
                  ? SCREEN_R - 1
                  : `${SCREEN_R - 1}px ${SCREEN_R - 1}px 0 0`,
                overflow: "hidden",
                background: screenBg,
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
                  left: (SCREEN_W - 2 - ISLAND_W) / 2,
                  top: ISLAND_TOP - 1,
                  width: ISLAND_W,
                  height: ISLAND_H,
                  borderRadius: 999,
                  background: "#000",
                  zIndex: 7,
                }}
              />
              <StatusBar color={statusColor} time={statusTime} />
              {body}
            </div>
          ) : (
            <>
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
              {body}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** The centred, ambient-lit backdrop the frame sits on — same as the quote screen. */
export function PhoneStage({ children }: { children: ReactNode }) {
  return (
    <div
      className="phone-stage"
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
