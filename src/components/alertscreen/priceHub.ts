// Shared price clock — ported from the .dc.html `pxHub`.
// One timer advances a mean-reverting walk and pushes {price, prev, dir, n}
// to every subscriber.

const PX_STEP = 1600;
export const PX_BASE = 194.29;

export type PriceState = {
  price: number;
  prev: number;
  dir: number;
  n: number;
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
    h.subs.forEach((fn) => fn(h));
  }, PX_STEP);

  window.__pxHub = h;
  return h;
}
