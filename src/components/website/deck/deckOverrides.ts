/**
 * Hand edits layered over the generated deck (src/data/gustoDeckOverrides.json).
 *
 * Two kinds of thing can be edited:
 *  - a BOX: a whole text box, list, card, image or prototype — it moves (dx/dy,
 *    canvas px) and its type can grow or shrink as one (fsd, px added to every
 *    line inside). Keyed by first class (or tag) + index, e.g. "gd-media-h:0".
 *  - a TEXT: one line of copy inside a box. Keyed "t.<class-or-tag>:<index>".
 *    Its replacement only applies while the generated text still equals
 *    `orig`, so a new deck export can never inherit stale copy.
 */
export type Override = {
  dx?: number;
  dy?: number;
  fsd?: number;
  ta?: "left" | "center" | "right";
  text?: string;
  orig?: string;
  /** on the "_slide" key only: leave this slide out of the show */
  hidden?: boolean;
};
export type Overrides = Record<string, Record<string, Override>>;

/** What a click selects — the outermost of these under the pointer. */
export const BOXES = [
  ".gd-cover", ".gd-titlecard", ".gd-statement-t", ".gd-kicker", ".gd-corner",
  ".gd-media-h", ".gd-media-l", ".gd-media-big", ".gd-numbered ol", ".gd-journey-row",
  ".gd-card", ".gd-goal", ".gd-fig", ".gd-award", ".gd-fig-note", ".gd-role-col",
  ".gd-cl-col", ".gd-twocol > span", ".gd-divider > span", ".gd-metrics-t", ".gd-own",
  "img", ".gd-live", ".gd-mark", ".gd-box",
].join(",");

const TEXTS = "h2, p, li, span";

const nameOf = (el: HTMLElement) => el.classList[0] || el.tagName.toLowerCase();
export const isLeafText = (el: HTMLElement) =>
  el.matches(TEXTS) && el.childElementCount === 0 && !!el.textContent?.trim();

export function keyElements(slide: HTMLElement) {
  const boxes: Record<string, number> = {};
  const texts: Record<string, number> = {};
  slide.querySelectorAll<HTMLElement>(`${BOXES}, ${TEXTS}`).forEach((el) => {
    if (el.closest(".gd-live") && !el.classList.contains("gd-live")) return;
    if (el.matches(BOXES)) {
      const n = nameOf(el);
      el.dataset.bk = `${n}:${(boxes[n] = (boxes[n] ?? -1) + 1)}`;
    }
    if (isLeafText(el)) {
      const n = nameOf(el);
      el.dataset.tk = `t.${n}:${(texts[n] = (texts[n] ?? -1) + 1)}`;
      el.dataset.orig = el.textContent || "";
    }
  });
}

const leaves = (box: HTMLElement) =>
  [box, ...box.querySelectorAll<HTMLElement>("[data-tk]")].filter((e) => e.dataset.tk);

export function applyBox(el: HTMLElement, o: Override | undefined) {
  el.style.translate = o?.dx || o?.dy ? `${o.dx || 0}px ${o.dy || 0}px` : "";
  el.style.textAlign = o?.ta || "";
  for (const leaf of leaves(el)) {
    if (!leaf.dataset.basefs) {
      leaf.style.fontSize = "";
      leaf.dataset.basefs = String(parseFloat(getComputedStyle(leaf).fontSize) || 0);
    }
    const base = parseFloat(leaf.dataset.basefs);
    leaf.style.fontSize = o?.fsd && base ? `${base + o.fsd}px` : "";
  }
}

export function applyText(el: HTMLElement, o: Override | undefined) {
  const orig = el.dataset.orig ?? "";
  el.textContent = o?.text !== undefined && o.orig === orig ? o.text : orig;
}

export function applyOverrides(stage: HTMLElement, ov: Overrides) {
  stage.querySelectorAll<HTMLElement>(".gd-slide").forEach((slide) => {
    keyElements(slide);
    const mine = ov[slide.dataset.n || ""];
    slide.dataset.skip = mine?._slide?.hidden ? "1" : "";
    if (!mine) return;
    for (const [k, o] of Object.entries(mine)) {
      if (k === "_slide") continue;
      if (k.startsWith("t.")) {
        const el = slide.querySelector<HTMLElement>(`[data-tk="${k}"]`);
        if (el) applyText(el, o);
      } else {
        const el = slide.querySelector<HTMLElement>(`[data-bk="${k}"]`);
        if (el) applyBox(el, o);
      }
    }
  });
}
