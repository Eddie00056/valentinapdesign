// Chart maths ported verbatim from "Create Alert Prototype.dc.html".

export const W = 393,
  H = 124,
  PAD_T = 10,
  PAD_B = 10,
  PAD_R = 8,
  N = 110;
export const UP = "#48d597",
  DOWN = "#ff557d";
export const BASE_Y = PAD_T + (H - PAD_T - PAD_B) * 0.62;
export const LEAD = "360ms cubic-bezier(.2,.9,.25,1)",
  TRAIL = "560ms cubic-bezier(.32,.78,.22,1)";

function walk(seed: number, n: number, drift: number, vol: number) {
  let s = seed,
    v = 50;
  const out: number[] = [];
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < n; i++) {
    v += drift + (rnd() - 0.5) * vol;
    out.push(v);
  }
  return out;
}

export const SERIES: Record<string, number[]> = {
  "1D": walk(7, 60, -0.22, 3.2),
  "1W": walk(19, 90, -0.1, 3.6),
  "1M": walk(31, 120, 0.34, 4.4),
  "3M": walk(53, 140, 0.28, 6.0),
  "6M": walk(71, 160, 0.22, 7.5),
  YTD: walk(83, 175, 0.18, 8.2),
  "1Y": walk(97, 190, 0.3, 9.0),
};

export type Candle = {
  cx: number;
  x: number;
  w: number;
  y: number;
  h: number;
  hi: number;
  lo: number;
  up: boolean;
};

export function candles(raw: number[], n: number): Candle[] {
  const W = 393,
    H = 124,
    PAD_T = 4,
    PAD_B = 6;
  const step = raw.length / n;
  const out: Candle[] = [];
  let lo = Infinity,
    hi = -Infinity;
  const buckets: { o: number; c: number; h: number; l: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * step),
      b = Math.max(a + 1, Math.floor((i + 1) * step));
    const seg = raw.slice(a, b);
    const o = seg[0],
      c = seg[seg.length - 1];
    const rawH = Math.max.apply(null, seg),
      rawL = Math.min.apply(null, seg);
    const pad = Math.max(Math.abs(c - o) * 0.9, (rawH - rawL) * 0.5, 0.35);
    const h = Math.max(rawH, Math.max(o, c)) + pad,
      l = Math.min(rawL, Math.min(o, c)) - pad;
    buckets.push({ o, c, h, l });
    if (l < lo) lo = l;
    if (h > hi) hi = h;
  }
  const span = hi - lo || 1;
  const k = (H - PAD_T - PAD_B) / span;
  const y = (v: number) => PAD_T + (hi - v) * k;
  const slot = W / n,
    bw = Math.max(2.4, slot * 0.56);
  for (let i = 0; i < n; i++) {
    const q = buckets[i],
      up = q.c >= q.o;
    const top = y(Math.max(q.o, q.c)),
      bot = y(Math.min(q.o, q.c));
    out.push({
      cx: +(i * slot + slot / 2).toFixed(2),
      x: +(i * slot + (slot - bw) / 2).toFixed(2),
      w: +bw.toFixed(2),
      y: +top.toFixed(2),
      h: +Math.max(1.2, bot - top).toFixed(2),
      hi: +y(q.h).toFixed(2),
      lo: +y(q.l).toFixed(2),
      up,
    });
  }
  return out;
}

export type Geometry = {
  up: boolean;
  linePath: string;
  areaPath: string;
  pathLen: number;
  dot: [number, number];
};

export function geometry(raw: number[]): Geometry {
  const vals: number[] = [];
  for (let i = 0; i < N; i++) {
    const t = (i / (N - 1)) * (raw.length - 1),
      a = Math.floor(t),
      b = Math.min(raw.length - 1, a + 1);
    vals.push(raw[a] + (raw[b] - raw[a]) * (t - a));
  }
  const v0 = vals[0];
  const up = Math.max(...vals) - v0,
    down = v0 - Math.min(...vals);
  const k = Math.min(
    up > 0 ? (BASE_Y - PAD_T) / up : Infinity,
    down > 0 ? (H - PAD_B - BASE_Y) / down : Infinity,
  );
  const pts = vals.map(
    (v, i) =>
      [(i / (vals.length - 1)) * (W - PAD_R), BASE_Y - (v - v0) * k] as [
        number,
        number,
      ],
  );
  let d = "M" + pts[0][0].toFixed(2) + " " + pts[0][1].toFixed(2),
    len = 0;
  for (let i = 1; i < pts.length; i++) {
    d += "L" + pts[i][0].toFixed(2) + " " + pts[i][1].toFixed(2);
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  const last = pts[pts.length - 1];
  return {
    up: vals[vals.length - 1] >= v0,
    linePath: d,
    areaPath: d + "L" + last[0].toFixed(2) + " " + H + "L0 " + H + "Z",
    pathLen: Math.ceil(len),
    dot: last,
  };
}
