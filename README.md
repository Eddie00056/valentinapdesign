# valentinapdesign.com

Personal site for **Valentina P.** — a grid-gallery landing page. One index
page of project cards; each card links to its own case-study page. Add a
project and it shows up on the site.

Built with [Astro](https://astro.build) (static output, no framework runtime).

## Run it locally

```sh
npm install
npm run dev        # http://localhost:4321
npm run build      # static site into dist/
npm run preview    # serve the built dist/ locally
```

Requires Node 22.12+.

## Where things live

| Path | What |
| --- | --- |
| `src/data/site.ts` | **Edit this.** Site name/links + the `pieces` array (the gallery). Order = display order. |
| `src/pages/index.astro` | The gallery grid. |
| `src/pages/work/[slug].astro` | Case-study page template, one per piece. |
| `src/layouts/Base.astro` | HTML shell, `<head>`, fonts, footer. |
| `src/styles/global.css` | Design tokens (colour, type) + base styles. |
| `public/` | Static files served as-is (favicon, images). |

## Adding a project

1. Add an entry to `pieces` in `src/data/site.ts`:

   ```ts
   {
     slug: "my-project",           // becomes /work/my-project
     title: "My Project",
     year: "2026",
     kind: "Identity",             // short tag shown on the card
     summary: "One line about it.",
     cover: "/work/my-project/cover.jpg", // optional; omit for a coloured tile
     accent: "#c8624a",            // tile colour when there's no cover
   }
   ```

2. Put images in `public/work/my-project/`.
3. Flesh out the case study in `src/pages/work/[slug].astro` (currently a
   shared placeholder for every piece — split it out when the content differs).

## Deploying

Static site — any static host works. Recommended: **Cloudflare Pages** (build
command `npm run build`, output directory `dist`). Custom domain
`valentinapdesign.com` is configured at the registrar (Porkbun). See the repo's
deployment notes / issues for the current DNS setup.

## TODO

- Replace placeholder projects and copy in `src/data/site.ts` (search `TODO`).
- Real case-study content per project.
- Real social links + email address.
- Add `public/og.png` for link previews.
