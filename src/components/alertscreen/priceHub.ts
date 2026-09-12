// Shared price clock — ported from the .dc.html `pxHub`.
// One timer advances a mean-reverting walk and pushes {price, prev, dir, n}
// to every subscriber.

/* Exported: anything that wants to beat in time with the quote needs this,
   not a number of its own that happens to match today. */
export const PX_STEP = 2200;
export const PX_BASE = 194.29;

export type PriceState = {
  price: number;
  prev: number;
  dir: number;
  n: number;
  /** `Date.now()` of the last tick. Lets a subscriber work out where in the
      cycle it is joining — a CSS animation can then be phase-locked to the
      clock with a negative `animation-delay` instead of free-running.
      Optional: several screens build a PriceState literal of their own for
      their initial state, and none of them need it. */
  t?: number;
};

type Hub = PriceState & {
  subs: ((h: PriceState) => void)[];
  timer: ReturnType<typeof setInterval>;
  subscribe: (fn: (h: PriceState) => void) => () => void;
};

declare global {
  interface Window {
    __pxHub?: Hub;
  }
}

export function pxHub(): Hub {
  if (typeof window === "undefined") {
    // SSR guard — never actually subscribed during prerender
    return {
      price: PX_BASE,
      prev: PX_BASE,
      dir: 0,
      n: 0,
      t: 0,
      subs: [],
      timer: 0 as unknown as ReturnType<typeof setInterval>,
      subscribe: () => () => {},
    };
  }
  if (window.__pxHub) return window.__pxHub;

  const h = {
    price: PX_BASE,
    prev: PX_BASE,
    dir: 0,
    n: 0,
    t: Date.now(),
    subs: [] as ((s: PriceState) => void)[],
  } as Hub;

  h.subscribe = (fn) => {
    h.subs.push(fn);
    return () => {
      h.subs = h.subs.filter((f) => f !== fn);
    };
  };

  h.timer = setInterval(() => {
    const pull = (PX_BASE - h.price) * 0.14;
    const d = (Math.random() - 0.5) * 0.34 + pull;
    h.prev = h.price;
    h.price = +(h.price + d).toFixed(2);
    h.dir = d >= 0 ? 1 : -1;
    h.n++;
    h.t = Date.now();
    h.subs.forEach((fn) => fn(h));
  }, PX_STEP);

  window.__pxHub = h;
  return h;
}
