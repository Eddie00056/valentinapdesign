#!/usr/bin/env node
/* Record the gallery's moving thumbnails.

   Same idea as tcosta.com/wspoc: each tile is a short muted looping MP4 with
   a poster, `preload="none"`, played only while it is on screen — so the grid
   paints instantly from posters and still moves, and an offscreen video costs
   nothing. This script makes them:

     npm run build && npx astro preview --port 4334     # or reuse a running one
     node scripts/record.mjs [--base http://localhost:4334] [slug ...]

   For each piece in src/data/site.ts it opens `<href>?embed` in headless
   Chrome at the piece's own previewWidth x previewHeight, lets it settle,
   runs the piece's scripted interactions (THUMBS in src/data/site.ts), and
   captures Chrome's DevTools screencast. The screencast only emits a frame
   when something repaints, so every frame is timestamped and resampled onto
   a constant 30fps timeline before encoding with scripts/encode.swift
   (AVFoundation — this machine has no ffmpeg).

   Writes public/thumbs/<slug>.mp4 and public/thumbs/<slug>.webp (poster). */
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, writeFileSync, rmSync, mkdirSync, existsSync, statSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT_W = 1200; // Thiago's thumbnails are 1200 wide; plenty for a card on 2x
/* 60, not 30. Chrome repaints an animating page at ~60Hz; resampling that to
   30 threw away every other frame unevenly and read as judder. tcosta.com's
   clips are 60 too. */
const FPS = 60;
const SETTLE_MS = 1800; // past every draw-in, before recording starts
/* A fresh debugging port per launch. Reusing one let /json answer from the
   PREVIOUS Chrome while it was still exiting; its socket then closed under
   the next command and the run hung on a promise that never settled. */
let nextPort = 9400;

const args = process.argv.slice(2);
const bi = args.indexOf("--base");
const BASE = bi >= 0 ? args.splice(bi, 2)[1] : "http://localhost:4334";
const only = new Set(args);

/* ---- pieces + per-piece recording scripts, both from src/data/site.ts ---- */
const src = readFileSync(join(ROOT, "src/data/site.ts"), "utf8");
const body = src.slice(src.indexOf("export const pieces"));
const pieces = [...body.matchAll(/\{([\s\S]*?)\n  \}/g)]
  .map(([, b]) => {
    const get = (k) => (b.match(new RegExp(`${k}:\\s*"?([^",\\n]+)"?`)) || [])[1];
    return { slug: get("slug"), href: get("href"), w: +get("previewWidth"), h: +get("previewHeight") };
  })
  .filter((p) => p.slug && (!only.size || only.has(p.slug)));

// THUMBS lives in site.ts as plain JSON so this script can read it without a TS toolchain.
const tm = src.match(/export const THUMBS[^=]*=\s*(\{[\s\S]*?\n\});/);
const THUMBS = tm
  ? JSON.parse(tm[1].replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1"))
  : {};

/* ---- chrome ----
   One Chrome per piece, launched at that piece's pixel density with
   --force-device-scale-factor. Headless screencast frames ignore the density
   set through Emulation.setDeviceMetricsOverride (and its maxWidth), so a crop
   of a small component came out of ~1x frames and was upscaled; the process
   flag is the only thing the screencast honours. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let send, evaluate, listeners;

async function launch(scale) {
  const PORT = nextPort++;
  const profile = mkdtempSync(join(tmpdir(), "record-"));
  const proc = spawn(CHROME, ["--headless=new", "--hide-scrollbars", "--mute-audio",
    `--force-device-scale-factor=${scale}`,
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === "page"); } catch {}
  }
  if (!target) throw new Error("Chrome did not come up");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  listeners = new Set();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) for (const l of listeners) l(m);
  };
  send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id;
    const timer = setTimeout(() => { pending.delete(n); reject(new Error(`CDP ${method} timed out`)); }, 30000);
    pending.set(n, (m) => { clearTimeout(timer); resolve(m); });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  ws.onclose = () => { for (const [, done] of pending) done({ error: "socket closed" }); pending.clear(); };
  evaluate = (expression) => send("Runtime.evaluate", { expression, awaitPromise: true });
  await send("Page.enable");
  return async () => {
    ws.close();
    await new Promise((r) => { proc.once("exit", r); proc.kill(); });
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  };
}

async function act(step) {
  if (step.wait) return sleep(step.wait);
  if (step.click || step.label) {
    // `label` matches a control's aria-label or its text; `click` is a selector.
    // Real pointer events at the element's centre, so hover/press states fire too.
    const find = step.label
      ? `[...document.querySelectorAll('button,[role=button],[role=tab],[aria-label]')].find(e =>
           (e.getAttribute('aria-label') || e.textContent || '').trim() === ${JSON.stringify(step.label)})`
      : `document.querySelector(${JSON.stringify(step.click)})`;
    // Poll for it: a piece may still be hydrating when its script starts.
    let v = null;
    for (let tries = 0; tries < 30 && !v; tries++) {
      const r = await evaluate(`(() => { const el = ${find};
        if (!el) return null; const b = el.getBoundingClientRect();
        return JSON.stringify([b.left + b.width / 2, b.top + b.height / 2]); })()`);
      v = r.result?.result?.value;
      if (!v) await sleep(100);
    }
    if (!v) throw new Error(`no element for ${step.label || step.click}`);
    const [x, y] = JSON.parse(v);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await sleep(60);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await sleep(90);
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  }
  if (step.eval) await evaluate(step.eval);
}

const profile = mkdtempSync(join(tmpdir(), "record-work-"));
/* Encoder. x264 via ffmpeg when there is one — FFMPEG=/path, or `ffmpeg` on
   PATH. This Mac has no ffmpeg by default; `npx ffmpeg-static` prints a
   usable binary's path. Without one, scripts/encode.swift (AVFoundation) is
   the fallback, but it is Apple's HARDWARE H.264 encoder: built for speed, it
   blocks up on flat UI and fine text at thumbnail bitrates and undershoots the
   bitrate it is given by about half. tcosta.com/wspoc's clips are x264 — clean
   at 0.1-0.5 Mbps. */
const FFMPEG = process.env.FFMPEG || (() => {
  try { return execFileSync("which", ["ffmpeg"]).toString().trim() || null; } catch {}
  try { return createRequire(import.meta.url)("ffmpeg-static"); } catch {}
  return null;
})();
/* Measured on identical source frames (PSNR vs source, 2026-09-12): the
   hardware encoder's worst frames sat at 33-36 dB on the dense widgets —
   visible blocking — where x264 held 38.6-45 dB at half the file size. So it
   is not a silent fallback: it has to be asked for. */
if (!FFMPEG && process.env.ALLOW_HW_ENCODER !== "1") {
  console.error(`No ffmpeg found. Thumbnails need x264 for quality. Either:
  npm i --no-save ffmpeg-static     (then re-run; nothing is added to package.json)
  FFMPEG=/path/to/ffmpeg node scripts/record.mjs ...
or, knowingly accepting blockier clips: ALLOW_HW_ENCODER=1 node scripts/record.mjs ...`);
  process.exit(1);
}
const encoder = join(tmpdir(), "vp-encode");
if (!FFMPEG && !existsSync(encoder)) execFileSync("swiftc", ["-O", join(ROOT, "scripts/encode.swift"), "-o", encoder]);
console.log(FFMPEG ? `encoder: x264 (${FFMPEG})` : "encoder: AVFoundation hardware H.264 (ALLOW_HW_ENCODER=1)");
const KEEP = process.env.KEEP_FRAMES; // keep each clip's source frames here, for measuring quality

/* The union box of everything matching `sel`, in CSS px, or null. */
const measure = async (sel) => {
  const r = await evaluate(`(() => {
    const els = [...document.querySelectorAll(${JSON.stringify(sel)})]
      .map(e => e.getBoundingClientRect()).filter(b => b.width && b.height);
    if (!els.length) return null;
    return JSON.stringify([Math.min(...els.map(b => b.left)), Math.min(...els.map(b => b.top)),
      Math.max(...els.map(b => b.right)), Math.max(...els.map(b => b.bottom))]);
  })()`);
  const v = r.result?.result?.value;
  return v ? JSON.parse(v) : null;
};

/* Navigate, then wait for the component to actually be on the page before
   the settle. A fixed sleep alone let a slow load start a recording against
   an empty page: options-strategy-builder once came out as a single blank
   frame because its script ran before the widget existed. */
async function open(p, focus) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await send("Page.navigate", { url: `${BASE}${p.href}?embed` });
    for (let i = 0; i < 60; i++) {
      if (await measure(focus)) {
        await sleep(SETTLE_MS);
        return true;
      }
      await sleep(100);
    }
  }
  return false;
}

const manifest = existsSync(join(ROOT, "public/thumbs/manifest.json"))
  ? JSON.parse(readFileSync(join(ROOT, "public/thumbs/manifest.json"), "utf8"))
  : {};

for (const p of pieces) {
  const cfg = THUMBS[p.slug] || {};
  const seconds = cfg.seconds ?? 6;
  const focus = cfg.focus ?? "[data-thumb]";
  // `pad` is CSS px around the component: one number, or [x, y] — phone
  // screens pad only vertically, since their content already runs edge to edge
  // and horizontal padding would frame the bezel.
  const [padX, padY] = Array.isArray(cfg.pad) ? cfg.pad : [cfg.pad ?? 28, cfg.pad ?? 28];
  const runScript = async () => { for (const step of cfg.script || []) await act(step); };

  /* Pass 1 — measure. Play the clip once with nothing recording and track the
     component's box the whole way through, keeping the union, so a banner
     that expands or a ticket that opens is inside the frame at its largest
     rather than clipped to how it looked on the first frame. A page that
     fails to render its component gets one more try; after that the piece is
     skipped and its existing thumbnail kept — never replaced by a clip of
     the wrong thing. */
  let box = null;
  for (let attempt = 0; attempt < 2 && !box; attempt++) {
    const closeMeasure = await launch(1);
    await send("Emulation.setDeviceMetricsOverride", { width: p.w, height: p.h, deviceScaleFactor: 1, mobile: false });
    if (!(await open(p, focus))) { await closeMeasure(); continue; }
    let sampling = true;
    const sampler = (async () => {
      while (sampling) {
        const b = await measure(focus);
        if (b) box = box ? [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.max(box[2], b[2]), Math.max(box[3], b[3])] : b;
        await sleep(120);
      }
    })();
    const s1 = runScript().catch(() => {});
    await sleep(seconds * 1000);
    await s1;
    sampling = false;
    await sampler;
    await closeMeasure();
  }
  if (!box) {
    console.error(`  ✗ ${p.slug}: nothing matched ${focus} after 2 tries — skipped, old thumbnail kept`);
    continue;
  }
  let close;
  // `maxH` keeps only the top of a component too tall to read at card size
  if (cfg.maxH) box[3] = Math.min(box[3], box[1] + cfg.maxH);

  /* Frame. `fill` is the share of the card the component takes (per axis,
     whichever binds): tcosta.com/wspoc's cards sit their component well inside
     the frame with room around it, and framing edge to edge read as "too
     zoomed in". Then `pad`, then the aspect clamp, then kept inside the page. */
  const fill = cfg.fill ?? 0.62;
  const bw = box[2] - box[0], bh = box[3] - box[1];
  const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2;
  let fw0 = bw / fill + padX * 2, fh0 = bh / fill + padY * 2;
  const MIN_AR = 0.55, MAX_AR = 1.7;
  if (fh0 / fw0 < MIN_AR) fh0 = fw0 * MIN_AR;
  if (fh0 / fw0 > MAX_AR) fw0 = fh0 / MAX_AR;
  fw0 = Math.min(fw0, p.w); fh0 = Math.min(fh0, p.h);
  // slide, don't shrink, when the frame runs off an edge — keeps the size
  const x0 = Math.round(Math.max(0, Math.min(p.w - fw0, cx - fw0 / 2)));
  const y0 = Math.round(Math.max(0, Math.min(p.h - fh0, cy - fh0 / 2)));
  const cw = Math.round(fw0);
  const ch = Math.round(fh0);
  const W = OUT_W;
  const H = Math.round((W * ch) / cw / 2) * 2;
  /* Density: enough real pixels for 1200 across. Chrome is LAUNCHED at it
     (--force-device-scale-factor), so every layer — including ones mid-
     animation — rasterises at that size. The previous route, a zoomed
     viewport clip, is a pinch-zoom: static text re-rasterises but an
     animating layer is just its 1x bitmap scaled up, which is what made the
     order-placed ring stair-step. */
  const density = Math.min(6, Math.max(1, Math.ceil((OUT_W / cw) * 2) / 2));

  /* Pass 2 — record, clipped: only the frame rectangle is rendered into the
     screencast, at the launch density, and the page never sees it. */
  close = await launch(density);
  /* Verified against Page.captureScreenshot (which takes plain CSS px): under
     a launch density the viewport clip wants x/y in DEVICE px but width and
     height in CSS px. Undocumented, and passing all CSS px silently captured
     the empty stage up and to the left of the component. */
  await send("Emulation.setDeviceMetricsOverride", {
    width: p.w, height: p.h, deviceScaleFactor: 0, mobile: false,
    viewport: { x: x0 * density, y: y0 * density, width: cw, height: ch, scale: 1 },
  });
  if (!(await open(p, focus))) {
    await close();
    console.error(`  ✗ ${p.slug}: component never rendered for recording — skipped, old thumbnail kept`);
    continue;
  }
  /* backdrop-filter off while recording (KEEP_BLUR=1 to leave it on). It is
     the most expensive thing to rasterise at recording density and scales
     with pixel count: with it on, Notive captured 98 frames in 6s and order
     placement 6; off, 256 and 48. On these pieces the glass sits over flat
     colour, where there is nothing to blur — the poster differed in 0.16% of
     pixels, all of them the price catching a different tick. */
  if (process.env.KEEP_BLUR !== "1") {
    await evaluate(`(() => { const st = document.createElement('style');
      st.textContent = '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';
      document.head.appendChild(st); })()`);
    await sleep(150);
  }

  const frames = [];
  const onFrame = (m) => {
    if (m.method !== "Page.screencastFrame") return;
    frames.push({ t: m.params.metadata.timestamp * 1000, data: m.params.data });
    send("Page.screencastFrameAck", { sessionId: m.params.sessionId });
  };
  listeners.add(onFrame);
  /* JPEG at quality 100 (SC_FORMAT=png to override). PNG is lossless but
     costs capture throughput on large frames — Notive fell from 256 to 157
     frames — and at q100 JPEG adds no banding the encoder doesn't. */
  await send("Page.startScreencast", { format: process.env.SC_FORMAT || "jpeg", quality: 100, everyNthFrame: 1, maxWidth: 8192, maxHeight: 8192 });
  let scriptError = null;
  const s2 = runScript().catch((e) => { scriptError = e; });
  await sleep(seconds * 1000);
  await s2;
  await send("Page.stopScreencast");
  listeners.delete(onFrame);
  await close();
  if (scriptError || !frames.length) {
    console.error(`  ✗ ${p.slug}: ${scriptError ? scriptError.message : "no frames"} — skipped, old thumbnail kept`);
    continue;
  }

  // constant-rate resample: at each tick, the newest frame painted by then
  const dir = join(profile, p.slug);
  mkdirSync(dir, { recursive: true });
  const EXT = (process.env.SC_FORMAT || "jpeg") === "jpeg" ? ".jpg" : ".png";
  /* Trim leading blank frames. Right after the clipped viewport is applied
     the screencast can emit a frame or two before anything has painted — a
     flat colour that would flash at the start of every loop (order placement
     opened on 0.3s of solid black). A flat frame encodes to a fraction of a
     real one, so anything under a third of the median frame size is blank. */
  const sizes = frames.map((f) => f.data.length).sort((x, y) => x - y);
  const median = sizes[Math.floor(sizes.length / 2)];
  const firstReal = Math.max(0, frames.findIndex((f) => f.data.length >= median / 3));
  frames.splice(0, firstReal);
  const start = frames[0].t;
  const total = Math.round(seconds * FPS);
  let j = 0;
  for (let i = 0; i < total; i++) {
    const at = start + (i * 1000) / FPS;
    while (j + 1 < frames.length && frames[j + 1].t <= at) j++;
    writeFileSync(join(dir, String(i).padStart(6, "0") + EXT), Buffer.from(frames[j].data, "base64"));
  }
  const fw = +execFileSync("python3", ["-c", "import sys;from PIL import Image;print(Image.open(sys.argv[1]).width)",
    join(dir, "000000" + EXT)]).toString().trim();

  /* Encode inside the temp profile and move the finished file into place.
     Writing straight over public/thumbs/<slug>.mp4 left AVFoundation's
     `.mp4.sb-*` safe-save files beside it on every run — and the build copies
     everything in public/ into the deploy. */
  const mp4 = join(ROOT, "public/thumbs", `${p.slug}.mp4`);
  const tmpMp4 = join(profile, `${p.slug}.mp4`);
  if (FFMPEG) {
    /* CRF 18 is visually lossless for this material; `-tune animation` suits
       flat fills and hard edges, and `veryslow` spends encode time — which is
       free here — on bits, which aren't. yuv420p + faststart for every
       browser, and a keyframe every 2s so a card that starts mid-scroll gets
       a picture quickly. */
    execFileSync(FFMPEG, [
      "-y", "-hide_banner", "-loglevel", "error",
      "-framerate", String(FPS), "-i", join(dir, "%06d" + EXT),
      "-vf", `scale=${W}:${H}:flags=lanczos,format=yuv420p`,
      "-c:v", "libx264", "-preset", "veryslow", "-tune", "animation", "-crf", "18",
      // aq-mode 3 biases bits toward dark flat areas, where 8-bit gradients band
      "-x264-params", "aq-mode=3",
      "-g", String(FPS * 2), "-movflags", "+faststart", "-an", tmpMp4,
    ]);
  } else {
    const bitrate = Math.round(W * H * 1.1);
    execFileSync(encoder, [dir, tmpMp4, String(FPS), String(W), String(H), String(bitrate)], { stdio: "ignore" });
  }
  copyFileSync(tmpMp4, mp4);
  if (KEEP) {
    mkdirSync(join(KEEP, p.slug), { recursive: true });
    execFileSync("cp", ["-R", dir + "/.", join(KEEP, p.slug)]);
  }
  /* Poster: the first frame nothing is changing on, not frame zero. Frame zero
     can land mid-tick — an odometer half-rolled — and the poster is what a
     card shows before its video plays, and all it shows with reduced motion. */
  const poster = join(ROOT, "public/thumbs", `${p.slug}.webp`);
  execFileSync("python3", ["-c", `
import sys, os
from PIL import Image, ImageChops
d, out, W, H = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
names = sorted(n for n in os.listdir(d) if n.endswith((".png", ".jpg")))
from PIL import ImageStat
small = lambda n: Image.open(os.path.join(d, n)).convert("L").resize((120, 120))
# a settled frame from a third of the way in: past any start-up, and the
# first one not changing from its neighbour and not a flat colour
pick = names[len(names) // 3]
start = len(names) // 3
prev = small(names[start])
for n in names[start + 1:]:
    cur = small(n)
    if ImageChops.difference(prev, cur).getbbox() is None and ImageStat.Stat(cur).stddev[0] > 2:
        pick = n
        break
    prev = cur
Image.open(os.path.join(d, pick)).convert("RGB").resize((W, H), Image.LANCZOS).save(out, "WEBP", quality=80, method=6)
`, dir, poster, String(W), String(H)]);
  manifest[p.slug] = { w: W, h: H, seconds };
  const kb = (f) => Math.round(statSync(f).size / 1024);
  console.log(`${p.slug.padEnd(26)} ${W}x${H}  ${density}x -> ${fw}px wide${fw < W - 2 ? " (UPSCALED)" : ""}  ${frames.length} painted  mp4 ${kb(mp4)} KB`);
}

writeFileSync(join(ROOT, "public/thumbs/manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
