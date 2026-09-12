/**
 * ?edit mode for the GUSTO deck — dev server only (the import is behind
 * `import.meta.env.DEV`, so none of this ships).
 *
 *   click          select an element (Alt-click: its container)
 *   drag           move it; snaps to the slide's centre line
 *   arrows         nudge 1px   (Shift: 10px)
 *   [  ]           type size −1 / +1px
 *   double-click   retype text (Enter to keep, Esc to cancel, Shift+Enter new line)
 *   Delete         reset the selected element
 *   ⌘Z             undo       ⌘S  save
 *
 * Changes are stored per slide and element key in gustoDeckOverrides.json,
 * which the generator never touches. See applyOverrides in GustoDeck.astro.
 */
import type { Overrides, Override } from "./deckOverrides";
import { MOVABLE, applyOne } from "./deckOverrides";

const W = 1920;
const H = 1080;
const SNAP = 8;

export function startEdit(stage: HTMLElement, initial: Overrides) {
  let ov: Overrides = structuredClone(initial);
  let saved = JSON.stringify(ov);
  const history: string[] = [];
  let sel: HTMLElement | null = null;
  let editing: HTMLElement | null = null;

  stage.classList.add("gd-edit");
  const canvas = stage.querySelector<HTMLElement>(".gd-canvas")!;
  const current = () => stage.querySelector<HTMLElement>(".gd-slide:not([hidden]):not(.is-near)");
  const slideOf = (el: HTMLElement) => el.closest<HTMLElement>(".gd-slide")!.dataset.n!;
  const scale = () => canvas.getBoundingClientRect().width / W;

  /* ---- chrome ------------------------------------------------------ */
  const css = document.createElement("style");
  css.textContent = `
    .gd-edit .gd-slide [data-ek] { cursor: default; }
    .gd-edit .gd-slide [data-ek]:hover { outline: 1px dashed rgba(10,132,255,.7); outline-offset: 1px; }
    .gd-edit .gd-live::after { content: ""; position: absolute; inset: 0; z-index: 5; }
    .gd-edit .gd-sel { outline: 2px solid #0a84ff !important; outline-offset: 2px; }
    .gd-edit [contenteditable] { outline: 2px solid #ff9f0a !important; cursor: text; }
    .gd-guide { position: absolute; top: 0; bottom: 0; left: 960px; width: 0;
      border-left: 1px solid #ff2d55; z-index: 50; pointer-events: none; display: none; }
    .gd-guide.is-h { left: 0; right: 0; top: 540px; bottom: auto; height: 0; width: auto;
      border-left: 0; border-top: 1px solid #ff2d55; }
    .gd-editbar { position: fixed; z-index: 2000; left: 50%; top: 14px; transform: translateX(-50%);
      display: flex; align-items: center; gap: 10px; padding: 7px 8px 7px 14px; border-radius: 12px;
      font: 500 12.5px/1 -apple-system, system-ui, sans-serif; color: #f2f2f2;
      background: rgba(22,22,24,.92); box-shadow: 0 8px 30px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,.08);
      backdrop-filter: blur(12px); white-space: nowrap; }
    .gd-editbar b { color: #0a84ff; font-weight: 600; }
    .gd-editbar .k { color: #9a9aa0; font-variant-numeric: tabular-nums; }
    .gd-editbar button { font: inherit; color: #f2f2f2; background: rgba(255,255,255,.1); border: 0;
      border-radius: 8px; padding: 6px 10px; cursor: pointer; }
    .gd-editbar button:hover { background: rgba(255,255,255,.18); }
    .gd-editbar button.save { background: #0a84ff; }
    .gd-editbar button:disabled { opacity: .4; cursor: default; }
    .gd-editbar .help { color: #7c7c82; font-weight: 400; }
  `;
  document.head.appendChild(css);

  const guideV = document.createElement("div");
  guideV.className = "gd-guide";
  const guideH = document.createElement("div");
  guideH.className = "gd-guide is-h";
  canvas.append(guideV, guideH);

  const bar = document.createElement("div");
  bar.className = "gd-editbar";
  bar.innerHTML = `<b>Edit</b><span class="k" data-r="where"></span><span class="k" data-r="sel"></span>
    <button data-a="undo">Undo</button><button data-a="reset">Reset slide</button>
    <button data-a="save" class="save">Save</button>
    <span class="help">dbl-click text · drag / arrows · [ ] size · ⌘S</span>`;
  document.body.appendChild(bar);
  const r = (k: string) => bar.querySelector<HTMLElement>(`[data-r="${k}"]`)!;
  const btn = (a: string) => bar.querySelector<HTMLButtonElement>(`[data-a="${a}"]`)!;

  const refresh = () => {
    const s = current();
    const dirty = JSON.stringify(ov) !== saved;
    r("where").textContent = s ? `slide ${s.dataset.n}` : "";
    const o = sel ? get(sel) : undefined;
    r("sel").textContent = sel
      ? `${sel.dataset.ek}` +
        (o?.dx || o?.dy ? ` · ${Math.round(o.dx || 0)}, ${Math.round(o.dy || 0)}` : "") +
        (o?.fs ? ` · ${o.fs}px` : "")
      : "";
    btn("save").disabled = !dirty;
    btn("save").textContent = dirty ? "Save" : "Saved";
    btn("undo").disabled = !history.length;
  };

  /* ---- model ------------------------------------------------------- */
  const get = (el: HTMLElement): Override | undefined => ov[slideOf(el)]?.[el.dataset.ek!];
  const snapshot = () => {
    history.push(JSON.stringify(ov));
    if (history.length > 200) history.shift();
  };
  const set = (el: HTMLElement, patch: Partial<Override>) => {
    const n = slideOf(el);
    const k = el.dataset.ek!;
    const next = { ...(ov[n]?.[k] || {}), ...patch } as Override;
    for (const key of Object.keys(next) as (keyof Override)[]) {
      if (next[key] === undefined || next[key] === 0) delete next[key];
    }
    if (next.text !== undefined && next.text === next.orig) {
      delete next.text;
      delete next.orig;
    }
    ov[n] = { ...(ov[n] || {}) };
    if (Object.keys(next).filter((x) => x !== "orig").length) ov[n][k] = next;
    else delete ov[n][k];
    if (!Object.keys(ov[n]).length) delete ov[n];
    applyOne(el, ov[n]?.[k]);
    refresh();
  };
  const reapplyAll = () => {
    stage.querySelectorAll<HTMLElement>("[data-ek]").forEach((el) => applyOne(el, get(el)));
  };

  const select = (el: HTMLElement | null) => {
    sel?.classList.remove("gd-sel");
    sel = el;
    sel?.classList.add("gd-sel");
    refresh();
  };

  /* ---- pointer ----------------------------------------------------- */
  let drag: { el: HTMLElement; x: number; y: number; dx: number; dy: number; moved: boolean; base: DOMRect } | null = null;

  stage.addEventListener(
    "pointerdown",
    (e) => {
      if (editing && e.target instanceof Node && editing.contains(e.target)) return;
      const s = current();
      const t = e.target as HTMLElement;
      if (!s || !s.contains(t) || bar.contains(t)) return;
      let el = t.closest<HTMLElement>("[data-ek]");
      if (el && e.altKey) el = el.parentElement?.closest<HTMLElement>("[data-ek]") || el;
      if (!el) {
        select(null);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      commitText();
      select(el);
      const o = get(el) || {};
      drag = { el, x: e.clientX, y: e.clientY, dx: o.dx || 0, dy: o.dy || 0, moved: false, base: el.getBoundingClientRect() };
    },
    true,
  );
  stage.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const k = scale();
    let ddx = (e.clientX - drag.x) / k;
    let ddy = (e.clientY - drag.y) / k;
    if (!drag.moved && Math.hypot(ddx, ddy) < 3) return;
    if (!drag.moved) {
      snapshot();
      /* capture only once it is really a drag — capturing on press would
         retarget the click/dblclick that follows to the stage */
      stage.setPointerCapture(e.pointerId);
    }
    drag.moved = true;
    // snap the element's centre to the slide's centre lines
    const c = canvas.getBoundingClientRect();
    const cx = (drag.base.left + drag.base.width / 2 - c.left) / k + ddx;
    const cy = (drag.base.top + drag.base.height / 2 - c.top) / k + ddy;
    const sx = Math.abs(cx - W / 2) < SNAP && !e.altKey;
    const sy = Math.abs(cy - H / 2) < SNAP && !e.altKey;
    if (sx) ddx += W / 2 - cx;
    if (sy) ddy += H / 2 - cy;
    guideV.style.display = sx ? "block" : "none";
    guideH.style.display = sy ? "block" : "none";
    set(drag.el, { dx: Math.round(drag.dx + ddx), dy: Math.round(drag.dy + ddy) });
  });
  const endDrag = () => {
    drag = null;
    guideV.style.display = guideH.style.display = "none";
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  /* ---- text -------------------------------------------------------- */
  const isText = (el: HTMLElement) =>
    Array.from(el.childNodes).every((c) => c.nodeType === Node.TEXT_NODE || (c as HTMLElement).tagName === "BR") &&
    !!el.textContent?.trim();
  let before = "";
  const commitText = (cancel = false) => {
    if (!editing) return;
    const el = editing;
    editing = null;
    el.removeAttribute("contenteditable");
    const text = (el.innerText || "").replace(/\n$/, "");
    if (cancel || text === before) {
      el.textContent = before;
      return;
    }
    snapshot();
    const o = get(el);
    set(el, { orig: o?.orig ?? el.dataset.orig ?? before, text });
  };
  stage.addEventListener(
    "dblclick",
    (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-ek]") || sel;
      if (!el || !isText(el) || !current()?.contains(el)) return;
      e.preventDefault();
      e.stopPropagation();
      select(el);
      before = el.textContent || "";
      editing = el;
      el.setAttribute("contenteditable", "plaintext-only");
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      const s = getSelection()!;
      s.removeAllRanges();
      s.addRange(range);
    },
    true,
  );

  /* ---- keys -------------------------------------------------------- */
  window.addEventListener(
    "keydown",
    (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        commitText();
        save();
        return;
      }
      if (editing) {
        if (e.key === "Escape") {
          e.preventDefault();
          commitText(true);
        } else if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          commitText();
        }
        e.stopPropagation(); // typing never drives the deck
        return;
      }
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if (!sel) return;
      const step = e.shiftKey ? 10 : 1;
      const o = get(sel) || {};
      const nudge = (x: number, y: number) => {
        snapshot();
        set(sel!, { dx: (o.dx || 0) + x, dy: (o.dy || 0) + y });
      };
      const handled = (() => {
        switch (e.key) {
          case "ArrowLeft": return nudge(-step, 0), true;
          case "ArrowRight": return nudge(step, 0), true;
          case "ArrowUp": return nudge(0, -step), true;
          case "ArrowDown": return nudge(0, step), true;
          case "[":
          case "]": {
            snapshot();
            const cur = o.fs || Math.round(parseFloat(getComputedStyle(sel).fontSize));
            set(sel, { fs: cur + (e.key === "]" ? 1 : -1) });
            return true;
          }
          case "Delete":
          case "Backspace": {
            snapshot();
            const n = slideOf(sel);
            if (o.text !== undefined && o.orig !== undefined) sel.textContent = o.orig;
            if (ov[n]) delete ov[n][sel.dataset.ek!];
            if (ov[n] && !Object.keys(ov[n]).length) delete ov[n];
            applyOne(sel, undefined);
            refresh();
            return true;
          }
          case "Escape": return select(null), true;
        }
        return false;
      })();
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true,
  );

  /* ---- actions ----------------------------------------------------- */
  const undo = () => {
    const prev = history.pop();
    if (prev === undefined) return;
    // put back the text of anything whose text override is going away
    stage.querySelectorAll<HTMLElement>("[data-ek]").forEach((el) => {
      const o = get(el);
      if (o?.orig !== undefined) el.textContent = o.orig;
    });
    ov = JSON.parse(prev);
    reapplyAll();
    refresh();
  };
  const resetSlide = () => {
    const s = current();
    if (!s || !ov[s.dataset.n!]) return;
    snapshot();
    s.querySelectorAll<HTMLElement>("[data-ek]").forEach((el) => {
      const o = get(el);
      if (o?.orig !== undefined) el.textContent = o.orig;
      applyOne(el, undefined);
    });
    delete ov[s.dataset.n!];
    refresh();
  };
  const save = async () => {
    const body = JSON.stringify(ov);
    if (body === saved) return;
    btn("save").textContent = "Saving…";
    const res = await fetch("/__deck/overrides", { method: "POST", body });
    if (res.ok) {
      saved = body;
      refresh();
    } else {
      btn("save").textContent = "Save failed";
    }
  };
  bar.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>("button")?.dataset.a;
    if (a === "undo") undo();
    if (a === "reset") resetSlide();
    if (a === "save") save();
  });
  window.addEventListener("beforeunload", (e) => {
    if (JSON.stringify(ov) !== saved) e.preventDefault();
  });
  // keep "slide N" current as the deck moves
  new MutationObserver(() => {
    if (sel && !current()?.contains(sel)) select(null);
    refresh();
  }).observe(stage.querySelector(".gd-canvas")!, { subtree: true, attributes: true, attributeFilter: ["hidden"] });
  refresh();
}
