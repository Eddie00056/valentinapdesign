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
 *   corner handle  drag to resize the selected box (scales from its centre)
 *   ⌥A ⌥H ⌥D       align the box left / centre / right on the slide
 *   ⌥W ⌥V ⌥S       align it top / middle / bottom (edges sit at the deck's 100px margin)
 *   toolbar        also text-align left / centre / right inside the box
 *
 * Saves to gustoDeckOverrides.json. See deckOverrides.ts.
 */
import type { Overrides, Override } from "./deckOverrides";
import { applyBox, applyText, isLeafText } from "./deckOverrides";

const W = 1920;
const H = 1080;
const SNAP = 8;
const EYE = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="2"/></svg>`;
const EYE_OFF = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6.2 3.8A6.6 6.6 0 0 1 8 3.5C12 3.5 14.5 8 14.5 8a11 11 0 0 1-1.8 2.3M9.9 10.1a2 2 0 0 1-2.8-2.8M4.2 4.9C2.5 6 1.5 8 1.5 8S4 12.5 8 12.5c1 0 2-.3 2.8-.7M2 2l12 12"/></svg>`;
const MARGIN = 100; // the deck's own edge margin (corner kickers sit at 5.2% = 100px)

const ico = (d: string) =>
  `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">${d}</svg>`;
const ICONS: Record<string, [string, string]> = {
  "al-left": [ico('<path d="M2 2v12M5 5h8M5 11h5"/>'), "Align left  ⌥A"],
  "al-hcenter": [ico('<path d="M8 2v12M4 5h8M5.5 11h5"/>'), "Align centre  ⌥H"],
  "al-right": [ico('<path d="M14 2v12M3 5h8M6 11h5"/>'), "Align right  ⌥D"],
  "al-top": [ico('<path d="M2 2h12M5 5v8M11 5v5"/>'), "Align top  ⌥W"],
  "al-vcenter": [ico('<path d="M2 8h12M5 4v8M11 5.5v5"/>'), "Align middle  ⌥V"],
  "al-bottom": [ico('<path d="M2 14h12M5 3v8M11 6v5"/>'), "Align bottom  ⌥S"],
  "ta-left": [ico('<path d="M2 4h12M2 8h8M2 12h10"/>'), "Text left"],
  "ta-center": [ico('<path d="M2 4h12M4 8h8M3 12h10"/>'), "Text centre"],
  "ta-right": [ico('<path d="M2 4h12M6 8h8M4 12h10"/>'), "Text right"],
  "fs-down": [`<span style="font:600 11px/16px system-ui;letter-spacing:-.02em">A−</span>`, "Smaller text  ["],
  "fs-up": [`<span style="font:600 14px/16px system-ui;letter-spacing:-.02em">A+</span>`, "Bigger text  ]"],
};

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
    .gd-frame-ui.sel i { pointer-events: auto; cursor: nwse-resize !important; }
    .gd-frame-ui.sel i:nth-child(2), .gd-frame-ui.sel i:nth-child(3) { cursor: nesw-resize !important; }
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
    .gd-editbar .pub:empty { display: none; }
    .gd-editbar .pub { font-weight: 500; }
    .gd-editbar .pub[data-tone="busy"] { color: #ffd60a; }
    .gd-editbar .pub[data-tone="ok"] { color: #30d158; }
    .gd-editbar .pub[data-tone="err"] { color: #ff6b6b; cursor: help; }
    .gd-ask { position: fixed; inset: 0; z-index: 3000; display: grid; place-items: center;
      background: rgba(0,0,0,.35); backdrop-filter: blur(2px); }
    .gd-ask[hidden] { display: none; }
    .gd-ask > div { width: 340px; padding: 20px 20px 16px; border-radius: 14px; background: #1c1c1e;
      color: #f2f2f2; font: 400 13px/1.45 -apple-system, system-ui, sans-serif;
      box-shadow: 0 20px 60px rgba(0,0,0,.5), inset 0 0 0 1px rgba(255,255,255,.08); }
    .gd-ask h3 { margin: 0 0 6px; font-size: 15px; font-weight: 600; }
    .gd-ask p { margin: 0 0 16px; color: #a1a1a6; }
    .gd-ask .row { display: flex; gap: 8px; justify-content: flex-end; }
    .gd-ask button { font: 500 13px/1 -apple-system, system-ui, sans-serif; color: #f2f2f2; border: 0;
      border-radius: 8px; padding: 8px 12px; background: rgba(255,255,255,.1); cursor: pointer; }
    .gd-ask button:hover { background: rgba(255,255,255,.18); }
    .gd-ask button.primary { background: #0a84ff; }
    .gd-ask button.danger { color: #ff6b6b; }
    .gd-editbar button.ico { padding: 5px 7px; display: grid; place-items: center; }
    .gd-editbar button.ico.on { background: rgba(255,69,58,.85); }
    .gd-editbar .grp { display: flex; gap: 2px; padding: 2px; border-radius: 9px; background: rgba(255,255,255,.06); }
    .gd-editbar .grp button { background: none; padding: 5px 6px; display: grid; place-items: center; }
    .gd-editbar .grp button:hover { background: rgba(255,255,255,.14); }
    .gd-editbar .grp button.on { background: rgba(10,132,255,.35); }
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
    <span class="grp" data-g="align">${["al-left", "al-hcenter", "al-right", "al-top", "al-vcenter", "al-bottom"]
      .map((a) => `<button data-a="${a}" title="${ICONS[a][1]}">${ICONS[a][0]}</button>`).join("")}</span>
    <span class="grp" data-g="text">${["ta-left", "ta-center", "ta-right", "fs-down", "fs-up"]
      .map((a) => `<button data-a="${a}" title="${ICONS[a][1]}">${ICONS[a][0]}</button>`).join("")}</span>
    <button data-a="hide" class="ico" title="Hide this slide from the presentation"></button>
    <button data-a="undo">Undo</button><button data-a="resetbox">Reset box</button><button data-a="reset">Reset slide</button>
    <button data-a="save" class="save">Save</button><span class="pub" data-r="pub"></span>
    <span class="help">double-click to edit text</span>`;
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
        (o?.fsd ? ` · type ${o.fsd > 0 ? "+" : ""}${o.fsd}px` : "") +
        (o?.sc ? ` · ${Math.round(o.sc * 100)}%` : "")
      : "";
    btn("save").disabled = !dirty;
    btn("save").textContent = dirty ? "Save & publish" : "Saved";
    btn("undo").disabled = !history.length;
    btn("resetbox").disabled = !sel;
    const hidden = !!(s && ov[s.dataset.n!]?._slide?.hidden);
    btn("hide").classList.toggle("on", hidden);
    btn("hide").innerHTML = hidden ? EYE_OFF : EYE;
    btn("hide").title = hidden ? "Hidden — click to show this slide again" : "Hide this slide from the presentation";
    s?.classList.toggle("is-skipped", hidden);
    bar.querySelectorAll<HTMLButtonElement>(".grp button").forEach((b) => (b.disabled = !sel));
    (["left", "center", "right"] as const).forEach((t) =>
      btn(`ta-${t}`).classList.toggle("on", !!sel && (o?.ta ?? getComputedStyle(sel).textAlign) === t),
    );
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
    stage.querySelectorAll<HTMLElement>(".gd-slide").forEach((sl) => {
      const h = !!ov[sl.dataset.n!]?._slide?.hidden;
      sl.dataset.skip = h ? "1" : "";
      sl.classList.toggle("is-skipped", h);
    });
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
  let resize: { el: HTMLElement; cx: number; cy: number; d0: number; sc: number } | null = null;

  /* corner handles resize: scale follows the pointer's distance from the
     box's centre, relative to where the drag started */
  selUI.addEventListener("pointerdown", (e) => {
    if (!sel || !(e.target as HTMLElement).matches("i")) return;
    e.preventDefault();
    e.stopPropagation();
    const r = sel.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    resize = { el: sel, cx, cy, d0: Math.max(4, Math.hypot(e.clientX - cx, e.clientY - cy)), sc: get(sel)?.sc || 1 };
    snapshot();
    selUI.setPointerCapture(e.pointerId);
  });
  selUI.addEventListener("pointermove", (e) => {
    if (!resize) return;
    const d = Math.hypot(e.clientX - resize.cx, e.clientY - resize.cy);
    const sc = Math.max(0.1, Math.min(20, +(resize.sc * (d / resize.d0)).toFixed(3)));
    setBox(resize.el, { sc: sc === 1 ? undefined : sc });
  });
  const endResize = () => (resize = null);
  selUI.addEventListener("pointerup", endResize);
  selUI.addEventListener("pointercancel", endResize);

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
      if (!ask.hidden) return; // the save/discard dialog has the keyboard
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
      if (!sel) {
        /* nothing selected: the arrows etc. change slide — handled here
           because clicks in edit mode never give the deck keyboard focus */
        const n = parseInt(current()?.dataset.n || "1", 10);
        const to =
          e.key === "ArrowRight" || e.key === "PageDown" || e.key === " " ? n + 1
          : e.key === "ArrowLeft" || e.key === "PageUp" ? n - 1
          : null;
        if (to !== null) {
          e.preventDefault();
          e.stopPropagation();
          (stage as any).__step(to - n);
        }
        return;
      }
      const box = sel;
      const ALT: Record<string, string> = {
        KeyA: "al-left", KeyH: "al-hcenter", KeyD: "al-right",
        KeyW: "al-top", KeyV: "al-vcenter", KeyS: "al-bottom",
      };
      if (e.altKey && !mod && ALT[e.code]) {
        e.preventDefault();
        e.stopPropagation();
        align(ALT[e.code]);
        return;
      }
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
  /* align the selected box to the slide: centre lines, or the deck's margin */
  const align = (how: string) => {
    if (!sel) return;
    const o = get(sel) || {};
    const k = scale();
    const c = canvas.getBoundingClientRect();
    const r = sel.getBoundingClientRect();
    const left = (r.left - c.left) / k - (o.dx || 0);
    const top = (r.top - c.top) / k - (o.dy || 0);
    const w = r.width / k;
    const h = r.height / k;
    const patch: Partial<Override> = {};
    if (how === "al-left") patch.dx = MARGIN - left;
    if (how === "al-hcenter") patch.dx = (W - w) / 2 - left;
    if (how === "al-right") patch.dx = W - MARGIN - w - left;
    if (how === "al-top") patch.dy = MARGIN - top;
    if (how === "al-vcenter") patch.dy = (H - h) / 2 - top;
    if (how === "al-bottom") patch.dy = H - MARGIN - h - top;
    if (how.startsWith("ta-")) patch.ta = how.slice(3) as Override["ta"];
    if (how === "fs-down" || how === "fs-up") patch.fsd = (o.fsd || 0) + (how === "fs-up" ? 1 : -1);
    for (const key of ["dx", "dy"] as const) if (patch[key] !== undefined) patch[key] = Math.round(patch[key]!);
    snapshot();
    setBox(sel, patch);
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
  const staleDialog = () => {
    ask.hidden = false;
    ask.querySelector("h3")!.textContent = "The deck changed since you opened it";
    ask.querySelector<HTMLElement>('[data-r="msg"]')!.textContent =
      "Someone (or another tab) saved edits after this page loaded. Reload to get them, then redo your change — saving from here would put old edits back.";
    const row = ask.querySelector<HTMLElement>(".row")!;
    const prev = row.innerHTML;
    row.innerHTML = `<button data-q="close">Not now</button><button data-q="reload" class="primary">Reload</button>`;
    const done = () => {
      row.innerHTML = prev;
      ask.querySelector("h3")!.textContent = "Save and publish your changes?";
      ask.hidden = true;
    };
    row.querySelector<HTMLButtonElement>('[data-q="reload"]')!.onclick = (e) => {
      e.stopPropagation();
      saved = JSON.stringify(ov); // don't trigger the unsaved-changes prompt on the way out
      location.reload();
    };
    row.querySelector<HTMLButtonElement>('[data-q="close"]')!.onclick = (e) => {
      e.stopPropagation();
      done();
    };
    return false;
  };
  const toggleHidden = () => {
    const s = current();
    if (!s) return;
    const n = s.dataset.n!;
    snapshot();
    ov[n] = { ...(ov[n] || {}) };
    if (ov[n]._slide?.hidden) delete ov[n]._slide;
    else ov[n]._slide = { hidden: true };
    if (!Object.keys(ov[n]).length) delete ov[n];
    s.dataset.skip = ov[n]?._slide?.hidden ? "1" : "";
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
  /* Save writes the overrides file, then publishes it (commit + deploy via
     scripts/ship-deck.sh) in the background — editing can carry on meanwhile. */
  let publishing = false;
  const status = (text: string, tone: "" | "ok" | "busy" | "err" = "") => {
    const el = r("pub");
    el.textContent = text;
    el.dataset.tone = tone;
  };
  const publish = async () => {
    publishing = true;
    status("Publishing…", "busy");
    try {
      const res = await fetch("/__deck/publish", { method: "POST" });
      const out = await res.json().catch(() => ({}));
      if (res.ok) status("Live ✓", "ok");
      else {
        status("Publish failed", "err");
        r("pub").title = out.log || "";
        console.error("[deck publish]", out.log);
      }
    } catch {
      status("Publish failed", "err");
    }
    publishing = false;
  };
  /* The file can change outside this tab — another tab, or a fix made in
     code. Saving would silently put old edits back, so check first. */
  const stale = async () => {
    try {
      const disk = await (await fetch("/__deck/overrides")).json();
      return JSON.stringify(disk) !== saved;
    } catch {
      return false;
    }
  };
  const save = async () => {
    const body = JSON.stringify(ov);
    if (body === saved) return;
    if (await stale()) return void staleDialog();
    btn("save").textContent = "Saving…";
    const res = await fetch("/__deck/overrides", { method: "POST", body });
    if (res.ok) {
      saved = body;
      refresh();
      publish();
    } else {
      btn("save").textContent = "Save failed";
    }
  };
  bar.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>("button")?.dataset.a;
    if (a === "undo") undo();
    if (a === "reset") resetSlide();
    if (a === "resetbox") resetBox();
    if (a === "hide") toggleHidden();
    if (a && /^(al|ta|fs)-/.test(a)) align(a);
    if (a === "save") save();
  });
  window.addEventListener("beforeunload", (e) => {
    if (JSON.stringify(ov) !== saved || publishing) e.preventDefault();
  });
  window.addEventListener("resize", () => refresh());

  /* ---- leaving a slide with unsaved edits -------------------------- */
  const ask = document.createElement("div");
  ask.className = "gd-ask";
  ask.hidden = true;
  ask.innerHTML = `<div role="dialog" aria-modal="true">
      <h3>Save and publish your changes?</h3>
      <p data-r="msg"></p>
      <div class="row">
        <button data-q="stay">Keep editing</button>
        <button data-q="discard" class="danger">Discard</button>
        <button data-q="save" class="primary">Save &amp; publish</button>
      </div></div>`;
  document.body.appendChild(ask);
  let pending: number | null = null;
  const dirty = () => JSON.stringify(ov) !== saved;
  const closeAsk = () => {
    ask.hidden = true;
    pending = null;
  };
  const go = (n: number) => {
    closeAsk();
    (stage as any).__show(n);
  };
  (stage as any).__beforeShow = (n: number) => {
    commitText();
    if (!dirty()) return true;
    pending = n;
    const slide = current()?.dataset.n;
    ask.querySelector<HTMLElement>('[data-r="msg"]')!.textContent =
      `You have unsaved edits on slide ${slide}. Save them before going to slide ${n}?`;
    ask.hidden = false;
    ask.querySelector<HTMLButtonElement>('[data-q="save"]')!.focus();
    return false;
  };
  ask.addEventListener("click", async (e) => {
    const q = (e.target as HTMLElement).closest<HTMLElement>("button")?.dataset.q;
    if (!q && e.target === ask) return closeAsk(); // click outside = keep editing
    const n = pending;
    if (q === "stay" || n === null) return closeAsk();
    if (q === "save") {
      await save();
      if (dirty()) return; // save failed; stay put
    }
    if (q === "discard") {
      ov = JSON.parse(saved);
      history.length = 0;
      reapplyAll();
      select(null);
    }
    go(n);
  });
  // the dialog owns the keyboard while it is open
  window.addEventListener(
    "keydown",
    (e) => {
      if (ask.hidden) return;
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        closeAsk();
      }
    },
    true,
  );
  new MutationObserver(() => {
    if (sel && !current()?.contains(sel)) select(null);
    hoverUI.style.display = "none";
    refresh();
  }).observe(canvas, { subtree: true, attributes: true, attributeFilter: ["hidden"] });
  refresh();
}
