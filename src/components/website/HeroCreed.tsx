import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * The tail of the hero sentence: " I get shit work done".
 *
 * It phases in as you start scrolling down from the hero, then — a little
 * further down — a line strikes through "shit". Driven by raw scroll
 * distance from the top (the hero is the first screen, so scrollY 0 == hero
 * at rest), which stays predictable through the page's scroll-snap.
 *
 * Reduced motion / no-JS: the finished joke ("I get ~~shit~~ work done") is
 * shown outright (see the <noscript> override in website.astro).
 */
export function HeroCreed() {
  const reduce = useReducedMotion();
  const [y, setY] = useState(0);

  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setY(window.scrollY));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [reduce]);

  const inT = clamp((y - 20) / (320 - 20), 0, 1);
  const strikeT = clamp((y - 360) / (700 - 360), 0, 1);

  if (reduce) {
    return (
      <span className="creed-tail">
        I get{" "}
        <span className="creed-strike">
          shit
          <span className="creed-strike-line" data-static aria-hidden="true" />
        </span>{" "}
        work done
      </span>
    );
  }

  return (
    <span className="creed-tail" style={{ opacity: inT }}>
      I get{" "}
      <span className="creed-strike">
        shit
        <span
          className="creed-strike-line"
          aria-hidden="true"
          style={{ transform: `scaleX(${strikeT})` }}
        />
      </span>{" "}
      work done
    </span>
  );
}
