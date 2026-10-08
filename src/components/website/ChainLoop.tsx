import { useEffect, useLayoutEffect, useRef, useState } from "react";

/* The chain-to-order prototype (deck slide 51), playing itself on a loop:
   a drawn pointer crosses the chain (rows and prices light as it passes),
   clicks a price onto the ticket, a second one makes it a spread, then
   submits, confirms and places the order — and a fresh copy crossfades in
   and it runs again.

   It runs in a frame because the prototype is a whole 1440×900 workspace
   screen. The frame is drawn at that size and scaled down to the card, with
   a crop around the two widgets. The confirmation and the "order placed"
   toast are `position: fixed` against that screen, so they are re-pinned
   into the crop with CSS (the deck pins them by measuring; here the crop is
   a known box, so plain numbers do). */

const SRC = "/work/chain-to-order?static&bare";
const SCREEN_W = 1440;
const SCREEN_H = 900;

/* the chain + ticket pair, in screen pixels, with the rail hidden */
const PAIR = { x: 122, y: 40, w: 877, h: 464 };
/* the crop hugs the pair; the card takes its shape from it */
const MARGIN_X = 40;
const MARGIN_Y = 32;
const CROP_W = PAIR.w + MARGIN_X * 2;
const CROP_H = PAIR.h + MARGIN_Y * 2;
/* The workspace canvas (top-left at 122, 40) clips everything inside it,
   the confirmation's dimmed backdrop included. Centred on the pair, the
   crop would start 40px left of it and 32px above, and the backdrop left
   an undimmed strip down that side and across the top. So the pair is
   moved into the canvas by that much and the crop starts on its corner. */
const CANVAS = { x: 122, y: 40 };
const SHIFT_X = Math.max(0, CANVAS.x - (PAIR.x + PAIR.w / 2 - CROP_W / 2));
const DROP = Math.max(0, CANVAS.y - (PAIR.y + PAIR.h / 2 - CROP_H / 2));
const CROP_X = PAIR.x + SHIFT_X + PAIR.w / 2 - CROP_W / 2;
const CROP_Y = PAIR.y + DROP + PAIR.h / 2 - CROP_H / 2;
const px = (n: number) => `${Math.round(n)}px`;
/* the card's ground: a step lighter than the widgets so they stand off it.
   The frame is painted the same so the crop never shows a seam. */
const GROUND = "#17181a";

const CSS = `
.wsp-rail { visibility: hidden !important; }
.wsp, .wsp-stage, .wsp-screen, .wsp-canvas {
  background: none !important; box-shadow: none !important; border: none !important;
}
.ctt {
  min-height: 0 !important; padding: 0 !important; width: max-content !important;
  margin-top: ${px(DROP)} !important;
  margin-left: ${px(SHIFT_X)} !important;
}
.cmt-fab, .cmt-root, .oc-back, astro-dev-toolbar { display: none !important; }
/* the widgets are see-through in bare mode; they go solid, as
   on the deck slide */
html.is-bare .wshell.wshell { background: #010101 !important; }
/* the confirmation centres on the crop, not on the whole screen */
.ob-stage .ob-modal-wrap {
  inset: auto !important;
  left: ${px(CROP_X)} !important; top: ${px(CROP_Y)} !important;
  width: ${px(CROP_W)} !important; height: ${px(CROP_H)} !important;
}
/* the toast sits at the foot of the crop, centred on it */
.ob-stage .ob-toast-wrap {
  left: ${px(CROP_X)} !important; right: ${px(SCREEN_W - CROP_X - CROP_W)} !important;
  bottom: ${px(SCREEN_H - CROP_Y - CROP_H + 32)} !important;
}`;

/* The pointer: an arrow drawn inside the frame, so it scales with the
   prototype. `:hover` can't be set from a script, so the pointer marks
   whatever is under its tip with [data-hov] and these rules repeat the
   prototype's own hover styles for that mark (option-chain.css and the
   ticket's CTA rules). */
const POINTER_CSS = `
#cl-cursor {
  position: fixed; left: 0; top: 0; width: 0; height: 0;
  z-index: 2147483647; pointer-events: none; will-change: transform;
  transition-property: transform;
  transition-timing-function: cubic-bezier(0.5, 0, 0.25, 1);
}
#cl-cursor svg {
  display: block; width: 28px; height: 28px; margin: -3.5px 0 0 -7px;
  transform-origin: 7px 3.5px; transition: transform 90ms ease;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35));
}
#cl-cursor.is-down svg { transform: scale(0.84); }
#cl-cursor i {
  position: absolute; left: -16px; top: -16px; width: 32px; height: 32px;
  border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.75); opacity: 0;
}
#cl-cursor i.go { animation: cl-ripple 420ms ease-out; }
@keyframes cl-ripple {
  from { opacity: 0.9; transform: scale(0.3); }
  to { opacity: 0; transform: scale(1.15); }
}
.oc-row[data-hov] { background: #272e30; }
.oc-cell--pill[data-hov] .oc-pill { background: var(--pill-fg); color: #000000; }
.oc-cell--pill[data-hov] .oc-pill::before { opacity: 0; }
.ob-stage .ob-cta[data-side="buy"][data-hov] { background: #3baf7c; }
.ob-stage .ob-cta[data-side="sell"][data-hov] { background: #d9486a; }`;

/* the system arrow: tip at (6, 3) in a 24 box */
const ARROW = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v15.2l3.6-3.5 2.6 5.9 2.7-1.2-2.6-5.8h5.1z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg><i></i>`;

/* where the pointer waits: the empty corner right of the chain, under the
   ticket. A run starts and ends here, so the crossfade between copies
   doesn't move it. */
const REST = { x: CROP_X + CROP_W - 110, y: CROP_Y + CROP_H - 90 };

/* when the next copy starts loading (the toast has had its moment) */
const CYCLE = 9800;
const FADE = 500;

/**
 * One run: the pointer travels to each target — lighting the rows and the
 * prices it crosses — presses, and the target is clicked. Every wait is a
 * timer in `timers`, so clearing those stops the run where it stands.
 */
async function play(d: Document, timers: number[]) {
  const w = d.defaultView;
  if (!w) return;
  const sleep = (ms: number) =>
    new Promise<void>((r) => timers.push(window.setTimeout(r, ms)));
  const q = (sel: string) => d.querySelector<HTMLElement>(sel);

  const cur = d.createElement("div");
  cur.id = "cl-cursor";
  cur.innerHTML = ARROW;
  d.body.append(cur);
  const ring = cur.querySelector("i")!;
  const place = (x: number, y: number, ms: number) => {
    cur.style.transitionDuration = `${ms}ms`;
    cur.style.transform = `translate(${x}px, ${y}px)`;
  };
  place(REST.x, REST.y, 0);

  /* what the tip is over, every frame — the frame's own rAF, so it stops
     when the copy is removed */
  let marked: Element[] = [];
  const track = () => {
    const r = cur.getBoundingClientRect();
    const el = d.elementFromPoint(r.left, r.top);
    const now = el
      ? [el.closest(".oc-row"), el.closest(".oc-cell--pill"), el.closest(".ob-cta")].filter(
          (m): m is Element => !!m,
        )
      : [];
    for (const m of marked) if (!now.includes(m)) m.removeAttribute("data-hov");
    for (const m of now) m.setAttribute("data-hov", "");
    marked = now;
    w.requestAnimationFrame(track);
  };
  w.requestAnimationFrame(track);

  const go = async (el: HTMLElement | null | undefined, ms: number) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    place(r.left + r.width * 0.55, r.top + r.height * 0.6, ms);
    await sleep(ms + 120);
  };
  const press = async (el: HTMLElement | null | undefined) => {
    cur.classList.add("is-down");
    ring.classList.remove("go");
    void ring.offsetWidth;
    ring.classList.add("go");
    await sleep(110);
    el?.click();
    cur.classList.remove("is-down");
  };

  await sleep(500);
  const buy = q('[aria-label^="Buy 180 call"]');
  await go(buy, 900);
  await press(buy);
  await sleep(500);
  const sell = q('[aria-label^="Sell 185 call"]');
  await go(sell, 650);
  await press(sell);
  await sleep(600);
  const submit = q(".ctt .ob-cta");
  await go(submit, 900);
  await press(submit);
  await sleep(900);
  const send = [...d.querySelectorAll<HTMLElement>(".ob-modal-wrap .ob-cta")].find((b) =>
    b.textContent?.includes("Send"),
  );
  await go(send, 800);
  await press(send);
  await sleep(500);
  place(REST.x, REST.y, 1000);
}

/* React has wired the chain once its pills carry props — before that a
   click lands on server markup and does nothing */
function wired(d: Document) {
  const pill = d.querySelector('[aria-label^="Buy 180 call"]');
  return !!pill && Object.keys(pill).some((k) => k.startsWith("__reactProps"));
}

type Copy = { key: number; shown: boolean };

/** `ground`: the card's colour, painted behind the frame and in it (the
    homepage card is the charcoal GROUND; the case study's is near-black) */
export function ChainLoop({ ground = GROUND }: { ground?: string } = {}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  /* no copy until hydrated: a frame in the server markup finishes loading
     before React has attached onLoad, and the run never starts */
  const [copies, setCopies] = useState<Copy[]>([]);
  useEffect(() => setCopies([{ key: 0, shown: false }]), []);
  const frames = useRef(new Map<number, HTMLIFrameElement>());
  const timersOf = useRef(new Map<number, number[]>());
  const visible = useRef(true);
  const reduce =
    typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / CROP_W));
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => (visible.current = e.isIntersecting));
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  /* a copy has loaded: dress it, wait for React, show it, run the script,
     and queue the next copy */
  const onLoad = (key: number) => {
    const f = frames.current.get(key);
    const d = f?.contentDocument;
    if (!f || !d) return;
    const style = d.createElement("style");
    style.textContent =
      `html, body, html.is-bare, html.is-bare body { background: ${ground} !important; }` +
      CSS +
      POINTER_CSS;
    d.head.append(style);
    /* No focus inside a copy. The confirmation focuses its first button on
       open and hands focus back on close, and focusing anything inside a
       frame makes the browser scroll the PAGE to bring it into view — the
       homepage jumped every time the toast came up, and the page lost the
       keyboard. The run clicks; it never needs focus. */
    const fw = f.contentWindow as (Window & typeof globalThis) | null;
    if (fw) fw.HTMLElement.prototype.focus = function () {};

    const timers: number[] = [];
    timersOf.current.set(key, timers);
    const start = () => {
      setCopies((cs) => cs.map((c) => (c.key === key ? { ...c, shown: true } : c)));
      /* the copy before this one goes once the fade has finished */
      timers.push(
        window.setTimeout(() => setCopies((cs) => cs.filter((c) => c.key >= key)), FADE + 50),
      );
      if (reduce) return;
      void play(d, timers);
      const next = () => {
        /* off screen: hold here rather than load copies nobody sees */
        if (!visible.current) return void timers.push(window.setTimeout(next, 600));
        setCopies((cs) => [...cs, { key: key + 1, shown: false }]);
      };
      timers.push(window.setTimeout(next, CYCLE));
    };
    const wait = (tries = 0) => {
      if (wired(d) || tries > 60) start();
      else timers.push(window.setTimeout(() => wait(tries + 1), 100));
    };
    wait();
  };

  /* a removed copy's timers die with it */
  useEffect(() => {
    const live = new Set(copies.map((c) => c.key));
    for (const k of [...frames.current.keys()]) {
      if (live.has(k)) continue;
      timersOf.current.get(k)?.forEach((t) => window.clearTimeout(t));
      timersOf.current.delete(k);
      frames.current.delete(k);
    }
  }, [copies]);

  /* and all of them when the card goes */
  useEffect(
    () => () => timersOf.current.forEach((ts) => ts.forEach((t) => window.clearTimeout(t))),
    [],
  );

  return (
    <div
      ref={box}
      className="chain-loop"
      aria-hidden="true"
      style={{
        position: "relative",
        width: "100%",
        overflow: "hidden",
        background: ground,
        aspectRatio: `${CROP_W} / ${CROP_H}`,
      }}
    >
      {copies.map((c) => (
        <iframe
          key={c.key}
          ref={(el) => {
            if (el) frames.current.set(c.key, el);
          }}
          src={SRC}
          title="Option chain to order ticket"
          tabIndex={-1}
          loading="eager"
          onLoad={() => onLoad(c.key)}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: SCREEN_W,
            height: SCREEN_H,
            border: 0,
            transformOrigin: "0 0",
            transform: `scale(${scale}) translate(${-CROP_X}px, ${-CROP_Y}px)`,
            opacity: c.shown && scale ? 1 : 0,
            transition: `opacity ${FADE}ms ease`,
            pointerEvents: "none",
          }}
        />
      ))}
    </div>
  );
}
