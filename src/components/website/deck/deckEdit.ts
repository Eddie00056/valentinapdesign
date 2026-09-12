/**
 * ?edit mode for the GUSTO deck — dev server only (the import is behind
 * `import.meta.env.DEV`, so none of this ships). Works like Keynote/Figma:
 *
 *   click          select the whole box — text box, list, card, image, prototype
 *   drag           move it (hold anywhere inside); snaps to the slide's centre lines
 *   double-click   edit the line of text under the pointer
 *                  (Enter keeps · Esc cancels · Shift+Enter new line · click away keeps)
 *   arrows         nudge 1px (Shift 10px)       [ ]  type size −1 / +1px
 *   Backspace/⌘Z   undo the last change          ⌘S save
 *   Esc            cancel (a text edit, a drag in progress) · otherwise deselect
 *   Alt-click      select the smaller box inside (e.g. one line of a card)
 *
 * Saves to gustoDeckOverrides.json. See deckOverrides.ts.
 */
import type { Overrides, Override } from "./deckOverrides";
import { applyBox, applyText, isLeafText } from "./deckOverrides";

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
    .gd-edit .gd-slide * { cursor: default; }
    .gd-edit .gd-slide [contenteditable] { cursor: text; outline: none; caret-color: #0a84ff; }
    .gd-edit .gd-live::after { content: ""; position: absolute; inset: 0; z-index: 5; }
    .gd-frame-ui { position: absolute; z-index: 60; pointer-events: none; box-sizing: border-box; display: none; }
    .gd-frame-ui.hover { border: 1.5px solid rgba(10,132,255,.55); }
    .gd-frame-ui.sel { border: 2px solid #0a84ff; }
    .gd-frame-ui.sel i { position: absolute; width: 11px; height: 11px; background: #fff;
      border: 2px solid #0a84ff; box-sizing: border-box; border-radius: 2px; }
    .gd-frame-ui.sel i:nth-child(1) { left: -6px; top: -6px; }
    .gd-frame-ui.sel i:nth-child(2) { right: -6px; top: -6px; }
    .gd-frame-ui.sel i:nth-child(3) { left: -6px; bottom: -6px; }
    .gd-frame-ui.sel i:nth-child(4) { right: -6px; bottom: -6px; }
    .gd-frame-ui.text { border: 2px solid #0a84ff; background: rgba(10,132,255,.06); }
    .gd-frame-ui.text i { display: none; }
    .gd-guide { position: absolute; z-index: 61; pointer-events: none; display: none; }
    .gd-guide.v { top: 0; bottom: 0; left: 960px; border-left: 1px solid #ff2d55; }
    .gd-guide.h { left: 0; right: 0; top: 540px; border-top: 1px solid #ff2d55; }
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

  const mk = (cls: string, handles = false) => {
    const d = document.createElement("div");
    d.className = cls;
    if (handles) d.innerHTML = "<i></i><i></i><i></i><i></i>";
    canvas.appendChild(d);
    return d;
  };
  const hoverUI = mk("gd-frame-ui hover");
  const selUI = mk("gd-frame-ui sel", true);
  const guideV = mk("gd-guide v");
  const guideH = mk("gd-guide h");

  const place = (ui: HTMLElement, el: HTMLElement | null) => {
    if (!el) {
      ui.style.display = "none";
      return;
    }
    const k = scale();
    const c = canvas.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const pad = 4;
    ui.style.display = "block";
    ui.style.left = `${(r.left - c.left) / k - pad}px`;
    ui.style.top = `${(r.top - c.top) / k - pad}px`;
    ui.style.width = `${r.width / k + pad * 2}px`;
    ui.style.height = `${r.height / k + pad * 2}px`;
  };

  const bar = document.createElement("div");
  bar.className = "gd-editbar";
  bar.innerHTML = `<b>Edit</b><span class="k" data-r="where"></span><span class="k" data-r="sel"></span>
    <button data-a="undo">Undo</button><button data-a="resetbox">Reset box</button><button data-a="reset">Reset slide</button>
    <button data-a="save" class="save">Save</button>
    <span class="help">click select · drag move · double-click edit · ⌫ undo · Esc cancel · [ ] size · ⌘S</span>`;
  document.body.appendChild(bar);
  const r = (k: string) => bar.querySelector<HTMLElement>(`[data-r="${k}"]`)!;
  const btn = (a: string) => bar.querySelector<HTMLButtonElement>(`[data-a="${a}"]`)!;

  /* ---- model ------------------------------------------------------- */
  const keyOf = (el: HTMLElement) => el.dataset.bk!;
  const get = (el: HTMLElement, k = keyOf(el)): Override | undefined => ov[slideOf(el)]?.[k];

  const refresh = () => {
    const s = current();
    const dirty = JSON.stringify(ov) !== saved;
    r("where").textContent = s ? `slide ${s.dataset.n}` : "";
    const o = sel ? get(sel) : undefined;
    r("sel").textContent = sel
      ? keyOf(sel).split(":")[0].replace(/^gd-/, "") +
        (o?.dx || o?.dy ? ` · x ${o.dx || 0} y ${o.dy || 0}` : "") +
        (o?.fsd ? ` · type ${o.fsd > 0 ? "+" : ""}${o.fsd}px` : "")
      : "";
    btn("save").disabled = !dirty;
    btn("save").textContent = dirty ? "Save" : "Saved";
    btn("undo").disabled = !history.length;
    btn("resetbox").disabled = !sel;
    place(selUI, editing || sel);
    selUI.classList.toggle("text", !!editing);
  };

  const snapshot = () => {
    history.push(JSON.stringify(ov));
    if (history.length > 200) history.shift();
  };
  const write = (el: HTMLElement, k: string, patch: Partial<Override>) => {
    const n = slideOf(el);
    const next: Override = { ...(ov[n]?.[k] || {}), ...patch };
    (Object.keys(next) as (keyof Override)[]).forEach((x) => {
      if (next[x] === undefined || next[x] === 0) delete next[x];
    });
    if (next.text !== undefined && next.text === next.orig) {
      delete next.text;
      delete next.orig;
    }
    ov[n] = { ...(ov[n] || {}) };
    if (Object.keys(next).some((x) => x !== "orig")) ov[n][k] = next;
    else delete ov[n][k];
    if (!Object.keys(ov[n]).length) delete ov[n];
    return ov[n]?.[k];
  };
  const setBox = (el: HTMLElement, patch: Partial<Override>) => {
    applyBox(el, write(el, keyOf(el), patch));
    refresh();
  };
  const reapplyAll = () => {
    stage.querySelectorAll<HTMLElement>("[data-tk]").forEach((el) => applyText(el, get(el, el.dataset.tk!)));
    stage.querySelectorAll<HTMLElement>("[data-bk]").forEach((el) => applyBox(el, get(el)));
  };

  const select = (el: HTMLElement | null) => {
    sel = el;
    refresh();
  };

  /* which box a click means: the outermost one under the pointer
     (Alt: the innermost) — a click on a card's line selects the card */
  const boxAt = (t: HTMLElement, inner: boolean) => {
    const slide = current();
    if (!slide || !slide.contains(t)) return null;
    let found: HTMLElement | null = null;
    for (let e: HTMLElement | null = t; e && e !== slide; e = e.parentElement) {
      if (e.dataset.bk) {
        found = e;
        if (inner) break;
      }
    }
    return found;
  };

  /* ---- pointer ----------------------------------------------------- */
  let drag: { el: HTMLElement; x: number; y: number; dx: number; dy: number; moved: boolean; base: DOMRect } | null = null;

  stage.addEventListener(
    "pointerdown",
    (e) => {
      const t = e.target as HTMLElement;
      if (bar.contains(t)) return;
      if (editing && editing.contains(t)) return; // placing the caret
      const box = boxAt(t, e.altKey);
      if (!current()?.contains(t)) return;
      e.preventDefault();
      e.stopPropagation();
      commitText();
      select(box);
      if (!box) return;
      const o = get(box) || {};
      drag = { el: box, x: e.clientX, y: e.clientY, dx: o.dx || 0, dy: o.dy || 0, moved: false, base: box.getBoundingClientRect() };
    },
    true,
  );
  stage.addEventListener("pointermove", (e) => {
    if (!drag) {
      if (!editing) {
        const t = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        const b = t ? boxAt(t, e.altKey) : null;
        place(hoverUI, b && b !== sel ? b : null);
      }
      return;
    }
    const k = scale();
    let ddx = (e.clientX - drag.x) / k;
    let ddy = (e.clientY - drag.y) / k;
    if (!drag.moved && Math.hypot(ddx, ddy) < 3) return;
    if (!drag.moved) {
      snapshot();
      // capture only once it is really a drag, so a double-click still lands on the text
      stage.setPointerCapture(e.pointerId);
      hoverUI.style.display = "none";
    }
    drag.moved = true;
    const c = canvas.getBoundingClientRect();
    const cx = (drag.base.left + drag.base.width / 2 - c.left) / k + ddx;
    const cy = (drag.base.top + drag.base.height / 2 - c.top) / k + ddy;
    const sx = !e.altKey && Math.abs(cx - W / 2) < SNAP;
    const sy = !e.altKey && Math.abs(cy - H / 2) < SNAP;
    if (sx) ddx += W / 2 - cx;
    if (sy) ddy += H / 2 - cy;
    guideV.style.display = sx ? "block" : "none";
    guideH.style.display = sy ? "block" : "none";
    setBox(drag.el, { dx: Math.round(drag.dx + ddx), dy: Math.round(drag.dy + ddy) });
  });
  const endDrag = () => {
    drag = null;
    guideV.style.display = guideH.style.display = "none";
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  stage.addEventListener("pointerleave", () => (hoverUI.style.display = "none"));

  /* ---- text -------------------------------------------------------- */
  let before = "";
  const commitText = (cancel = false) => {
    if (!editing) return;
    const el = editing;
    editing = null;
    el.removeAttribute("contenteditable");
    getSelection()?.removeAllRanges();
    const text = (el.innerText || "").replace(/\n$/, "");
    if (cancel || text === before) {
      el.textContent = before;
    } else {
      snapshot();
      applyText(el, write(el, el.dataset.tk!, { orig: el.dataset.orig, text }));
    }
    refresh();
  };
  stage.addEventListener(
    "dblclick",
    (e) => {
      const hit = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (!hit || !current()?.contains(hit)) return;
      // the line of text under the pointer; failing that, the box's only line
      let leaf = hit.closest<HTMLElement>("[data-tk]");
      const box = sel || boxAt(hit, false);
      if (!leaf && box) {
        const lines = [box, ...box.querySelectorAll<HTMLElement>("[data-tk]")].filter((x) => x.dataset.tk);
        if (lines.length === 1) leaf = lines[0];
      }
      if (!leaf || !isLeafText(leaf) || (box && !box.contains(leaf))) return;
      e.preventDefault();
      e.stopPropagation();
      before = leaf.textContent || "";
      editing = leaf;
      leaf.setAttribute("contenteditable", "plaintext-only");
      leaf.focus();
      // caret where you clicked, like any text editor
      const range = (document as any).caretRangeFromPoint?.(e.clientX, e.clientY) as Range | null;
      const s = getSelection()!;
      s.removeAllRanges();
      if (range && leaf.contains(range.startContainer)) s.addRange(range);
      else {
        const all = document.createRange();
        all.selectNodeContents(leaf);
        s.addRange(all);
      }
      hoverUI.style.display = "none";
      refresh();
    },
    true,
  );
  // typing reflows the line; keep the frame hugging it
  stage.addEventListener("input", () => editing && refresh(), true);

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
      if ((mod && e.key.toLowerCase() === "z") || e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        e.stopPropagation();
        undo();
        return;
      }
      if (e.key === "Escape" && drag?.moved) {
        e.preventDefault();
        e.stopPropagation();
        const d = drag;
        endDrag();
        undo(); // back to where the drag started
        select(d.el);
        return;
      }
      if (!sel) return;
      const box = sel;
      const step = e.shiftKey ? 10 : 1;
      const o = get(box) || {};
      let handled = true;
      switch (e.key) {
        case "ArrowLeft": snapshot(); setBox(box, { dx: (o.dx || 0) - step }); break;
        case "ArrowRight": snapshot(); setBox(box, { dx: (o.dx || 0) + step }); break;
        case "ArrowUp": snapshot(); setBox(box, { dy: (o.dy || 0) - step }); break;
        case "ArrowDown": snapshot(); setBox(box, { dy: (o.dy || 0) + step }); break;
        case "[": snapshot(); setBox(box, { fsd: (o.fsd || 0) - 1 }); break;
        case "]": snapshot(); setBox(box, { fsd: (o.fsd || 0) + 1 }); break;
        case "Escape": select(null); break;
        default: handled = false;
      }
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
    ov = JSON.parse(prev);
    reapplyAll();
    refresh();
  };
  const resetBox = () => {
    if (!sel) return;
    const n = slideOf(sel);
    if (!ov[n]) return;
    snapshot();
    [sel, ...sel.querySelectorAll<HTMLElement>("[data-tk]")].forEach((x) => {
      if (x.dataset.tk) delete ov[n][x.dataset.tk];
    });
    delete ov[n][keyOf(sel)];
    if (!Object.keys(ov[n]).length) delete ov[n];
    reapplyAll();
    refresh();
  };
  const resetSlide = () => {
    const s = current();
    if (!s || !ov[s.dataset.n!]) return;
    snapshot();
    delete ov[s.dataset.n!];
    reapplyAll();
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
    if (a === "resetbox") resetBox();
    if (a === "save") save();
  });
  window.addEventListener("beforeunload", (e) => {
    if (JSON.stringify(ov) !== saved) e.preventDefault();
  });
  window.addEventListener("resize", () => refresh());
  new MutationObserver(() => {
    if (sel && !current()?.contains(sel)) select(null);
    hoverUI.style.display = "none";
    refresh();
  }).observe(canvas, { subtree: true, attributes: true, attributeFilter: ["hidden"] });
  refresh();
}
