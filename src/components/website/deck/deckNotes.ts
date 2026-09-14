/* Private per-slide notes on the GUSTO deck.

   One note per slide, saved to D1 through /api/deck-notes (worker/index.js),
   which refuses that endpoint entirely without OWNER_PASSCODE — so unlike
   the review comments, there is no public read path here at all. Sign-in
   reuses the site's existing owner passcode (/api/owner) and the same
   session-stored passcode key the comments feature uses: unlock once on
   either feature and both recognise you for the rest of the tab session.

   Framework-free like comments.ts, and appended straight into .gd-stage
   (not written by GustoDeck.astro's template) so it stays on screen through
   both native fullscreen and ?solo — anything outside the fullscreened
   element is simply not rendered. */

const K_OWNER = "vp-cmt-owner";
const MAX_BODY = 20000;

function store(kind: "local" | "session") {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}
const get = (kind: "local" | "session", k: string) => {
  try {
    return store(kind)?.getItem(k) ?? null;
  } catch {
    return null;
  }
};
const set = (kind: "local" | "session", k: string, v: string | null) => {
  try {
    const s = store(kind);
    if (!s) return;
    if (v == null) s.removeItem(k);
    else s.setItem(k, v);
  } catch {
    /* nothing to do */
  }
};

type Attrs = Record<string, string | number | boolean | EventListener | undefined>;
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...kids: (Node | string | null | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v as EventListener);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const kid of kids) {
    if (kid === null || kid === false) continue;
    el.append(kid);
  }
  return el;
}

async function call<T>(input: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(input, init);
  const type = res.headers.get("content-type") || "";
  if (!type.includes("application/json")) throw new Error("unavailable");
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || String(res.status));
  return data;
}

export function mountNotes(stage: HTMLElement) {
  const btn = stage.querySelector<HTMLButtonElement>(".gd-notes");
  if (!btn) return { setSlide() {} };

  let n = 1;
  let open = false;
  let owner = false;
  let notes = new Map<number, string>();
  let panel: HTMLElement | null = null;
  let textarea: HTMLTextAreaElement | null = null;
  let statusEl: HTMLElement | null = null;
  let dirty = false;
  let saving = false;
  let error = "";
  let saveTimer = 0;

  const headers = (json = false): HeadersInit => {
    const hd: Record<string, string> = {};
    const pass = get("session", K_OWNER);
    if (pass) hd["x-owner-passcode"] = pass;
    if (json) hd["content-type"] = "application/json";
    return hd;
  };

  const updateDot = () => btn!.classList.toggle("has-note", !!(notes.get(n) || "").trim());

  function renderStatus() {
    if (!statusEl) return;
    statusEl.textContent = error || (saving ? "Saving…" : dirty ? "" : "Saved");
    statusEl.classList.toggle("is-error", !!error);
  }

  // Debounced while typing; called immediately on blur, close, or a slide
  // change, so a note is never lost to a slide advance mid-debounce.
  function flush() {
    clearTimeout(saveTimer);
    if (!dirty || !textarea) return;
    dirty = false;
    const slideN = n;
    const body = textarea.value.slice(0, MAX_BODY);
    saving = true;
    renderStatus();
    call("/api/deck-notes", {
      method: "PUT",
      headers: headers(true),
      body: JSON.stringify({ n: slideN, body }),
    })
      .then(() => {
        if (body.trim()) notes.set(slideN, body);
        else notes.delete(slideN);
        saving = false;
        renderStatus();
        updateDot();
      })
      .catch(() => {
        saving = false;
        error = "Couldn't save — try again.";
        renderStatus();
      });
  }

  function scheduleSave() {
    dirty = true;
    error = "";
    renderStatus();
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(flush, 600);
  }

  async function load() {
    try {
      const d = await call<{ notes: Record<string, { body: string }> }>("/api/deck-notes", { headers: headers() });
      notes = new Map(Object.entries(d.notes).map(([k, v]) => [Number(k), v.body]));
      owner = true;
    } catch {
      owner = false;
    }
  }

  function teardown() {
    panel?.remove();
    panel = null;
    textarea = null;
    statusEl = null;
  }

  function closePanel() {
    flush();
    open = false;
    btn!.setAttribute("aria-pressed", "false");
    teardown();
  }

  function buildPanel() {
    textarea = h("textarea", {
      class: "gd-notes-field",
      placeholder: "Private notes for this slide.",
      "aria-label": "Slide notes",
      oninput: scheduleSave,
      onblur: flush,
    });
    textarea.value = notes.get(n) ?? "";
    statusEl = h("span", { class: "gd-notes-status" });
    panel = h(
      "div",
      { class: "gd-notes-panel" },
      h(
        "div",
        { class: "gd-notes-head" },
        h("span", { class: "gd-notes-title" }, "Notes"),
        h("span", { class: "gd-notes-lock" }, "Only you can see these"),
        h("button", { type: "button", class: "gd-notes-close", "aria-label": "Close notes", onclick: closePanel }, "×"),
      ),
      textarea,
      statusEl,
    );
    stage.appendChild(panel);
    renderStatus();
    requestAnimationFrame(() => textarea?.focus());
  }

  function renderOpen() {
    teardown();
    updateDot();
    if (owner) buildPanel();
    else buildSignin();
  }

  function buildSignin() {
    const pass = h("input", {
      type: "password",
      class: "gd-notes-pass",
      placeholder: "Owner passcode",
      "aria-label": "Owner passcode",
      autocomplete: "current-password",
    });
    const err = h("div", { class: "gd-notes-status is-error" });
    const unlock = async () => {
      if (!pass.value) return;
      try {
        const d = await call<{ owner: boolean }>("/api/owner", {
          method: "POST",
          headers: { "x-owner-passcode": pass.value },
        });
        if (d.owner) {
          set("session", K_OWNER, pass.value);
          await load();
          renderOpen();
          return;
        }
        err.textContent = "That passcode didn't work.";
      } catch {
        err.textContent = "Couldn't check that. Try again.";
      }
    };
    pass.addEventListener("keydown", (e) => {
      if (e.key === "Enter") void unlock();
    });
    panel = h(
      "div",
      { class: "gd-notes-panel gd-notes-panel--signin" },
      h(
        "div",
        { class: "gd-notes-head" },
        h("span", { class: "gd-notes-title" }, "Notes"),
        h("button", { type: "button", class: "gd-notes-close", "aria-label": "Close", onclick: closePanel }, "×"),
      ),
      h("p", { class: "gd-notes-blurb" }, "Private, per-slide — sign in as the owner to read or write them."),
      pass,
      h("div", { class: "gd-notes-row" }, h("button", { type: "button", class: "gd-notes-unlock", onclick: unlock }, "Unlock")),
      err,
    );
    stage.appendChild(panel);
    requestAnimationFrame(() => pass.focus());
  }

  async function openPanel() {
    open = true;
    btn!.setAttribute("aria-pressed", "true");
    if (!owner) await load();
    renderOpen();
  }

  btn.addEventListener("click", () => (open ? closePanel() : void openPanel()));
  document.addEventListener("keydown", (e) => {
    if (open && e.key === "Escape") closePanel();
  });

  return {
    setSlide(v: number) {
      if (v === n) return;
      if (open) flush();
      n = v;
      if (open && owner && textarea) {
        textarea.value = notes.get(n) ?? "";
        dirty = false;
        error = "";
        renderStatus();
      }
      updateDot();
    },
  };
}
