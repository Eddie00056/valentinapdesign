/* valentinapdesign.com Worker.

   Serves the static site exactly as before (env.ASSETS) and adds one thing:
   /api/comments, the pinned review comments on the /work prototypes, stored
   in D1. wrangler.jsonc routes only /api/* here first, so every other
   request is still answered by the asset layer without touching this code.

   Permissions, as agreed:
   - anyone can read and post;
   - a browser can delete the comments it posted (proved by a random token it
     keeps, stored here only as a SHA-256);
   - the owner, holding OWNER_PASSCODE (a Worker secret), can delete any
     comment and clear a page. With no secret set, owner actions are refused.
*/

const PAGE = /^\/work\/[a-z0-9-]+$/;
const TOKEN = /^[A-Za-z0-9_-]{16,128}$/;
const MAX_BODY = 1000;
const MAX_NAME = 40;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 30;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

const enc = new TextEncoder();

async function sha256(s) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isOwner(req, env) {
  const given = req.headers.get("x-owner-passcode");
  if (!env.OWNER_PASSCODE || !given) return false;
  const a = enc.encode(given);
  const b = enc.encode(env.OWNER_PASSCODE);
  return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b);
}

async function authorKey(req) {
  const t = req.headers.get("x-author-token") || "";
  return TOKEN.test(t) ? sha256(t) : null;
}

function normPage(p) {
  if (typeof p !== "string") return null;
  const clean = p.replace(/\/+$/, "");
  return PAGE.test(clean) ? clean : null;
}

async function readJson(req) {
  const text = await req.text();
  if (text.length > 8192) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function api(req, env, url) {
  const db = env.DB;
  const owner = isOwner(req, env);

  if (url.pathname === "/api/owner" && req.method === "POST") {
    return json({ owner });
  }

  if (url.pathname === "/api/comments") {
    if (req.method === "GET") {
      const page = normPage(url.searchParams.get("page"));
      if (!page) return json({ error: "bad page" }, 400);
      const key = await authorKey(req);
      const { results } = await db
        .prepare(
          "SELECT id, dx, dy, body, name, author_key, created_at FROM comments WHERE page = ? ORDER BY created_at ASC LIMIT 500",
        )
        .bind(page)
        .all();
      return json({
        owner,
        comments: results.map((r) => ({
          id: r.id,
          dx: r.dx,
          dy: r.dy,
          body: r.body,
          name: r.name,
          createdAt: r.created_at,
          mine: !!key && r.author_key === key,
        })),
      });
    }

    if (req.method === "POST") {
      const key = await authorKey(req);
      if (!key) return json({ error: "missing author token" }, 400);
      const b = await readJson(req);
      if (!b) return json({ error: "bad body" }, 400);
      const page = normPage(b.page);
      const body = typeof b.body === "string" ? b.body.trim() : "";
      const name = typeof b.name === "string" ? b.name.trim().slice(0, MAX_NAME) : "";
      const dx = Number(b.dx);
      const dy = Number(b.dy);
      if (!page || !body || body.length > MAX_BODY) return json({ error: "invalid" }, 400);
      if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 20000 || Math.abs(dy) > 20000) {
        return json({ error: "invalid position" }, 400);
      }
      const now = Date.now();
      const recent = await db
        .prepare("SELECT COUNT(*) AS n FROM comments WHERE author_key = ? AND created_at > ?")
        .bind(key, now - RATE_WINDOW_MS)
        .first();
      if (recent && recent.n >= RATE_MAX) return json({ error: "slow down" }, 429);

      const id = crypto.randomUUID();
      await db
        .prepare(
          "INSERT INTO comments (id, page, dx, dy, body, name, author_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(id, page, dx, dy, body, name, key, now)
        .run();
      return json({ comment: { id, dx, dy, body, name, createdAt: now, mine: true } }, 201);
    }

    if (req.method === "DELETE") {
      if (!owner) return json({ error: "owner only" }, 403);
      const page = normPage(url.searchParams.get("page"));
      if (!page) return json({ error: "bad page" }, 400);
      const r = await db.prepare("DELETE FROM comments WHERE page = ?").bind(page).run();
      return json({ deleted: r.meta.changes });
    }
  }

  const one = url.pathname.match(/^\/api\/comments\/([0-9a-f-]{36})$/);
  if (one && req.method === "DELETE") {
    const row = await db.prepare("SELECT author_key FROM comments WHERE id = ?").bind(one[1]).first();
    if (!row) return json({ error: "not found" }, 404);
    const key = await authorKey(req);
    if (!owner && (!key || key !== row.author_key)) return json({ error: "not yours" }, 403);
    await db.prepare("DELETE FROM comments WHERE id = ?").bind(one[1]).run();
    return json({ deleted: 1 });
  }

  return json({ error: "not found" }, 404);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await api(req, env, url);
      } catch (err) {
        console.error(err);
        return json({ error: "server error" }, 500);
      }
    }
    return env.ASSETS.fetch(req);
  },
};
