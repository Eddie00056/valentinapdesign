import { useEffect, useRef } from "react";

type Props = {
  /** grid pitch, CSS px (the GlobalShell canvas: 24) */
  spacing?: number;
  /** dot radius, CSS px */
  dotRadius?: number;
  /** how far the cursor reaches, CSS px */
  radius?: number;
  /** how far a dot is pushed at the cursor's centre, CSS px */
  push?: number;
  /** spring back to home: stiffness and damping, per frame */
  stiffness?: number;
  damping?: number;
  /** slow idle drift, CSS px */
  drift?: number;
  /** thin lines between neighbouring dots near the cursor */
  lineDistance?: number;
  lineOpacity?: number;
  /** colours: the shell's own */
  dotColor?: [number, number, number];
  lineColor?: [number, number, number];
  /** fraction of the grid kept on small screens */
  mobileDensity?: number;
  /** where the field is: an ellipse (fractions of the canvas) with the dots
      at full strength inside `inner` of its radius, dissolving outward —
      each dot fainter and smaller, and more of them dropped, towards the
      rim. Omit for an even field. */
  falloff?: { cx: number; cy: number; rx: number; ry: number; inner: number };
};

/**
 * The GlobalShell empty state's dot grid as a live field behind the hero:
 * every dot has a home on the 24px grid, drifts a hair around it, is
 * pushed aside by the cursor (or a touch) and springs back when it leaves.
 * Near the cursor, neighbouring dots are joined by fine lines.
 *
 * Canvas 2D, one rAF loop, DPR-aware, paused while hidden or off screen.
 * Reduced motion: the grid is drawn once, still. pointer-events: none —
 * the cursor is read from the window, so it never blocks the page.
 */
export function DotField({
  spacing = 24,
  dotRadius = 1.3,
  radius = 160,
  push = 22,
  stiffness = 0.06,
  damping = 0.82,
  drift = 1.2,
  lineDistance = 34,
  lineOpacity = 0.22,
  dotColor = [50, 56, 58],
  lineColor = [72, 213, 151],
  mobileDensity = 0.6,
  falloff,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0;
    let H = 0;
    let dpr = 1;
    let pitch = spacing;
    // per dot: home x/y, offset x/y, velocity x/y, drift phase
    let hx = new Float32Array(0);
    let hy = new Float32Array(0);
    let ox = new Float32Array(0);
    let oy = new Float32Array(0);
    let vx = new Float32Array(0);
    let vy = new Float32Array(0);
    let ph = new Float32Array(0);
    // per dot: strength 0–1 from the falloff (0 = not drawn)
    let st = new Float32Array(0);
    let cols = 0;
    let rows = 0;

    const build = () => {
      const r = canvas.getBoundingClientRect();
      W = r.width;
      H = r.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // fewer dots on small screens: a wider pitch
      pitch = W < 760 ? spacing / Math.sqrt(mobileDensity) : spacing;
      cols = Math.ceil(W / pitch) + 1;
      rows = Math.ceil(H / pitch) + 1;
      const n = cols * rows;
      hx = new Float32Array(n);
      hy = new Float32Array(n);
      ox = new Float32Array(n);
      oy = new Float32Array(n);
      vx = new Float32Array(n);
      vy = new Float32Array(n);
      ph = new Float32Array(n);
      st = new Float32Array(n);
      const x0 = (W - (cols - 1) * pitch) / 2;
      const y0 = (H - (rows - 1) * pitch) / 2;
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const k = j * cols + i;
          hx[k] = x0 + i * pitch;
          hy[k] = y0 + j * pitch;
          ph[k] = ((i * 7.13 + j * 3.71) % 6.283) + (i ^ j) * 0.01;
          if (!falloff) {
            st[k] = 1;
            continue;
          }
          const ex = (hx[k] / W - falloff.cx) / falloff.rx;
          const ey = (hy[k] / H - falloff.cy) / falloff.ry;
          const d = Math.sqrt(ex * ex + ey * ey);
          // smoothstep from the rim (0) to the inner core (1)
          const u = Math.min(1, Math.max(0, (1 - d) / (1 - falloff.inner)));
          const sm = u * u * (3 - 2 * u);
          // a fixed per-dot hash decides who drops out as it thins
          const h = Math.abs(Math.sin(i * 127.1 + j * 311.7) * 43758.5453) % 1;
          st[k] = h < Math.pow(sm, 0.6) ? sm : 0;
        }
    };

    // the cursor, eased so the field never jumps
    const target = { x: -1e4, y: -1e4, on: false };
    const cur = { x: -1e4, y: -1e4, k: 0 };
    const onMove = (cx: number, cy: number) => {
      const r = canvas.getBoundingClientRect();
      target.x = cx - r.left;
      target.y = cy - r.top;
      target.on = target.x > -radius && target.x < W + radius && target.y > -radius && target.y < H + radius;
      if (cur.x < -1e3) {
        cur.x = target.x;
        cur.y = target.y;
      }
    };
    const mm = (e: PointerEvent) => onMove(e.clientX, e.clientY);
    const tm = (e: TouchEvent) => e.touches[0] && onMove(e.touches[0].clientX, e.touches[0].clientY);
    const leave = () => (target.on = false);

    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      const n = hx.length;
      const cr = radius;
      const cr2 = cr * cr;
      const s = cur.k;
      // dots, in a few strength bands so each band is one fill
      const BANDS = 6;
      for (let b = 1; b <= BANDS; b++) {
        const lo = (b - 1) / BANDS;
        const hi = b / BANDS;
        const a = (lo + hi) / 2;
        ctx.fillStyle = `rgba(${dotColor[0]},${dotColor[1]},${dotColor[2]},${a.toFixed(3)})`;
        ctx.beginPath();
        for (let k = 0; k < n; k++) {
          const sk = st[k];
          if (sk <= lo || sk > hi) continue;
          const x = hx[k] + ox[k];
          const y = hy[k] + oy[k];
          const r = dotRadius * (0.55 + 0.45 * sk);
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, 6.2832);
        }
        ctx.fill();
      }
      // near the cursor: brighter dots and the joining lines
      if (s > 0.01) {
        const i0 = Math.max(0, Math.floor((cur.x - cr - hx[0]) / pitch));
        const i1 = Math.min(cols - 1, Math.ceil((cur.x + cr - hx[0]) / pitch));
        const j0 = Math.max(0, Math.floor((cur.y - cr - hy[0]) / pitch));
        const j1 = Math.min(rows - 1, Math.ceil((cur.y + cr - hy[0]) / pitch));
        const ld2 = lineDistance * lineDistance;
        ctx.lineWidth = 0.6;
        for (let j = j0; j <= j1; j++)
          for (let i = i0; i <= i1; i++) {
            const k = j * cols + i;
            const x = hx[k] + ox[k];
            const y = hy[k] + oy[k];
            const dx = x - cur.x;
            const dy = y - cur.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > cr2 || st[k] === 0) continue;
            const f = (1 - Math.sqrt(d2) / cr) * s * st[k];
            // right and down neighbours only, so each line is drawn once
            for (const nk of [i < cols - 1 ? k + 1 : -1, j < rows - 1 ? k + cols : -1]) {
              if (nk < 0 || st[nk] === 0) continue;
              const nx = hx[nk] + ox[nk];
              const ny = hy[nk] + oy[nk];
              const ex = nx - x;
              const ey = ny - y;
              if (ex * ex + ey * ey > ld2) continue;
              ctx.strokeStyle = `rgba(${lineColor[0]},${lineColor[1]},${lineColor[2]},${(lineOpacity * f).toFixed(3)})`;
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(nx, ny);
              ctx.stroke();
            }
            ctx.fillStyle = `rgba(${lineColor[0]},${lineColor[1]},${lineColor[2]},${(lineOpacity * 1.6 * f).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(x, y, dotRadius, 0, 6.2832);
            ctx.fill();
          }
      }
      void t;
    };

    const step = (t: number) => {
      // ease the cursor and its presence
      cur.x += (target.x - cur.x) * 0.18;
      cur.y += (target.y - cur.y) * 0.18;
      cur.k += ((target.on ? 1 : 0) - cur.k) * 0.08;
      const n = hx.length;
      const cr2 = radius * radius;
      const tt = t / 1000;
      for (let k = 0; k < n; k++) {
        // where the dot wants to be: home, a slow drift, pushed off the cursor
        let gx = Math.sin(tt * 0.6 + ph[k]) * drift;
        let gy = Math.cos(tt * 0.5 + ph[k] * 1.3) * drift;
        if (cur.k > 0.001) {
          const dx = hx[k] - cur.x;
          const dy = hy[k] - cur.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < cr2 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const f = (1 - d / radius) ** 2 * push * cur.k;
            gx += (dx / d) * f;
            gy += (dy / d) * f;
          }
        }
        // a damped spring towards it: fluid, no jumps
        vx[k] = (vx[k] + (gx - ox[k]) * stiffness) * damping;
        vy[k] = (vy[k] + (gy - oy[k]) * stiffness) * damping;
        ox[k] += vx[k];
        oy[k] += vy[k];
      }
      draw(t);
    };

    build();
    if (reduce) {
      draw(0);
      const ro = new ResizeObserver(() => {
        build();
        draw(0);
      });
      ro.observe(canvas);
      return () => ro.disconnect();
    }

    let raf = 0;
    let visible = true;
    const loop = (t: number) => {
      step(t);
      raf = requestAnimationFrame(loop);
    };
    const run = () => {
      cancelAnimationFrame(raf);
      if (visible && document.visibilityState === "visible") raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      run();
    });
    io.observe(canvas);
    const ro = new ResizeObserver(() => build());
    ro.observe(canvas);
    document.addEventListener("visibilitychange", run);
    window.addEventListener("pointermove", mm, { passive: true });
    window.addEventListener("touchmove", tm, { passive: true });
    window.addEventListener("touchstart", tm, { passive: true });
    document.addEventListener("pointerleave", leave);
    window.addEventListener("touchend", leave);
    run();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("pointermove", mm);
      window.removeEventListener("touchmove", tm);
      window.removeEventListener("touchstart", tm);
      document.removeEventListener("pointerleave", leave);
      window.removeEventListener("touchend", leave);
    };
    // colours by value: a literal array prop is a new object every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spacing, dotRadius, radius, push, stiffness, damping, drift, lineDistance, lineOpacity, dotColor.join(), lineColor.join(), mobileDensity, falloff && Object.values(falloff).join()]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", display: "block" }}
    />
  );
}
