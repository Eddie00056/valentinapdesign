import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Props = {
  /** a gallery page, e.g. "/work/options-strategy-builder?bare&auto" */
  src: string;
  /** the element inside the page to fit to the column */
  fit: string;
  /** extra CSS for the page (the deck's per-slide dressing) */
  css?: string;
  /** the page's viewport */
  vw?: number;
  vh?: number;
  /** room kept round the fitted box, page px — a 0.5px stroke at the
      edge is lost without it */
  pad?: number;
  /** stop the page's live price walk (the deck's `freeze`) */
  freeze?: boolean;
  /** fit to the column's HEIGHT instead of its width (the column then
      takes the element's width) — for pieces that must share a baseline */
  byHeight?: boolean;
  /** a named touch-up run on the page before it's measured (see RETOUCH) */
  retouch?: keyof typeof RETOUCH;
  title: string;
};

/* the page goes see-through so whatever the column sits on shows behind */
/* (html[data-embed] is the gallery's own "I'm framed" re-grounding, which
   would otherwise paint #141414 behind the piece) */
const GROUND = `html, body, html.is-bare, html.is-bare body, html[data-embed], html[data-embed] body { background: transparent !important; }
.cmt-fab, .cmt-root, .oc-back, astro-dev-toolbar { display: none !important; }`;

const RETOUCH = {
  /* The order flow re-dressed in PhoneFrame's iPhone (iphone17pro.png, the
     advanced-platform mockup) so the two phones match. That render is drawn
     406 wide with a 386-wide screen at (10, 8), 8px bezel below, corner 58;
     it is scaled so its screen is the flow's 402 wide, and the flow's screen
     takes the opening's height and corner — its bottom-anchored controls
     ride up with it. */
  flowToPhoneFrame(d: Document) {
    const frame = d.querySelector<HTMLElement>(".fof-frame");
    const img = frame?.querySelector<HTMLImageElement>("img");
    const screen = frame?.querySelector<HTMLElement>(".fof-screen");
    if (!frame || !img || !screen) return;
    const k = 402 / 386;
    const w = 406 * k;
    const h = (2475 / 1218) * w;
    img.src = "/prototypes/uploads/iphone17pro.png";
    Object.assign(img.style, { width: `${w}px`, height: `${h}px` });
    Object.assign(frame.style, { width: `${w}px`, height: `${h}px` });
    Object.assign(screen.style, {
      left: `${10 * k}px`,
      top: `${8 * k}px`,
      height: `${h - 16 * k}px`,
      borderRadius: `${58 * k}px`,
    });
  },
};

/**
 * A live gallery prototype, fitted to its column, look-only: the page loads
 * in a frame at its own viewport, the `fit` element is measured inside it,
 * and the frame is scaled and shifted so that element fills the column's
 * width. The column's height follows the element as it grows and shrinks.
 */
export function LiveFit({
  src,
  fit,
  css = "",
  vw = 1280,
  vh = 1000,
  pad = 4,
  freeze = false,
  byHeight = false,
  retouch,
  title,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  /* not in the server markup: a frame there loads before onLoad is wired */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setWidth(e.contentRect.width);
      setHeight(e.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onLoad = () => {
    const f = frame.current;
    const d = f?.contentDocument;
    const w = f?.contentWindow as (Window & typeof globalThis & { __pxHub?: { timer: number } }) | null;
    if (!f || !d || !w) return;
    const style = d.createElement("style");
    style.textContent = GROUND + css;
    d.head.append(style);
    /* focusing inside a frame scrolls the page to it — never wanted here */
    w.HTMLElement.prototype.focus = function () {};
    let touched = !retouch;

    let target: Element | null = null;
    const measure = () => {
      if (!target) return;
      const r = target.getBoundingClientRect();
      if (!r.width) return;
      setRect({ x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 });
    };
    /* the widget may hydrate a beat after load */
    const find = (tries = 0) => {
      target = d.querySelector(fit);
      if (!target) {
        if (tries < 50) w.setTimeout(() => find(tries + 1), 100);
        return;
      }
      if (freeze && w.__pxHub) w.clearInterval(w.__pxHub.timer);
      /* touch-ups wait for hydration: React rebuilding the server markup
         would put the original back */
      if (!touched && retouch) {
        if (d.querySelector("astro-island[ssr]")) {
          if (tries < 80) w.setTimeout(() => find(tries + 1), 100);
          return;
        }
        RETOUCH[retouch](d);
        touched = true;
      }
      new w.ResizeObserver(measure).observe(target);
      measure();
    };
    find();
  };

  const scale = !rect ? 0 : byHeight ? (height ? height / rect.h : 0) : width ? width / rect.w : 0;

  return (
    <div
      ref={box}
      className="live-fit"
      aria-hidden="true"
      style={{
        position: "relative",
        ...(byHeight
          ? { height: "100%", width: rect && scale ? rect.w * scale : 0 }
          : {
              width: "100%",
              height: rect && scale ? rect.h * scale : undefined,
              aspectRatio: rect ? undefined : "4 / 3",
            }),
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {mounted && (
        <iframe
          ref={frame}
          src={src}
          title={title}
          tabIndex={-1}
          loading="lazy"
          onLoad={onLoad}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: vw,
            height: vh,
            border: 0,
            background: "transparent",
            colorScheme: "normal",
            transformOrigin: "0 0",
            transform: rect ? `scale(${scale}) translate(${-rect.x}px, ${-rect.y}px)` : "none",
            opacity: scale ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
        />
      )}
    </div>
  );
}
