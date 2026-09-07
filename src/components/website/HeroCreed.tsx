import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * The tail of the hero sentence: " I get shit work done".
 *
 * The hero is pinned (`.hero-pin` spacer + `.hero-sticky`) so the view holds
 * still while a stretch of scroll drives this reveal. Progress is how far the
 * pin container has scrolled through its own travel:
 *   - 0 → 0.4  : "I get shit work done" fades in
 *   - 0.5 → 0.9: a line strikes through "shit"
 *   - then the pin releases and normal scrolling continues to the projects.
 *
 * Reduced motion / no-JS: the finished joke is shown outright (see the
 * <noscript> override + reduced-motion CSS in website.astro).
 */
export function HeroCreed() {
  const reduce = useReducedMotion();
  const [p, setP] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const pin = document.querySelector<HTMLElement>(".hero-pin");
    if (!pin) return;

    const sticky = pin.querySelector<HTMLElement>(".hero-sticky");
    let raf = 0;
    const measure = () => {
      raf = 0;
      const r = pin.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      const next = travel > 0 ? clamp(-r.top / travel, 0, 1) : 0;
      setP(next);
      // hand the view off: once the strike is done, ease the hero out so
      // it isn't a full-opacity block that then scrolls away
      if (sticky) {
        const exit = clamp((next - 0.9) / 0.1, 0, 1);
        sticky.style.opacity = exit ? String(1 - exit) : "";
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
      if (sticky) sticky.style.opacity = "";
    };
  }, [reduce]);

  // hold scroll-snap off while the pin is mid-reveal so a nearby snap
  // target can't yank the page before the strike finishes
  useEffect(() => {
    const active = !reduce && p > 0.002 && p < 0.995;
    document.documentElement.classList.toggle("snap-hold", active);
    return () => document.documentElement.classList.remove("snap-hold");
  }, [p, reduce]);

  const inT = clamp(p / 0.4, 0, 1);
  const strikeT = clamp((p - 0.5) / 0.4, 0, 1);

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
