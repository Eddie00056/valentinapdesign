import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

/**
 * A live analogue clock (slide 26, beside the "faster order submission"
 * success metrics). Hands are driven straight from the wall clock on every
 * animation frame via refs — no React state, no re-renders.
 *
 * `handColor` exists because the deck's slide is black: the original
 * black hands vanish there, so the slide passes white.
 */

function angles() {
  const now = new Date();
  const s = now.getSeconds() + now.getMilliseconds() / 1000;
  const m = now.getMinutes() + s / 60;
  const h = (now.getHours() % 12) + m / 60;
  return { h: h * 30, m: m * 6, s: s * 6 };
}

const hand = (length: number, width: number, color: string, deg: number, glow: boolean): CSSProperties => ({
  position: "absolute",
  height: length,
  width,
  bottom: "50%",
  left: "50%",
  marginLeft: -width / 2,
  background: color,
  transformOrigin: "bottom center",
  transform: `rotate(${deg}deg)`,
  borderRadius: width,
  boxShadow: glow ? "0 0 10px rgba(0,0,0,0.4)" : undefined,
  zIndex: 1,
});

export function InlineClock({
  size = 350,
  borderColor = "rgba(0,0,0,0.08)",
  handColor = "black",
  secondsColor = "#FF4B3E",
  dotColor = "white",
  dotBorder = "#1b1b1b",
}: {
  size?: number;
  borderColor?: string;
  handColor?: string;
  secondsColor?: string;
  dotColor?: string;
  dotBorder?: string;
}) {
  // the server renders the time it rendered at; the first frame corrects it
  const initial = angles();
  const hrs = useRef<HTMLSpanElement>(null);
  const min = useRef<HTMLSpanElement>(null);
  const sec = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let id = 0;
    const tick = () => {
      const { h, m, s } = angles();
      if (hrs.current) hrs.current.style.transform = `rotate(${h}deg)`;
      if (min.current) min.current.style.transform = `rotate(${m}deg)`;
      if (sec.current) sec.current.style.transform = `rotate(${s}deg)`;
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  const glow = handColor === "black";
  // hands, ring and dot were drawn for a 350px clock; keep those proportions
  // at any size (a 24px clock with 6px hands is a blob)
  const k = size / 350;
  const px = (v: number, min: number) => Math.max(min, v * k);
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        boxSizing: "border-box",
        borderRadius: "50%",
        border: `${px(6, 1)}px solid ${borderColor}`,
      }}
    >
      <span suppressHydrationWarning ref={hrs} style={hand(size * 0.286, px(6, 1.6), handColor, initial.h, glow)} />
      <span suppressHydrationWarning ref={min} style={hand(size * 0.371, px(4, 1.2), handColor, initial.m, glow)} />
      <span suppressHydrationWarning ref={sec} style={hand(size * 0.257, px(2, 0.8), secondsColor, initial.s, false)} />
      <span
        style={{
          position: "absolute",
          width: px(12, 3),
          height: px(12, 3),
          boxSizing: "border-box",
          borderRadius: "50%",
          background: dotColor,
          border: `${px(2, 0.75)}px solid ${dotBorder}`,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 2,
        }}
      />
    </div>
  );
}
