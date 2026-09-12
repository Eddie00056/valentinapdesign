// Site-wide content.

export const site = {
  name: "Valentina P.",
  domain: "valentinapdesign.com",
};

export type Piece = {
  slug: string;
  href: string;
  title: string;
  /**
   * Viewport the gallery renders this piece's page at, in px. The tile
   * scales that viewport to its own width, so these two numbers decide
   * both the tile's aspect ratio AND how large the work reads inside it.
   *
   * Narrower viewport = the work fills more of the tile. A phone screen
   * is already most of a 1280px page, but a lone toggle is a few percent
   * of one and reads as a speck; those pieces render at a viewport sized
   * close to the component so they land near half the tile's width, which
   * is where the reference grid sits.
   *
   * Nothing is cropped — the page's own background becomes the tile's
   * margin, which is what lets the work float rather than fill.
   */
  previewWidth: number;
  previewHeight: number;
};

// Case studies ported from the Framer site. One dynamic route renders
// all of them: src/pages/website/[slug].astro
export type CaseStudy = {
  slug: string;
  title: string;
  summary: string;
  impact: string;
};

export const caseStudies: CaseStudy[] = [
  {
    slug: "questrade-pro",
    title: "Questrade Pro",
    summary: "Redesigned the highest-impact feature, and reduced time to trade by 60%.",
    impact: "−60% time to trade",
  },
  {
    slug: "fractional-shares",
    title: "Fractional Shares",
    summary: "Led the end-to-end design of fractional trading, driving $33M in revenue.",
    impact: "$33M in revenue",
  },
  {
    slug: "edgemobile",
    title: "EdgeMobile",
    summary:
      "Led the design, launch and early growth of Questrade’s top income-generating mobile platform.",
    impact: "Top income-generating platform",
  },
];

// The gallery, in display order. A page left out of this list still builds
// and is reachable by URL; it just isn't shown (e.g. /work/alert-prototype,
// superseded by /work/alert-creation and hidden on request 2026-09-12).
export const pieces: Piece[] = [
  {
    slug: "stock-option-toggle",
    href: "/work/stock-option-toggle",
    title: "Stock / Option toggle",
    previewWidth: 560,
    previewHeight: 340,
  },
  {
    slug: "limit-order-error",
    href: "/work/limit-order-error",
    title: "Limit order error",
    previewWidth: 700,
    previewHeight: 420,
  },
  {
    slug: "fractional-shares-banner",
    href: "/work/fractional-shares-banner",
    title: "Fractional shares banner",
    previewWidth: 900,
    previewHeight: 480,
  },
  {
    slug: "alert-creation",
    href: "/work/alert-creation",
    title: "Alert creation",
    previewWidth: 820,
    previewHeight: 840,
  },
  {
    slug: "order-placement-boxed",
    href: "/work/order-placement-boxed",
    title: "Order placement",
    previewWidth: 820,
    previewHeight: 840,
  },
  {
    slug: "order-placed-animation",
    href: "/work/order-placed-animation",
    title: "Order placed animation",
    previewWidth: 780,
    previewHeight: 800,
  },
  {
    slug: "fractional-order-flow",
    href: "/work/fractional-order-flow",
    title: "Fractional order flow",
    previewWidth: 900,
    previewHeight: 960,
  },
  {
    slug: "options-strategy-builder",
    href: "/work/options-strategy-builder",
    title: "Options strategy builder",
    previewWidth: 860,
    previewHeight: 560,
  },
  {
    slug: "option-chain",
    href: "/work/option-chain",
    title: "Option chain",
    previewWidth: 1120,
    previewHeight: 620,
  },
  {
    slug: "stock-order-entry",
    href: "/work/stock-order-entry",
    title: "Stock order entry",
    previewWidth: 860,
    previewHeight: 560,
  },
  {
    slug: "beam-ring",
    href: "/work/beam-ring",
    title: "Beam ring",
    /* Tall and narrow: the piece is a column of three objects, and a
       viewport wider than the widest of them is mostly ground. */
    previewWidth: 640,
    previewHeight: 620,
  },
  {
    slug: "notive-quote",
    href: "/work/notive-quote",
    /* The whole device is shown (no bottom crop), so the tile needs the
       taller viewport the other phone pieces don't. */
    previewWidth: 820,
    previewHeight: 960,
    title: "Notive quote",
  },
  {
    slug: "chain-to-order",
    href: "/work/chain-to-order",
    title: "Chain to order",
    /* The workspace's own 1440 x 900, so the preview frames the screen
       exactly as the piece draws it — the shell contain-fits itself into
       whatever it is given, and at this size it lands just under 1:1 with
       its 40px of air still around it. */
    previewWidth: 1440,
    previewHeight: 900,
  },
];

/* How each piece is recorded for its gallery thumbnail (scripts/record.mjs).
   A piece that moves on its own is just filmed; one that only moves when
   touched gets a short script. Every script returns the piece to the state
   it started in by the end of the clip, so the loop has no visible jump.
   `fill` is the share of the card the component takes (default 0.62): cards
   sit their component inside the frame with room around it, as
   tcosta.com/wspoc's do. Phone screens frame the whole device.
   `focus` is a selector for what the thumbnail frames — the component, not the
   page, the way tcosta.com/wspoc frames its cards; it defaults to the
   `[data-thumb]` markers placed inside a piece. `pad` is CSS px around it, or
   [x, y]: a phone screen whose marked content already runs edge to edge
   (a full-bleed chart) pads x 0, one whose content sits in the screen's 24px
   column pads x 24 to give that inset back.
   Steps: {"wait": ms} | {"label": "aria-label or text"} | {"click": "selector"}
   (prefer an aria-label *prefix* selector when the label carries a live price)
   | {"eval": "js"}. `maxH` keeps only the top of a component too tall to read.
   Kept as plain JSON so the recorder can read it without a TS toolchain. */
export const THUMBS: Record<
  string,
  {
    focus?: string;
    fill?: number;
    pad?: number | [number, number];
    maxH?: number;
    seconds?: number;
    script?: Record<string, string | number>[];
  }
> = {
  "stock-option-toggle": {
    "fill": 0.55, "focus": "button.lbl", "pad": 0, "seconds": 5,
    "script": [{ "wait": 500 }, { "label": "Option" }, { "wait": 2100 }, { "label": "Stock" }]
  },
  "limit-order-error": {
    "fill": 0.45, "focus": "[aria-label=\"Trigger limit order error\"]", "pad": 0, "seconds": 5,
    "script": [
      { "wait": 500 }, { "label": "Trigger limit order error" },
      { "wait": 2600 }, { "eval": "document.activeElement && document.activeElement.blur()" }
    ]
  },
  "fractional-shares-banner": {
    "fill": 0.6, "focus": "[aria-label=\"Expand fractional shares banner\"], [aria-label=\"Collapse banner\"]", "pad": 0, "seconds": 5,
    "script": [{ "wait": 500 }, { "label": "Expand fractional shares banner" }, { "wait": 2200 }, { "label": "Collapse banner" }]
  },
  "alert-creation": { "focus": "img[alt=\"iPhone\"]", "fill": 0.92, "pad": 0 },
  "order-placement-boxed": { "focus": "img[alt=\"iPhone\"]", "fill": 0.92, "pad": 0 },
  "order-placed-animation": { "focus": "img[alt=\"iPhone\"]", "fill": 0.92, "pad": 0 },
  "fractional-order-flow": { "focus": "img[alt=\"iPhone\"]", "fill": 0.92, "pad": 0 },
  "options-strategy-builder": {
    "fill": 0.82, "focus": ".wshell", "pad": 20, "seconds": 6,
    "script": [
      { "wait": 700 }, { "label": "Increase Quantity" }, { "wait": 450 }, { "label": "Increase Quantity" },
      { "wait": 1900 }, { "label": "Decrease Quantity" }, { "wait": 450 }, { "label": "Decrease Quantity" }
    ]
  },
  "option-chain": {
    "fill": 0.85, "focus": ".oc-root", "pad": 16, "maxH": 300, "seconds": 6,
    "script": [{ "wait": 900 }, { "label": "Put" }, { "wait": 2600 }, { "label": "Call" }]
  },
  "stock-order-entry": {
    "fill": 0.82, "focus": ".wshell", "pad": 20, "seconds": 6,
    "script": [
      { "wait": 700 }, { "label": "Increase Quantity" }, { "wait": 450 }, { "label": "Increase Quantity" },
      { "wait": 1900 }, { "label": "Decrease Quantity" }, { "wait": 450 }, { "label": "Decrease Quantity" }
    ]
  },
  "beam-ring": { "focus": ".bd-cta", "fill": 0.45, "pad": 0 },
  "notive-quote": { "focus": "img[alt=\"iPhone\"]", "fill": 0.92, "pad": 0 },
  /* The ticket opens on the $175 call. A price click replaces that leg,
     the next adds a second leg, and clicking a selected price removes it —
     so 185, +175, -185 shows all three and ends where it began. */
  "chain-to-order": {
    "fill": 0.84, "focus": ".ob-shell, [aria-label^=\"Buy 18\"], [aria-label^=\"Buy 17\"], [aria-label^=\"Sell 18\"], [aria-label^=\"Sell 17\"]",
    "pad": 18, "seconds": 6,
    "script": [
      { "wait": 700 }, { "click": "[aria-label^=\"Buy 185 call\"]" },
      { "wait": 1500 }, { "click": "[aria-label^=\"Buy 175 call\"]" },
      { "wait": 1800 }, { "click": "[aria-label^=\"Buy 185 call\"]" }
    ]
  }
};

