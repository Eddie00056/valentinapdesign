#!/usr/bin/env node
/* Capture the gallery's static posters.

   Each tile on the home page shows a WebP poster that paints instantly and
   only mounts the live piece in an iframe on hover. This produces those
   posters: one screenshot per entry in src/data/site.ts, at that piece's own
   previewWidth x previewHeight, in `?embed` mode (the same chrome-free view
   the iframe gets), written to public/thumbs/<slug>.webp.

   It drives headless Chrome over the DevTools protocol and waits in REAL
   time. Chrome's one-shot `--screenshot --virtual-time-budget` was tried
   first and snapshots pieces mid-draw: virtual time fast-forwards timers but
   does not run CSS transitions or Motion's frame loop, so charts that draw
   or fade in came out missing. No dependencies — Node 22+ has WebSocket.

     npm run build && npx astro preview --port 4334   # or reuse a running one
     node scripts/thumbs.mjs [--base http://localhost:4334] [slug ...]
*/
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SCALE = 2; // posters are shown ~0.3-0.6x on 1-2x displays
/* 3500, not a round 4500: the shared price clock ticks every 2200ms, and
   4500 lands 100ms after its second tick — odometers photographed mid-roll.
   3500 is 1.3s past the first, with every draw-in (~1s) long finished. */
const SETTLE_MS = 3500;
const PORT = 9333;

const args = process.argv.slice(2);
const bi = args.indexOf("--base");
const BASE = bi >= 0 ? args.splice(bi, 2)[1] : "http://localhost:4334";
const only = new Set(args);

const src = readFileSync(join(ROOT, "src/data/site.ts"), "utf8");
const body = src.slice(src.indexOf("export const pieces"));
const pieces = [...body.matchAll(/\{([\s\S]*?)\n  \}/g)]
  .map(([, b]) => {
    const get = (k) => (b.match(new RegExp(`${k}:\\s*"?([^",\\n]+)"?`)) || [])[1];
    return { slug: get("slug"), href: get("href"), w: +get("previewWidth"), h: +get("previewHeight") };
  })
  .filter((p) => p.slug && (!only.size || only.has(p.slug)));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), "thumbs-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--hide-scrollbars", "--mute-audio",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore" });

let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    target = list.find((t) => t.type === "page");
  } catch {}
}
if (!target) throw new Error("Chrome did not come up");

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) pending.get(m.id)(m), pending.delete(m.id);
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const n = ++id;
    pending.set(n, resolve);
    ws.send(JSON.stringify({ id: n, method, params }));
  });

await send("Page.enable");
for (const p of pieces) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: p.w, height: p.h, deviceScaleFactor: SCALE, mobile: false,
  });
  await send("Page.navigate", { url: `${BASE}${p.href}?embed` });
  await sleep(SETTLE_MS);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  const png = join(profile, `${p.slug}.png`);
  writeFileSync(png, Buffer.from(shot.result.data, "base64"));
  const out = join(ROOT, "public/thumbs", `${p.slug}.webp`);
  execFileSync("python3", ["-c",
    "import sys;from PIL import Image;Image.open(sys.argv[1]).convert('RGB').save(sys.argv[2],'WEBP',quality=82,method=6)",
    png, out]);
  const kb = Math.round(readFileSync(out).length / 1024);
  console.log(`${p.slug.padEnd(28)} ${p.w}x${p.h}  ${kb} KB`);
}

ws.close();
// Chrome keeps writing its profile until it has actually exited.
await new Promise((r) => { chrome.once("exit", r); chrome.kill(); });
rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
