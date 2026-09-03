# valentinapdesign.com

Personal site for **Valentina P.** — a name and a grid of pieces. Each piece is
a thumbnail that opens a full-screen interactive demo; the demo's back button
returns to this home page.

Built with [Astro](https://astro.build) (static output) + React islands
([`@astrojs/react`](https://docs.astro.build/en/guides/integrations-guide/react/))
for the interactive pieces, animated with [`motion`](https://motion.dev).

## Run it locally

```sh
npm install
npm run dev        # http://localhost:4321
npm run build      # static site into dist/
npm run preview
```

Node 22+.

## Layout

| Path | What |
| --- | --- |
| `src/pages/index.astro` | Home — name + the gallery grid. |
| `src/data/site.ts` | Site name + the `pieces` list (one entry per thumbnail). |
| `src/pages/work/*.astro` | One page per piece — full-screen, its own `Bare` layout. |
| `src/components/motionlab/` | The Stock / Option toggle: component, sound, demo shell, thumbnail preview. |
| `src/layouts/Base.astro` | Head + fonts for normal pages. |
| `src/layouts/Bare.astro` | Chrome-free shell for the full-screen demos. |
| `src/styles/global.css` | Design tokens + base styles for the site (not the demos). |

## Adding a piece

1. Build the interactive component under `src/components/<name>/`, with an
   island wrapper that renders it (see `motionlab/ToggleDemo.tsx`). Give the
   demo shell an `onBack` that does `window.location.href = "/"`.
2. Add a page `src/pages/work/<slug>.astro` that renders the island inside
   `Bare` with `client:load`.
3. Add a thumbnail preview component (see `motionlab/TogglePreview.tsx`) —
   non-interactive, `pointer-events: none` so clicks reach the card link.
4. Add an entry to `pieces` in `src/data/site.ts`:

   ```ts
   { slug: "my-piece", href: "/work/my-piece", title: "My Piece" }
   ```

5. Render its preview in the grid in `src/pages/index.astro`.

## Deploying

Auto-deploys to Cloudflare (Workers static assets) on every push to `main`.
Build: `npm run build`; deploy: `npx wrangler deploy` (config in
`wrangler.jsonc`, serves `./dist`). Custom domain `valentinapdesign.com` is
attached to the Worker; DNS + SSL handled by Cloudflare.
