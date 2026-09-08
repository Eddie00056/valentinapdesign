import { useEffect, useRef } from "react";
import { scroll } from "motion";
import { useReducedMotion } from "motion/react";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * The tail of the hero sentence: " I get shit work done."
 *
 * The hero is pinned (`.hero-pin` spacer + `.hero-sticky`) so the view holds
 * still while a stretch of scroll drives this reveal. Progress comes from
 * Motion's `scroll()` — it uses the browser's native ScrollTimeline where
 * available, so it's hardware-accelerated and stays smooth through slow
 * scrolls. The container edge `76px` (the sticky header height) makes
 * progress 0 at rest and moving on the very first pixel of scroll — no dead
 * zone before the fade begins.
 *
 *   progress 0 → 0.2   : "I get shit work done." fades in
 *   progress 0.32 → 0.5: a line strikes through "shit"
 *   progress 0.5 → 0.84: a long beat, fully struck, everything on screen
 *   progress 0.84 → 1  : the hero eases up and out; the pin releases
 *
 * Reduced motion / no-JS: the finished joke is shown outright (see the
 * <noscript> override + reduced-motion CSS in website.astro).
 */
export function HeroCreed() {
  const reduce = useReducedMotion();
  const tailRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduce) return;
    const pin = document.querySelector<HTMLElement>(".hero-pin");
    if (!pin) return;
    const sticky = pin.querySelector<HTMLElement>(".hero-sticky");
    const html = document.documentElement;

    const stop = scroll(
      (progress: number) => {
        const tail = tailRef.current;
        const line = lineRef.current;
        if (tail) tail.style.opacity = String(clamp(progress / 0.2, 0, 1));
        if (line) {
          const s = clamp((progress - 0.32) / 0.18, 0, 1);
          line.style.transform = `scaleX(${s})`;
        }

        // hand off: ease the hero up and out over the last stretch so the
        // pin doesn't release a full-opacity block into a screen of black
        const exit = clamp((progress - 0.84) / 0.16, 0, 1);
        if (sticky) {
          sticky.style.opacity = exit ? String(1 - exit) : "";
          sticky.style.transform = exit
            ? `translate3d(0, ${(-16 * exit).toFixed(2)}vh, 0)`
            : "";
        }

        html.classList.toggle("snap-hold", progress > 0.004 && progress < 0.985);
        if (progress >= 0.985) html.dataset.pinReleased = String(Date.now());
      },
      { target: pin, offset: ["start 76px", "end start"] },
    );

    return () => {
      stop();
      html.classList.remove("snap-hold");
      if (sticky) {
        sticky.style.opacity = "";
        sticky.style.transform = "";
      }
    };
  }, [reduce]);

  if (reduce) {
    return (
      <span className="creed-tail">
        I get{" "}
        <span className="creed-strike">
          shit
          <span className="creed-strike-line" data-static aria-hidden="true" />
        </span>{" "}
        work done.
      </span>
    );
  }

  return (
    <span className="creed-tail" ref={tailRef} style={{ opacity: 0 }}>
      I get{" "}
      <span className="creed-strike">
        shit
        <span
          className="creed-strike-line"
          aria-hidden="true"
          ref={lineRef}
          style={{ transform: "scaleX(0)" }}
        />
      </span>{" "}
      work done.
    </span>
  );
}
