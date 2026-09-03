import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

/**
 * Ported from the "Limit Order Error" design-canvas handoff.
 * A glass pill button whose blue error ring draws around the perimeter,
 * starting above the chevron, with a light sheen sweep on commit.
 */

const INK = "#262D33";
const RING_BLUE = "#1682FF";

const MASK: CSSProperties = {
  WebkitMask:
    "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
  WebkitMaskComposite: "xor",
  maskComposite: "exclude",
  pointerEvents: "none",
};

type S = {
  err: boolean;
  hover: boolean;
  press: boolean;
  drawn: boolean;
  glow: boolean;
  sweep: boolean;
};

const INIT: S = {
  err: false,
  hover: false,
  press: false,
  drawn: false,
  glow: false,
  sweep: false,
};

function Chevron() {
  return (
    <svg width={15} height={9} viewBox="0 0 15 9" fill="none" style={{ display: "block" }}>
      <path
        d="M1.5 1.5L7.5 7.5L13.5 1.5"
        stroke="#111417"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LimitOrderError({
  tint = 0.06,
  auto = false,
}: {
  tint?: number;
  auto?: boolean;
}) {
  const [s, setS] = useState<S>(INIT);
  const set = (p: Partial<S>) => setS((v) => ({ ...v, ...p }));

  const t1 = useRef<number | undefined>(undefined);
  const t2 = useRef<number | undefined>(undefined);
  const t3 = useRef<number | undefined>(undefined);

  const clear = () => {
    window.clearTimeout(t1.current);
    window.clearTimeout(t2.current);
    window.clearTimeout(t3.current);
  };

  const toggle = () => {
    clear();
    if (s.err) {
      set({ err: false, drawn: false, glow: false, sweep: false });
      return;
    }
    set({ err: true, drawn: false, glow: false, sweep: false });
    requestAnimationFrame(() => set({ sweep: true }));
    t1.current = window.setTimeout(() => set({ drawn: true, glow: true }), 420);
    t2.current = window.setTimeout(() => set({ glow: false }), 480);
    t3.current = window.setTimeout(() => set({ sweep: false }), 640);
  };

  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;

  useEffect(() => {
    if (!auto) return clear;
    const id = window.setInterval(() => toggleRef.current(), 3000);
    return () => {
      window.clearInterval(id);
      clear();
    };
  }, [auto]);

  const { err, hover, press, drawn, glow, sweep } = s;

  const shadow = press
    ? "0 4px 10px rgba(0,0,0,0.08)"
    : hover
      ? "0 12px 24px rgba(0,0,0,0.10)"
      : "0 8px 16px rgba(0,0,0,0.06)";

  const stage: CSSProperties = {
    width: 400,
    height: 160,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: auto ? "none" : undefined,
  };

  const btn: CSSProperties = {
    isolation: "isolate",
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    width: 160,
    height: 48,
    padding: 0,
    border: 0,
    borderRadius: 1000,
    background: "rgba(255, 255, 255, 0.5)",
    backgroundImage: `linear-gradient(rgba(20,26,32,${
      hover ? tint + 0.04 : tint
    }), rgba(20,26,32,${hover ? tint + 0.04 : tint}))`,
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    boxShadow: shadow,
    cursor: "pointer",
    userSelect: "none",
    transform: press ? "scale(0.97)" : hover ? "scale(1.03)" : "scale(1)",
    transition:
      "box-shadow 0.2s ease, background-image 0.2s ease, transform 0.24s cubic-bezier(0.34,1.4,0.5,1)",
  };

  const ring: CSSProperties = {
    ...MASK,
    position: "absolute",
    inset: 0,
    padding: 1,
    borderRadius: "inherit",
    zIndex: 2,
    opacity: 0.9,
    background:
      "linear-gradient(273.75deg, #D8DDE4 3.96%, #FFFFFF 34.23%, #CDD3DB 98.29%)",
  };

  const stroke: CSSProperties = {
    ...MASK,
    position: "absolute",
    left: 1,
    right: 1,
    top: 1,
    bottom: 1,
    padding: 1,
    borderRadius: "inherit",
    zIndex: 3,
    boxSizing: "border-box",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 28%, rgba(255,255,255,0.65) 102%)",
  };

  const trace: CSSProperties = {
    strokeDasharray: "101 100",
    strokeDashoffset: err ? 0 : 102,
    opacity: err && !drawn ? 1 : 0,
    transition: err
      ? "stroke-dashoffset 0.42s cubic-bezier(0.3,0.02,0.2,1), opacity 0.1s linear"
      : "stroke-dashoffset 0.42s cubic-bezier(0.5,0,0.75,0), opacity 0.1s linear 0.36s",
  };

  const sheenClip: CSSProperties = {
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    overflow: "hidden",
    zIndex: 3,
    pointerEvents: "none",
  };

  const sheenBar: CSSProperties = {
    position: "absolute",
    top: -24,
    bottom: -24,
    width: 64,
    background:
      "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.9) 48%, rgba(255,255,255,0) 100%)",
    transform: sweep
      ? "translateX(190px) skewX(-18deg)"
      : "translateX(-80px) skewX(-18deg)",
    opacity: sweep ? 1 : 0,
    transition: sweep
      ? "transform 0.56s cubic-bezier(0.36,0,0.28,1), opacity 0.12s linear"
      : "opacity 0.14s linear",
  };

  const solidRing: CSSProperties = {
    position: "absolute",
    left: -2.5,
    top: -2.5,
    right: -2.5,
    bottom: -2.5,
    borderRadius: 1000,
    border: `2.5px solid ${RING_BLUE}`,
    pointerEvents: "none",
    zIndex: 4,
    opacity: drawn ? 1 : 0,
    boxShadow: glow
      ? "0 0 0 0px rgba(22,130,255,0.28)"
      : "0 0 0 9px rgba(22,130,255,0)",
    transition: drawn
      ? "opacity 0.12s linear, box-shadow 0.44s cubic-bezier(0.2,0.7,0.3,1)"
      : "opacity 0.1s linear",
  };

  const label: CSSProperties = {
    position: "relative",
    zIndex: 5,
    fontSize: 17,
    fontWeight: 600,
    letterSpacing: "-0.01em",
    color: INK,
    lineHeight: 1,
    whiteSpace: "nowrap",
  };

  const chevWrap: CSSProperties = {
    display: "flex",
    alignItems: "center",
    marginTop: 1,
    position: "relative",
    zIndex: 5,
  };

  const svgStyle: CSSProperties = {
    position: "absolute",
    left: -2.5,
    top: -2.5,
    pointerEvents: "none",
    overflow: "visible",
    zIndex: 4,
  };

  return (
    <div style={stage}>
      <div
        style={btn}
        onMouseEnter={() => set({ hover: true })}
        onMouseLeave={() => set({ hover: false, press: false })}
        onPointerDown={() => set({ press: true })}
        onPointerUp={() => set({ press: false })}
        onClick={toggle}
        role="button"
        tabIndex={auto ? -1 : 0}
        aria-label="Trigger limit order error"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
      >
        <div style={ring} />
        <div style={stroke} />
        <div style={sheenClip}>
          <div style={sheenBar} />
        </div>
        <div style={solidRing} />
        <svg
          width={165}
          height={53}
          viewBox="0 0 165 53"
          fill="none"
          style={svgStyle}
        >
          <path
            d="M122.5 1.25 H138.5 A25.25 25.25 0 0 1 138.5 51.75 H26.5 A25.25 25.25 0 0 1 26.5 1.25 Z"
            stroke="#1682FF"
            strokeWidth={2.5}
            strokeLinecap="round"
            pathLength={100}
            style={trace}
          />
        </svg>
        <div style={label}>Limit order</div>
        <div style={chevWrap}>
          <Chevron />
        </div>
      </div>
    </div>
  );
}
