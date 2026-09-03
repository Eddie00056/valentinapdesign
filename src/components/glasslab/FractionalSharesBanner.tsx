import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

/**
 * Ported from the "Fractional Shares Banner" design-canvas handoff.
 * A collapsed glass pill that slides and unfurls into a banner with a
 * staggered per-letter reveal; the close (x) collapses it back.
 */

const BLUE = "#0055B6";

const GLASS: CSSProperties = {
  isolation: "isolate",
  border: 0,
  zIndex: 1,
  background: "rgba(255, 255, 255, 0.5)",
  backgroundImage:
    "linear-gradient(rgba(0,102,219,0.10), rgba(0,102,219,0.10))",
};

const MASK: CSSProperties = {
  WebkitMask:
    "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
  WebkitMaskComposite: "xor",
  maskComposite: "exclude",
  pointerEvents: "none",
};

const STROKE_BASE: CSSProperties = {
  ...MASK,
  borderRadius: "inherit",
  zIndex: 3,
  boxSizing: "border-box",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 25.12%, rgba(255,255,255,0.6) 102.08%)",
};

const MARK_SRC = "/work/glass/mark.png";

function CloseIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" style={{ display: "block" }}>
      <path
        d="M1.4 1.4l11.2 11.2M12.6 1.4L1.4 12.6"
        stroke={BLUE}
        strokeOpacity={0.55}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function FractionalSharesBanner({
  text = "Fractional shares available for AAPL market orders",
  boldTerm = "AAPL",
  expandedWidth = 590,
  stageWidth = 680,
  collapsedPosition = "center",
  auto = false,
}: {
  text?: string;
  boldTerm?: string;
  expandedWidth?: number;
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
  const w = expandedWidth;
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
    borderRadius: 33,
    cursor: open ? "default" : "pointer",
    overflow: "hidden",
    boxSizing: "border-box",
    contain: "paint",
    transformOrigin: open ? "33px center" : "center center",
    backgroundImage:
      !open && hover
        ? "linear-gradient(rgba(0,102,219,0.17), rgba(0,102,219,0.17))"
        : "linear-gradient(rgba(0,102,219,0.10), rgba(0,102,219,0.10))",
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
    opacity: 0.5,
    padding: 1,
    background: open
      ? "linear-gradient(168deg, #A9CBF2 0%, #DCEFFA 42%, #7FA9E4 100%)"
      : "linear-gradient(273.75deg, #6C9BE6 3.96%, #B2E1F5 34.23%, #6291DC 98.29%)",
    transition: "background 0.4s ease",
  };

  const stroke: CSSProperties = {
    ...STROKE_BASE,
    position: "absolute",
    left: 1,
    right: 1,
    top: 1,
    bottom: 1,
    padding: 1,
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

  const copy: CSSProperties = {
    position: "absolute",
    left: 58,
    right: 61,
    top: "50%",
    fontSize: 21,
    lineHeight: 1.4,
    color: BLUE,
    whiteSpace: "nowrap",
    fontWeight: 300,
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
    background: xHover ? "rgba(0,85,182,0.09)" : "transparent",
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
        <div style={stroke} />
        <div style={iconWrap}>
          <img
            src={MARK_SRC}
            alt=""
            width={22}
            height={22}
            style={{ display: "block", flexShrink: 0 }}
          />
        </div>
        <div style={copy}>
          {text.split("").map((ch, i) => {
            const outDelay = (n - 1 - i) * 2;
            const chStyle: CSSProperties = {
              display: "inline-block",
              whiteSpace: "pre",
              fontWeight: i >= bStart && i < bEnd ? 500 : 300,
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
          <CloseIcon />
        </div>
      </div>
    </div>
  );
}
