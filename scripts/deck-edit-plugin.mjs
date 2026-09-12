// Dev-server only: lets the presentation's ?edit mode save its overrides.
// `astro build` never runs configureServer, so none of this reaches the site.
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const FILE = fileURLToPath(new URL("../src/data/gustoDeckOverrides.json", import.meta.url));

export function deckEdit() {
  return {
    name: "deck-edit",
    configureServer(server) {
      server.middlewares.use("/__deck/overrides", (req, res) => {
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
