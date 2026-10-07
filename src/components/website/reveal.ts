import { animate, inView, stagger } from "motion";

/**
 * Section reveals for the /website pages — the hero's word reveal, scaled up
 * to whole sections: as a `[data-reveal]` group scrolls in, its `[data-r]`
 * parts (or the group itself, if it marks none) rise out of a soft blur, one
 * after another.
 *
 * The parts are hidden before first paint by `html.reveal-on` (set inline in
 * Website.astro, only without reduced motion, and taken back if this never
 * runs), so nothing flashes in finished and then disappears.
 */
export function initReveal() {
  (window as unknown as { __revealReady: boolean }).__revealReady = true;
  if (!document.documentElement.classList.contains("reveal-on")) return;

  document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((group) => {
    inView(
      group,
      () => {
        const parts = [...group.querySelectorAll<HTMLElement>("[data-r]")];
        const els = parts.length ? parts : [group];
        animate(
          els,
          {
            opacity: [0, 1],
            filter: ["blur(8px)", "blur(0px)"],
            transform: ["translateY(28px)", "translateY(0px)"],
          },
          { duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: stagger(0.09) },
        ).then(() => {
          /* hand the elements back clean: a leftover transform would make
             each one a containing block for anything fixed inside it */
          group.dataset.revealed = "";
          for (const el of els) {
            el.style.opacity = "";
            el.style.filter = "";
            el.style.transform = "";
          }
        });
      },
      /* when the group's top is 15% up from the bottom of the window — a
         fraction of a 100svh row would wait too long */
      { margin: "0px 0px -15% 0px" },
    );
  });
}
