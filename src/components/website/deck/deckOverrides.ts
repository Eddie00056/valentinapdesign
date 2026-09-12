/**
 * Hand edits layered over the generated deck (src/data/gustoDeckOverrides.json).
 *
 * Every movable element on a slide gets a key — its first class (or tag)
 * plus its index among same-named elements on that slide, e.g. "gd-media-l:1".
 * An override can move it (dx/dy, canvas px), resize its type (fs, px) and
 * replace its text. Text only applies while the generated text still equals
 * `orig`, so re-running the generator against a new export can never paste an
 * old edit onto different copy.
 */
export type Override = { dx?: number; dy?: number; fs?: number; text?: string; orig?: string };
export type Overrides = Record<string, Record<string, Override>>;

export const MOVABLE = [
  "h2", "p", "li", "img",
  ".gd-step", ".gd-fig-n", ".gd-fig-l", ".gd-own-n", ".gd-own-l",
  ".gd-award-t", ".gd-award-s", ".gd-twocol > span", ".gd-divider > span",
  ".gd-live", ".gd-mark", ".gd-card", ".gd-goal", ".gd-box", ".gd-own-card",
].join(",");

export function keyElements(slide: HTMLElement) {
  const count: Record<string, number> = {};
  slide.querySelectorAll<HTMLElement>(MOVABLE).forEach((el) => {
    if (el.closest(".gd-live") && !el.classList.contains("gd-live")) return;
    const name = el.classList[0] || el.tagName.toLowerCase();
    const i = (count[name] = (count[name] ?? -1) + 1);
    el.dataset.ek = `${name}:${i}`;
    if (el.childElementCount === 0) el.dataset.orig = el.textContent || "";
  });
}

export function applyOne(el: HTMLElement, o: Override | undefined) {
  el.style.translate = o?.dx || o?.dy ? `${o.dx || 0}px ${o.dy || 0}px` : "";
  el.style.fontSize = o?.fs ? `${o.fs}px` : "";
  if (o?.text !== undefined && (el.dataset.orig ?? el.textContent) === o.orig) el.textContent = o.text;
}

export function applyOverrides(stage: HTMLElement, ov: Overrides) {
  stage.querySelectorAll<HTMLElement>(".gd-slide").forEach((slide) => {
    keyElements(slide);
    const mine = ov[slide.dataset.n || ""];
    if (!mine) return;
    for (const [k, o] of Object.entries(mine)) {
      const el = slide.querySelector<HTMLElement>(`[data-ek="${k}"]`);
      if (el) applyOne(el, o);
    }
  });
}
