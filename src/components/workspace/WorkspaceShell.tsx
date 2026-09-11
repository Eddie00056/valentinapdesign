import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";
import "./workspace-shell.css";

/** The workspace icon: a layout split into a header and two panes. */
function Layout() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden focusable={false}>
      {/* Measured off the asset: an 18px glyph of a full-width bar 9 tall,
          then a 7-tall row split 11 / 2 / 5. */}
      <rect x="0" y="0" width="18" height="9" rx="1.5" />
      <rect x="0" y="11" width="11" height="7" rx="1.5" />
      <rect x="13" y="11" width="5" height="7" rx="1.5" />
    </svg>
  );
}

function Plus() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      aria-hidden
      focusable={false}
    >
      <path d="M9 1.6v14.8M1.6 9h14.8" />
    </svg>
  );
}

/* The screen's own logical size. Everything inside is laid out at these
   pixels and the whole frame is then scaled to fit — the same thing a
   device mockup does, and the reason the widgets keep their real metrics
   (a 20px control is 20px of layout) no matter how small the frame gets
   drawn. 16:10, which is the MacBook's aspect. */
const SCREEN_W = 1440;
const SCREEN_H = 900;

export interface WorkspaceShellProps {
  /** What lives on the canvas. */
  children: ReactNode;
  /** Which workspace tab reads as current. */
  active?: number;
  /** The signed-in initial, in the corner. */
  initial?: string;
}

/**
 * The application frame these widgets actually live in: a rail of
 * workspaces down the left, and a canvas.
 *
 * The canvas is the point. Until now the option chain and the order ticket
 * sat centred on a page, which is a layout — a workspace is a surface you
 * arrange things on, and the dot grid says so before anything is dragged.
 * It is also what makes the ticket's drag handle mean something: there is
 * somewhere to drag it TO.
 *
 * Every value here is measured off the exported frame — see the CSS.
 */
export function WorkspaceShell({
  children,
  active = 0,
  initial = "B",
}: WorkspaceShellProps) {
  const stage = useRef<HTMLDivElement>(null);
  /* 1 until measured, so the server-rendered frame is never wrong-sized
     in the HTML — it only ever shrinks once the viewport is known. */
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () => {
      /* The CONTENT box, not the border box.

         `getBoundingClientRect()` here was circular: the stage is sized
         by its own child, so measuring it measured the unscaled screen
         and the scale never left 1. The content box of a stage locked to
         the viewport's height is the space actually available. */
      const cs = getComputedStyle(el);
      const width =
        el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const height =
        el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      /* Contain, never enlarge: on a display bigger than the screen's own
         1440x900 the mock would otherwise be blown up and every hairline
         in it with it. */
      setScale(Math.min(width / SCREEN_W, height / SCREEN_H, 1));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="wsp-stage" ref={stage}>
    {/* Pointer coordinates come in at screen scale; the elements being
        dragged live at the screen's own scale inside a transform. Without
        this, a drag inside a frame at 0.8 moves the card 0.8px per pixel
        of pointer travel and the two drift apart across a long drag.
        Motion's own hook for exactly this case. */}
    <MotionConfig
      transformPagePoint={(p) => ({ x: p.x / scale, y: p.y / scale })}
    >
    {/* Two elements, on purpose.

        The outer one is the object: it takes the SCALED size, so what the
        page lays out and what you see are the same box and centring it
        actually centres it. A transform does not change layout, so a
        single element sized 1440x900 and scaled down still occupies
        1440x900 — and a grid start-aligns an item taller than its
        container rather than letting it overflow both ways, which left
        the frame sitting 83px below centre.

        It also owns the corner and the clip, because it is the thing with
        the visible edge. */}
    <div
      className="wsp-screen"
      style={{ width: SCREEN_W * scale, height: SCREEN_H * scale }}
    >
    <div
      className="wsp"
      style={{
        width: SCREEN_W,
        height: SCREEN_H,
        transform: `scale(${scale})`,
      }}
    >
      <nav className="wsp-rail" aria-label="Workspaces">
        <img className="wsp-logo" src="/workspace-logo.png" alt="" width={30} height={24} />

        <div className="wsp-tabs">
          {[0, 1].map((i) => (
            <button
              key={i}
              type="button"
              className="wsp-tab"
              aria-label={`Workspace ${i + 1}`}
              aria-current={i === active || undefined}
            >
              <Layout />
            </button>
          ))}

          <button type="button" className="wsp-tab wsp-tab--add" aria-label="New workspace">
            <Plus />
          </button>
        </div>

        <div className="wsp-avatar" aria-label="Account">
          {initial}
        </div>
      </nav>

      <div className="wsp-canvas">{children}</div>
    </div>
    </div>
    </MotionConfig>
    </div>
  );
}
