import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

/**
 * Ported from the "Fractional Shares Banner" design-canvas handoff.
 * A collapsed glass pill that slides and unfurls into a banner with a
 * staggered per-letter reveal; the close (x) collapses it back.
 */

/* The snackbar spec (Snackbar.png, 451×91, scaled ×0.725 to this 66px
   bar): a light-blue slab a shade lighter at the top, a 2px white stroke,
   one ink for text, icon and close, the icon a filled disc with the glyph
   in the ink, radius a third of the height when open (a circle closed).
   Sampled off the file; the divider and the reference's gaps were tried
   and dropped (user, 2026-09-16). */
const BLUE = "#305FAA"; /* the ink: text, icon disc, close, all (48,95,170) */
const SLAB = "linear-gradient(180deg, #DFE5F5 0%, #D0DBF2 100%)";

/* `skin="glass"` (the page's ?glass): the banner's original colours — the
   50% white glass with the 10% blue tint, #0055B6 ink at 300, the mark as
   shipped — with only the container's stroke from the snackbar: the 2px
   white ring in place of the gradient ring and inner highlight. A version
   the user asked to see side by side (2026-09-16). */
export type BannerSkin = "snackbar" | "glass";
const BLUE_GLASS = "#0055B6";

const GLASS: CSSProperties = {
  isolation: "isolate",
  border: 0,
  zIndex: 1,
  background: SLAB,
};

const MASK: CSSProperties = {
  WebkitMask:
    "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
  WebkitMaskComposite: "xor",
  maskComposite: "exclude",
  pointerEvents: "none",
};

const MARK_SRC = "/work/glass/mark.png";

function CloseIcon({ ink, glass }: { ink: string; glass: boolean }) {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" style={{ display: "block" }}>
      <path
        d="M1.4 1.4l11.2 11.2M12.6 1.4L1.4 12.6"
        stroke={ink}
        strokeOpacity={glass ? 0.55 : 1}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function FractionalSharesBanner({
  text = "Fractional shares available for AAPL market orders",
  boldTerm = "AAPL",
  expandedWidth,
  stageWidth = 680,
  collapsedPosition = "center",
  auto = false,
  skin = "snackbar",
}: {
  text?: string;
  boldTerm?: string;
  /** the old 58 | copy | 61: 616 for the snackbar's 500-weight copy, 590 for the glass's 300 */
  expandedWidth?: number;
  skin?: BannerSkin;
  stageWidth?: number;
  collapsedPosition?: "center" | "left";
  auto?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pop, setPop] = useState(false);
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  const [xHover, setXHover] = useState(false);

  const popT = useRef<number | undefined>(undefined);

  const openBanner = () => {
    if (open) return;
    setOpen(true);
    setPop(true);
    window.clearTimeout(popT.current);
    popT.current = window.setTimeout(() => setPop(false), 130);
  };

  const closeBanner = () => {
    window.clearTimeout(popT.current);
    setOpen(false);
    setPop(false);
  };

  useEffect(() => {
    if (!auto) return () => window.clearTimeout(popT.current);
    let on = false;
    const step = () => {
      on = !on;
      on ? openBanner() : closeBanner();
    };
    const id = window.setInterval(step, 2400);
    const kick = window.setTimeout(step, 600);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(kick);
      window.clearTimeout(popT.current);
    };
  }, [auto]);

  const shadow = press
    ? "0 4px 10px rgba(0,0,0,0.08)"
    : hover
      ? "0 12px 24px rgba(0,0,0,0.10)"
      : "0 8px 16px rgba(0,0,0,0.06)";

  const n = text.length;
  const glass = skin === "glass";
  const ink = glass ? BLUE_GLASS : BLUE;
  const w = expandedWidth ?? (glass ? 590 : 616);
  const bStart = boldTerm ? text.indexOf(boldTerm) : -1;
  const bEnd = bStart === -1 ? -1 : bStart + boldTerm.length;
  const centered = collapsedPosition === "center";

  const stage: CSSProperties = {
    position: "relative",
    width: stageWidth,
    height: 160,
    display: "flex",
    alignItems: "center",
    pointerEvents: auto ? "none" : undefined,
  };

  const outer: CSSProperties = {
    ...GLASS,
    ...(glass && {
      background: "rgba(255, 255, 255, 0.5)",
      backgroundImage:
        !open && hover
          ? "linear-gradient(rgba(0,102,219,0.17), rgba(0,102,219,0.17))"
          : "linear-gradient(rgba(0,102,219,0.10), rgba(0,102,219,0.10))",
    }),
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    boxShadow: shadow,
    position: "absolute",
    top: 47,
    left:
      centered && !open
        ? Math.round((stageWidth - 66) / 2)
        : Math.round((stageWidth - w) / 2),
    width: open ? w : 66,
    height: 66,
    /* a circle closed; the snackbar's radius (a third of the height) open */
    borderRadius: open && !glass ? 22 : 33,
    cursor: open ? "default" : "pointer",
    overflow: "hidden",
    boxSizing: "border-box",
    contain: "paint",
    transformOrigin: open ? "33px center" : "center center",
    filter: !open && hover && !glass ? "brightness(0.97)" : "none",
    transform: pop
      ? "scale(0.97, 1.02)"
      : !open && press
        ? "scale(0.94, 0.94)"
        : !open && hover
          ? "scale(1.06, 1.06)"
          : "scale(1, 1)",
    transition: open
      ? "left 0.72s cubic-bezier(0.22,0.9,0.24,1), width 0.76s cubic-bezier(0.22,0.98,0.28,1) 0.1s, border-radius 0.5s ease, transform 0.4s cubic-bezier(0.3,1.2,0.5,1), box-shadow 0.3s ease"
      : "width 0.34s cubic-bezier(0.45,0,0.7,0.2), left 0.36s cubic-bezier(0.4,0,0.6,0.25) 0.06s, border-radius 0.34s ease, transform 0.26s cubic-bezier(0.34,1.4,0.5,1), box-shadow 0.2s ease, background-image 0.2s ease",
  };

  const ring: CSSProperties = {
    ...MASK,
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    zIndex: 2,
    padding: 2,
    background: "rgba(255,255,255,0.85)",
  };


  const iconWrap: CSSProperties = {
    position: "absolute",
    left: 22,
    top: "50%",
    width: 22,
    height: 22,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transform:
      open && pop
        ? "translateY(-50%) translateX(14px)"
        : "translateY(-50%) translateX(0)",
    transition: open
      ? "transform 0.78s cubic-bezier(0.2,0.94,0.32,1)"
      : "transform 0.32s cubic-bezier(0.4,0,0.6,0.25)",
  };

  /* the mark in the ink — the PNG is #0066DB, so it goes through a mask */
  const glyph: CSSProperties = {
    display: "block",
    width: 22,
    height: 22,
    flexShrink: 0,
    background: ink,
    WebkitMaskImage: `url(${MARK_SRC})`,
    maskImage: `url(${MARK_SRC})`,
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
  };

  const copy: CSSProperties = {
    position: "absolute",
    left: 58,
    right: 61,
    top: "50%",
    fontSize: 21,
    lineHeight: 1.4,
    color: ink,
    whiteSpace: "nowrap",
    fontWeight: glass ? 300 : 500,
    letterSpacing: "-0.01em",
    transform: "translateY(-50%)",
  };

  const close: CSSProperties = {
    position: "absolute",
    right: 13,
    top: "50%",
    transform: "translateY(-50%)",
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    cursor: "pointer",
    background: xHover ? (glass ? "rgba(0,85,182,0.09)" : "rgba(48,95,170,0.09)") : "transparent",
    opacity: open ? 1 : 0,
    pointerEvents: open ? "auto" : "none",
    transition: open
      ? "opacity 0.22s ease 0.48s, background 0.15s ease"
      : "opacity 0.08s ease, background 0.15s ease",
  };

  return (
    <div style={stage}>
      <div
        style={outer}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => {
          setHover(false);
          setPress(false);
        }}
        onPointerDown={() => setPress(true)}
        onPointerUp={() => setPress(false)}
        onClick={openBanner}
        role="button"
        tabIndex={auto ? -1 : 0}
        aria-label="Expand fractional shares banner"
        onKeyDown={(e) => {
          if (!open && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openBanner();
          }
        }}
      >
        <div style={ring} />
        <div style={iconWrap}>
          {glass ? (
            <img src={MARK_SRC} alt="" width={22} height={22} style={{ display: "block", flexShrink: 0 }} />
          ) : (
            <span style={glyph} />
          )}
        </div>
        <div style={copy}>
          {text.split("").map((ch, i) => {
            const outDelay = (n - 1 - i) * 2;
            const chStyle: CSSProperties = {
              display: "inline-block",
              whiteSpace: "pre",
              fontWeight: i >= bStart && i < bEnd ? (glass ? 500 : 600) : glass ? 300 : 500,
              opacity: open ? 1 : 0,
              transform: open ? "translateY(0)" : "translateY(4px)",
              transition: open
                ? `opacity 0.12s linear ${420 + i * 6}ms, transform 0.18s ease-out ${420 + i * 6}ms`
                : `opacity 0.08s linear ${outDelay}ms, transform 0.1s ease-in ${outDelay}ms`,
            };
            return (
              <span key={i} style={chStyle}>
                {ch}
              </span>
            );
          })}
        </div>
        <div
          style={close}
          onMouseEnter={() => setXHover(true)}
          onMouseLeave={() => setXHover(false)}
          onClick={(e) => {
            e.stopPropagation();
            closeBanner();
          }}
          role="button"
          tabIndex={open && !auto ? 0 : -1}
          aria-label="Collapse banner"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              closeBanner();
            }
          }}
        >
          <CloseIcon ink={ink} glass={glass} />
        </div>
      </div>
    </div>
  );
}
