import "./comments.css";

/* Review comments on the /work prototypes.

   Mounted by the Bare layout on every prototype page. Press Comment, click
   anywhere on the piece to drop a numbered pin, write a note. Comments are
   shared — stored by the site's Worker in D1 (worker/index.js) — so the
   owner sees what reviewers leave.

   Deliberately framework-free: it loads on every piece, alongside whatever
   React island that piece already runs, and must cost that piece nothing it
   can notice. The first request is deferred to idle time for the same
   reason, and nothing renders at all in embed mode (gallery tiles, posters).

   Where a pin lives: dx / dy in CSS px from the centre of the page's first
   island. Almost every piece is a fixed-size design centred on its stage, so
   an offset from the centre stays on the same point of the design at any
   viewport size; a viewport-relative position would drift as soon as the
   reviewer's window differs from yours. */

type Comment = {
  id: string;
  dx: number;
  dy: number;
  body: string;
  name: string;
  createdAt: number;
  mine: boolean;
};

const PAGE_RE = /^\/work\/[a-z0-9-]+$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;
const K_TOKEN = "vp-cmt-token";
const K_NAME = "vp-cmt-name";
const K_OWNER = "vp-cmt-owner";
const MAX_BODY = 1000;
const PIN = 28; // pin size; its bottom-left corner is the point

const ICON_COMMENT =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12.5c0-4.14 3.58-7.5 8-7.5s8 3.36 8 7.5-3.58 7.5-8 7.5c-1.1 0-2.15-.2-3.1-.58L4.5 20.5l1.2-3.65A7.1 7.1 0 0 1 4 12.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
const ICON_TRASH =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l.8 11.2A2 2 0 0 0 9.3 20h5.4a2 2 0 0 0 2-1.8L17.5 7M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_CLOSE =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

/* ---- storage, all of it allowed to fail (private windows, blocked site
   data) without breaking the page ---- */
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

let memToken: string | null = null;
function authorToken() {
  let t = get("local", K_TOKEN) ?? memToken;
  if (!t || !TOKEN_RE.test(t)) {
    const a = new Uint8Array(24);
    crypto.getRandomValues(a);
    t = btoa(String.fromCharCode(...a))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    set("local", K_TOKEN, t);
    memToken = t;
  }
  return t;
}

/* ---- tiny DOM builder ---- */
type Attrs = Record<string, string | number | boolean | EventListener | undefined>;
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...kids: (Node | string | null | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") {
      el.addEventListener(k.slice(2), v as EventListener);
    } else if (k === "html") {
      el.innerHTML = String(v); // only ever the icon constants above
    } else {
      el.setAttribute(k, v === true ? "" : String(v));
    }
  }
  for (const kid of kids) {
    if (kid === null || kid === false) continue;
    el.append(kid);
  }
  return el;
}

function ago(ts: number) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)}d`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function mountComments() {
  const page = location.pathname.replace(/\/+$/, "");
  if (!PAGE_RE.test(page)) return;
  if (document.documentElement.hasAttribute("data-embed")) return;

  /* ---- state ---- */
  let comments: Comment[] = [];
  let owner = false;
  let open = false;
  let openId: string | null = null;
  let draft: { dx: number; dy: number } | null = null;
  let unavailable = false;
  let footMode: "idle" | "signin" | "confirm" = "idle";
  let footError = "";

  /* ---- api ---- */
  const headers = (json = false): HeadersInit => {
    const hd: Record<string, string> = { "x-author-token": authorToken() };
    const pass = get("session", K_OWNER);
    if (pass) hd["x-owner-passcode"] = pass;
    if (json) hd["content-type"] = "application/json";
    return hd;
  };

  async function call<T>(input: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(input, init);
    const type = res.headers.get("content-type") || "";
    if (!type.includes("application/json")) throw new Error("unavailable");
    const data = (await res.json()) as T & { error?: string };
    if (!res.ok) throw new Error(data.error || String(res.status));
    return data;
  }

  async function load() {
    try {
      const d = await call<{ comments: Comment[]; owner: boolean }>(
        `/api/comments?page=${encodeURIComponent(page)}`,
        { headers: headers() },
      );
      comments = d.comments;
      owner = d.owner;
      // a stored passcode the server no longer accepts is just noise
      if (!owner && get("session", K_OWNER)) set("session", K_OWNER, null);
      unavailable = false;
    } catch {
      unavailable = true;
    }
    render();
  }

  /* ---- chrome ---- */
  const root = h("div", { class: "cmt-root" });
  const layer = h("div", { class: "cmt-layer" });
  const capture = h("div", { class: "cmt-capture", "aria-hidden": "true" });
  const count = h("span", { class: "cmt-count" });
  const fab = h(
    "button",
    {
      type: "button",
      class: "cmt-fab cmt-glass",
      "aria-pressed": "false",
      "aria-label": "Comments",
      onclick: () => setOpen(!open),
    },
    h("span", { html: ICON_COMMENT, style: "display:grid" }),
    h("span", { class: "cmt-fab-label" }, "Comment"),
    count,
  );
  const hint = h(
    "div",
    { class: "cmt-hint cmt-glass", role: "status" },
    h("b", {}, "Click anywhere"),
    " to leave a comment · Esc to finish",
  );
  let panel: HTMLDivElement | null = null;

  root.append(fab);
  document.body.append(root);

  /* ---- anchor + placement ---- */
  let anchor: Element | null = null;
  function centre() {
    if (!anchor || !anchor.isConnected) {
      // astro-island is `display: contents` and has no box of its own; the
      // piece's real outer element is its first child.
      const island = document.querySelector("astro-island");
      anchor = island?.firstElementChild ?? document.body;
    }
    const r = anchor.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }

  const pinEls = new Map<string, HTMLButtonElement>();
  let card: HTMLDivElement | null = null;
  let cardFor: { dx: number; dy: number } | null = null;

  function placeCard() {
    if (!card || !cardFor) return;
    const { cx, cy } = centre();
    const x = cx + cardFor.dx;
    const y = cy + cardFor.dy;
    const w = card.offsetWidth || 264;
    const hgt = card.offsetHeight || 140;
    const panelW = panel && innerWidth > 600 ? 344 : 0;
    let left = x + 18;
    if (left + w > innerWidth - 12 - panelW) left = x - w - 8;
    left = Math.max(12, left);
    let top = y - 28;
    top = Math.min(Math.max(12, top), innerHeight - hgt - 12);
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }

  function place() {
    const { cx, cy } = centre();
    const at = (el: HTMLElement | undefined, dx: number, dy: number) => {
      if (!el) return;
      el.style.left = `${cx + dx}px`;
      el.style.top = `${cy + dy - PIN}px`;
    };
    for (const c of comments) at(pinEls.get(c.id), c.dx, c.dy);
    if (draft) at(pinEls.get("draft"), draft.dx, draft.dy);
    placeCard();
  }
  let raf = 0;
  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (open) place();
    });
  };
  addEventListener("scroll", schedule, { capture: true, passive: true });
  addEventListener("resize", schedule, { passive: true });

  /* ---- actions ---- */
  function setOpen(v: boolean) {
    open = v;
    if (!v) {
      draft = null;
      openId = null;
      footMode = "idle";
      footError = "";
    } else {
      void load();
    }
    render();
  }

  function flash(id: string) {
    const el = pinEls.get(id);
    if (!el) return;
    el.classList.remove("is-flash");
    void el.offsetWidth;
    el.classList.add("is-flash");
  }

  async function remove(id: string) {
    const before = comments;
    comments = comments.filter((c) => c.id !== id);
    if (openId === id) openId = null;
    render();
    try {
      await call(`/api/comments/${id}`, { method: "DELETE", headers: headers() });
    } catch {
      comments = before;
      render();
    }
  }

  capture.addEventListener("click", (e) => {
    if (openId) {
      openId = null;
      render();
      return;
    }
    const ta = card?.querySelector("textarea");
    if (draft && ta && ta.value.trim()) {
      ta.focus();
      return;
    }
    const { cx, cy } = centre();
    draft = { dx: Math.round(e.clientX - cx), dy: Math.round(e.clientY - cy) };
    render();
  });

  addEventListener("keydown", (e) => {
    if (!open || e.key !== "Escape") return;
    if (draft) draft = null;
    else if (openId) openId = null;
    else if (footMode !== "idle") footMode = "idle";
    else return setOpen(false);
    render();
  });

  document.addEventListener("visibilitychange", () => {
    if (open && document.visibilityState === "visible") void load();
  });

  /* ---- rendering ---- */
  function composer() {
    const ta = h("textarea", {
      class: "cmt-field",
      placeholder: "Leave a comment…",
      maxlength: MAX_BODY,
      "aria-label": "Comment",
    });
    const name = h("input", {
      class: "cmt-field",
      placeholder: "Your name (optional)",
      maxlength: 40,
      "aria-label": "Your name",
    });
    name.value = get("local", K_NAME) ?? "";
    const post = h("button", { type: "button", class: "cmt-btn cmt-btn--primary", disabled: true }, "Post");
    const err = h("div", { class: "cmt-error", role: "alert" });
    ta.addEventListener("input", () => {
      post.disabled = !ta.value.trim();
    });

    const submit = async () => {
      if (!draft || !ta.value.trim()) return;
      post.disabled = true;
      err.textContent = "";
      set("local", K_NAME, name.value.trim() || null);
      try {
        const d = await call<{ comment: Comment }>("/api/comments", {
          method: "POST",
          headers: headers(true),
          body: JSON.stringify({
            page,
            dx: draft.dx,
            dy: draft.dy,
            body: ta.value,
            name: name.value,
          }),
        });
        comments = [...comments, d.comment];
        draft = null;
        render();
        flash(d.comment.id);
      } catch (e) {
        post.disabled = false;
        err.textContent =
          (e as Error).message === "slow down"
            ? "That's a lot of comments — try again in a few minutes."
            : "Couldn't post that. Try again.";
      }
    };

    post.addEventListener("click", submit);
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void submit();
      }
    });

    const el = h(
      "div",
      { class: "cmt-card cmt-glass", role: "dialog", "aria-label": "New comment" },
      ta,
      name,
      err,
      h(
        "div",
        { class: "cmt-row" },
        h("span", { class: "cmt-hintline" }, navigator.platform.includes("Mac") ? "⌘↵ to post" : "Ctrl+↵ to post"),
        h(
          "button",
          {
            type: "button",
            class: "cmt-btn",
            onclick: () => {
              draft = null;
              render();
            },
          },
          "Cancel",
        ),
        post,
      ),
    );
    requestAnimationFrame(() => ta.focus());
    return el;
  }

  function meta(c: Comment, n: number, withDelete: boolean) {
    return h(
      "div",
      { class: "cmt-meta" },
      h("span", { class: "cmt-name" }, c.name || "Anonymous"),
      h("span", { class: "cmt-time", title: new Date(c.createdAt).toLocaleString() }, ago(c.createdAt)),
      withDelete && (c.mine || owner)
        ? h("button", {
            type: "button",
            class: "cmt-del",
            html: ICON_TRASH,
            "aria-label": `Delete comment ${n}`,
            onclick: (e: Event) => {
              e.stopPropagation();
              void remove(c.id);
            },
          })
        : null,
    );
  }

  function bubble(c: Comment, n: number) {
    return h(
      "div",
      { class: "cmt-card cmt-glass", role: "dialog", "aria-label": `Comment ${n}` },
      meta(c, n, true),
      h("div", { class: "cmt-body" }, c.body),
    );
  }

  function footer() {
    const foot = h("div", { class: "cmt-foot" });
    if (unavailable) return foot;

    if (footMode === "confirm") {
      foot.append(
        h("div", { class: "cmt-confirm" }, `Delete all ${comments.length} comments on this prototype?`),
        h(
          "div",
          { class: "cmt-row" },
          h("span", { class: "cmt-hintline" }),
          h("button", { type: "button", class: "cmt-btn", onclick: () => ((footMode = "idle"), render()) }, "Cancel"),
          h(
            "button",
            {
              type: "button",
              class: "cmt-btn cmt-btn--danger",
              onclick: async () => {
                try {
                  await call(`/api/comments?page=${encodeURIComponent(page)}`, {
                    method: "DELETE",
                    headers: headers(),
                  });
                  comments = [];
                  openId = null;
                  footMode = "idle";
                } catch {
                  footError = "Couldn't clear. Try again.";
                }
                render();
              },
            },
            "Clear all",
          ),
        ),
      );
    } else if (footMode === "signin") {
      const pass = h("input", {
        class: "cmt-field",
        type: "password",
        placeholder: "Owner passcode",
        "aria-label": "Owner passcode",
        autocomplete: "current-password",
      });
      const unlock = async () => {
        if (!pass.value) return;
        try {
          const d = await call<{ owner: boolean }>("/api/owner", {
            method: "POST",
            headers: { ...(headers() as Record<string, string>), "x-owner-passcode": pass.value },
          });
          if (d.owner) {
            set("session", K_OWNER, pass.value);
            owner = true;
            footMode = "idle";
            footError = "";
            await load();
            return;
          }
          footError = "That passcode didn't work.";
        } catch {
          footError = "Couldn't check that. Try again.";
        }
        render();
      };
      pass.addEventListener("keydown", (e) => {
        if (e.key === "Enter") void unlock();
      });
      foot.append(
        pass,
        h(
          "div",
          { class: "cmt-row" },
          h("span", { class: "cmt-hintline" }),
          h(
            "button",
            { type: "button", class: "cmt-btn", onclick: () => ((footMode = "idle"), (footError = ""), render()) },
            "Cancel",
          ),
          h("button", { type: "button", class: "cmt-btn cmt-btn--primary", onclick: unlock }, "Unlock"),
        ),
      );
      requestAnimationFrame(() => pass.focus());
    } else if (owner) {
      foot.append(
        h(
          "div",
          { class: "cmt-row", style: "margin-top:0" },
          h("span", { class: "cmt-hintline" }, "Signed in as owner"),
          comments.length
            ? h(
                "button",
                { type: "button", class: "cmt-link cmt-link--danger", onclick: () => ((footMode = "confirm"), render()) },
                "Clear all",
              )
            : null,
        ),
      );
    } else {
      foot.append(
        h(
          "button",
          { type: "button", class: "cmt-link", onclick: () => ((footMode = "signin"), render()) },
          "Owner sign-in",
        ),
      );
    }
    if (footError) foot.append(h("div", { class: "cmt-error", role: "alert" }, footError));
    return foot;
  }

  function render() {
    fab.setAttribute("aria-pressed", String(open));
    count.textContent = comments.length ? String(comments.length) : "";

    // pins + cards
    layer.replaceChildren();
    pinEls.clear();
    card = null;
    cardFor = null;
    if (open) {
      comments.forEach((c, i) => {
        const pin = h(
          "button",
          {
            type: "button",
            class: `cmt-pin${openId === c.id ? " is-open" : ""}`,
            "aria-label": `Comment ${i + 1} by ${c.name || "Anonymous"}`,
            "aria-expanded": String(openId === c.id),
            onclick: (e: Event) => {
              e.stopPropagation();
              draft = null;
              openId = openId === c.id ? null : c.id;
              render();
            },
          },
          String(i + 1),
        );
        pinEls.set(c.id, pin);
        layer.append(pin);
        if (openId === c.id) {
          card = bubble(c, i + 1);
          cardFor = c;
        }
      });
      if (draft) {
        const pin = h("button", { type: "button", class: "cmt-pin is-draft", tabindex: -1, "aria-hidden": "true" }, "+");
        pinEls.set("draft", pin);
        layer.append(pin);
        card = composer();
        cardFor = draft;
      }
      if (card) layer.append(card);
    }

    // panel
    if (open && !panel) {
      panel = h("div", { class: "cmt-panel cmt-glass", role: "dialog", "aria-label": "Comments" });
    }
    if (panel) {
      if (!open) {
        panel.remove();
        panel = null;
      } else {
        const list = h("ul", { class: "cmt-list" });
        if (unavailable) {
          list.append(h("li", { class: "cmt-empty" }, "Comments aren't available on this server."));
        } else if (!comments.length) {
          list.append(
            h("li", { class: "cmt-empty" }, "No comments yet. Click anywhere on the prototype to leave one."),
          );
        }
        comments.forEach((c, i) => {
          list.append(
            h(
              "li",
              {
                class: `cmt-item${openId === c.id ? " is-open" : ""}`,
                onclick: () => {
                  draft = null;
                  openId = c.id;
                  render();
                  const { cy } = centre();
                  const y = cy + c.dy;
                  if (y < 60 || y > innerHeight - 60) {
                    scrollBy({ top: y - innerHeight / 2, behavior: "smooth" });
                  }
                  flash(c.id);
                },
              },
              h("span", { class: "cmt-num" }, String(i + 1)),
              h("div", { class: "cmt-item-main" }, meta(c, i + 1, true), h("div", { class: "cmt-body" }, c.body)),
            ),
          );
        });
        panel.replaceChildren(
          h(
            "div",
            { class: "cmt-head" },
            h("span", { class: "cmt-title" }, "Comments", h("span", {}, comments.length ? String(comments.length) : "")),
            h("button", {
              type: "button",
              class: "cmt-close",
              html: ICON_CLOSE,
              "aria-label": "Close comments",
              onclick: () => setOpen(false),
            }),
          ),
          list,
          footer(),
        );
      }
    }

    // mount / unmount the layers
    if (open) {
      if (!capture.isConnected) root.prepend(capture);
      if (!layer.isConnected) root.append(layer);
      if (!hint.isConnected) root.append(hint);
      if (panel && !panel.isConnected) root.append(panel);
      place();
    } else {
      capture.remove();
      layer.remove();
      hint.remove();
    }
  }

  // The count on the launcher, fetched once the piece itself has settled.
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (idle) idle(() => void load());
  else setTimeout(() => void load(), 1200);

  render();
}
