// Dev-server only: lets the presentation's ?edit mode save its overrides.
// `astro build` never runs configureServer, so none of this reaches the site.
import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const FILE = fileURLToPath(new URL("../src/data/gustoDeckOverrides.json", import.meta.url));
const SHIP = fileURLToPath(new URL("./ship-deck.sh", import.meta.url));

/* One publish at a time. A save that lands while a publish is running
   queues exactly one more, which picks up everything saved meanwhile. */
let running = null;
let again = false;
function publish() {
  if (running) {
    again = true;
    return running;
  }
  running = new Promise((resolve) => {
    let log = "";
    const p = spawn("sh", [SHIP], { env: process.env });
    p.stdout.on("data", (d) => (log += d));
    p.stderr.on("data", (d) => (log += d));
    p.on("close", (code) => resolve({ ok: code === 0, log: log.trim().split("\n").slice(-4).join("\n") }));
  }).then((result) => {
    running = null;
    if (again) {
      again = false;
      return publish();
    }
    return result;
  });
  return running;
}

export function deckEdit() {
  return {
    name: "deck-edit",
    // saving rewrites a file the page imports — don't let Vite reload the
    // editor out from under you (and its "Publishing…" status) on every save
    // — but do drop the cached module, so the next page load (and SSR)
    // reads what was just saved instead of the stale edits
    handleHotUpdate({ file, modules, server }) {
      if (file !== FILE) return;
      for (const m of modules) server.moduleGraph.invalidateModule(m);
      for (const env of Object.values(server.environments || {})) {
        for (const m of env.moduleGraph?.getModulesByFile?.(FILE) || []) env.moduleGraph.invalidateModule(m);
      }
      return [];
    },
    configureServer(server) {
      server.middlewares.use("/__deck/publish", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          return res.end();
        }
        const result = await publish();
        res.statusCode = result.ok ? 200 : 500;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(result));
      });
      server.middlewares.use("/__deck/overrides", async (req, res) => {
        if (req.method === "GET") {
          res.setHeader("content-type", "application/json");
          return res.end(await readFile(FILE, "utf8"));
        }
        if (req.method !== "POST") {
          res.statusCode = 405;
          return res.end();
        }
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", async () => {
          try {
            const data = JSON.parse(body);
            if (typeof data !== "object" || Array.isArray(data)) throw new Error("expected an object");
            await writeFile(FILE, JSON.stringify(data, null, 2) + "\n");
            res.setHeader("content-type", "application/json");
            res.end('{"ok":true}');
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String(e) }));
          }
        });
      });
    },
  };
}
