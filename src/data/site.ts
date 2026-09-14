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
  {
    slug: "holdings-empty-state",
    href: "/work/holdings-empty-state",
    title: "Holdings magnifier",
    /* A 240px card: a viewport close to it so the card reads at about the
       size the small pieces do. */
    previewWidth: 560,
    previewHeight: 520,
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
    frame?: string;
    fill?: number | [number, number];
    ar?: number;
    minAr?: number;
    isolate?: string;
    css?: string;
    pad?: number | [number, number];
    maxH?: number;
    /** Cut the frame's bottom at the n-th `sel` fully inside `within` — between rows, never through one. */
    cut?: { sel: string; n: number; within?: string };
    seconds?: number;
    /** A scripted piece is filmed with the pointer in shot (tcosta.com's clips are); `false` hides it. */
    cursor?: boolean;
    /** x264 CRF for this clip; 18 unless a clip's motion is all large bitmaps. */
    crf?: number;
    /** Clip width; 1200 unless thin coloured strokes need the chroma resolution. */
    outW?: number;
    /** Record from this page instead of the piece's own (a widget that only picks where a ticket listens). */
    page?: string;
    pre?: Record<string, string | number>[];
    script?: Record<string, string | number>[];
  }
> = {
  /* Grounds: his light cards sit at #e4–#ec, never white — white glares on
     the black page — and his dark ones at #0a–#14 with a few phone pieces on
     true black. One soft grey for every light piece here.
     Size (`fill`, measured off tcosta.com/wspoc's cards and confirmed by the
     user twice): a button, toggle or icon takes 18–30% of the card's width;
     a widget, table or phone screen about 60–75%. Never edge to edge. */
  /* Card shape (`ar`, height per width) is chosen per piece and deliberately
     VARIED. One shared shape (930x639 for everything small) made every card
     the same height, and a masonry of equal heights is just rows — the thing
     that makes tcosta.com/wspoc read as a masonry is that its cards run
     0.61 to 1.27 tall from the very first row. Wide components get short
     cards, round or square ones tall cards; the component stays large in
     each (`fill`). */
  "stock-option-toggle": {
    "focus": "button.lbl", "fill": 0.2, "ar": 0.6, "pad": 0, "seconds": 5.5,
    "script": [{ "wait": 500 }, { "label": "Option" }, { "wait": 2100 }, { "label": "Stock" }]
  },
  "limit-order-error": {
    "focus": "[aria-label=\"Trigger limit order error\"]", "fill": 0.28, "ar": 0.76, "pad": 0, "seconds": 5.5,
    "css": ".pshell { background: #e8e8e8 !important; }",
    /* The pill toggles: a second tap clears the ring, so the loop closes on
       the plain pill (blurring the button never cleared it). */
    "script": [
      { "wait": 500 }, { "label": "Trigger limit order error" },
      { "wait": 2600 }, { "label": "Trigger limit order error" }
    ]
  },
  "fractional-shares-banner": {
    "focus": "[aria-label=\"Expand fractional shares banner\"], [aria-label=\"Collapse banner\"]",
    "fill": 0.55, "ar": 0.64, "pad": 0, "seconds": 5.5,
    "css": ".pshell { background: #e8e8e8 !important; }",
    "script": [{ "wait": 500 }, { "label": "Expand fractional shares banner" }, { "wait": 2200 }, { "label": "Collapse banner" }]
  },
  /* Only the candlesticks, moving slightly on the live price — no range
     changes. The whole chart stays visible (isolated, so no bezel or price
     text) because the candles themselves are static here: the movement is
     the dotted "now" line riding the price. The card is framed on the
     candles, so that line crosses it and its pill falls outside. */
  "alert-creation": {
    "focus": "svg[viewBox=\"0 0 393 188\"]",
    "isolate": "#000", "fill": 0.62, "ar": 0.84, "pad": 0, "seconds": 6.6
  },
  /* Only DASH and its live price: the two-line text column (found by its
     text — it is nothing but inline styles), isolated so neither the bid/ask
     pill under it nor the icon beside it comes along. Three ticks of the
     2.2s price clock. */
  "order-placement-boxed": {
    "focus": "js:[...document.querySelectorAll('span')].filter(e => e.children.length === 0 && (e.textContent.trim() === 'DASH' || e.textContent.trim() === 'Apple')).map(e => e.parentElement)",
    "isolate": "#000", "fill": 0.4, "ar": 0.6, "pad": 0, "seconds": 6.6, "outW": 1800,
    /* The card reads "Apple" with the Apple mark (user's ask, thumbnail only —
       the piece itself still trades DASH): the mark is the shared glyph from
       glasslab/icons.tsx, set inline before the symbol. React leaves both
       alone since the symbol text never changes between renders. */
    "pre": [
      { "eval": "window.__pxHub && window.__pxHub.restart(1100)" },
      { "eval": "(() => { const s = [...document.querySelectorAll('span')].find(e => e.children.length === 0 && e.textContent.trim() === 'DASH'); if (!s || s.previousSibling) return; s.textContent = 'Apple'; const i = document.createElement('span'); i.style.cssText = 'display:inline-flex;vertical-align:-3px;margin-right:7px;color:#fff'; i.innerHTML = '<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\"><path d=\"M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.088-4.61 1.088zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z\" fill=\"currentColor\"/></svg>'; s.parentElement.insertBefore(i, s); })()" }
    ]
  },
  /* Only the success mark, isolated from its caption. Its own loop is
     dur + 2600 = 4.6s, so one cycle loops seamlessly from any phase.
     The css flattens its 3D pop to the same beat in 2D: a preserve-3d layer
     under a perspective (and the phone's drop-shadow filter) is rasterized
     without antialiasing, which is what stair-stepped the ring. */
  "order-placed-animation": {
    "focus": ".opa-badge", "isolate": "#000", "fill": 0.32, "ar": 1.0, "pad": 0, "seconds": 4.6, "crf": 16,
    "css": ".opa-glow, .opa-ripple, .opa-ripple2, .opa-ring-fill { display: none !important; } .opa-phone { filter: none !important; } .opa-screen { perspective: none !important; } .opa-badge { transform-style: flat !important; animation-name: op-pop2d !important; } @keyframes op-pop2d { 0% { transform: scale(1); } 38% { transform: scale(1.12); } 70% { transform: scale(0.97); } 100% { transform: scale(1); } } .opa-badge { animation-timing-function: cubic-bezier(0.33, 0, 0.2, 1) !important; }"
  },
  /* Only the swap toggle between Total amount and Share quantity. Each tap
     spins the drawn arrows a half turn as they push apart (the swap), and
     the green arc draws round it and clears again. Two taps, back to start. */
  "fractional-order-flow": {
    "focus": "[aria-label=\"Swap amount and quantity\"]",
    "isolate": "#e8e8e8", "fill": 0.18, "ar": 1.0, "pad": 0, "seconds": 5, "cursor": false,
    "css": "[aria-label=\"Swap amount and quantity\"] > svg { display: none !important; }",
    "script": [
      { "wait": 700 }, { "click": "[aria-label=\"Swap amount and quantity\"]" },
      { "wait": 2300 }, { "click": "[aria-label=\"Swap amount and quantity\"]" }
    ]
  },
  "options-strategy-builder": {
    "fill": 0.72, "ar": 0.86, "focus": ".wshell", "pad": 0, "seconds": 6.5,
    "script": [
      { "wait": 700 }, { "label": "Increase Quantity" }, { "wait": 450 }, { "label": "Increase Quantity" },
      { "wait": 1900 }, { "label": "Decrease Quantity" }, { "wait": 450 }, { "label": "Decrease Quantity" }
    ]
  },
  /* The bid and ask pills lighting under the pointer and being picked. Only
     chain-to-order's copy of the chain picks (a ticket listens there), so
     the clip is filmed from that page with everything but the chain hidden.
     Bid 180 (sell), ask 185 (buy), then both again to unpick: the chain
     ends with no pill lit, as it began. */
  "option-chain": {
    "page": "/work/chain-to-order",
    "fill": 0.75, "ar": 0.58, "focus": ".oc-root", "isolate": "#141414", "pad": 0, "seconds": 8.5,
    "cut": { "sel": ".oc-row", "n": 7, "within": ".oc-scroll" },
    "script": [
      { "wait": 600 }, { "click": "[aria-label^=\"Sell 180 call\"]" },
      { "wait": 1300 }, { "click": "[aria-label^=\"Buy 185 call\"]" },
      { "wait": 1600 }, { "click": "[aria-label^=\"Sell 180 call\"]" },
      { "wait": 900 }, { "click": "[aria-label^=\"Buy 185 call\"]" }
    ]
  },
  /* Only the Quantity box — its unit prefix, the count and the arrows —
     counting 10 up to 13 and back down, so the loop ends where it began. */
  "stock-order-entry": {
    "focus": ".ob-stepper:has(input[aria-label=\"Quantity\"])", "isolate": "#0f1719",
    "fill": 0.32, "ar": 0.5, "pad": 0, "seconds": 8,
    "script": [
      { "wait": 600 }, { "label": "Increase Quantity" }, { "wait": 550 }, { "label": "Increase Quantity" }, { "wait": 550 }, { "label": "Increase Quantity" },
      { "wait": 1300 }, { "label": "Decrease Quantity" }, { "wait": 550 }, { "label": "Decrease Quantity" }, { "wait": 550 }, { "label": "Decrease Quantity" },
      { "wait": 500 }, { "leave": 1 }, { "eval": "document.activeElement && document.activeElement.blur()" }
    ]
  },
  "beam-ring": { "focus": ".bd-cta", "fill": 0.24, "ar": 0.62, "pad": 0 },
  /* The Apple mark and name, the ticking price (no "USD"), then the price
     line chart, on a flat ground — no phone, no change line, no fractional
     icon (user's picks). The change row is collapsed so the chart sits
     right under the price. Everything moves on the same clock tick. */
  "notive-quote": {
    "focus": "js:(() => { const p = [...document.querySelectorAll('.nq-root *')].find(e => e.style && e.style.fontSize === '35px'); if (!p) return []; const ticker = p.parentElement.previousElementSibling; return [ticker.children[0], ticker.children[1], p, document.querySelector('.nq-root svg[viewBox^=\"0 0 386\"]')]; })()",
    "isolate": "#e8e8e8", "fill": 0.68, "pad": 0, "seconds": 6.6,
    "pre": [{ "eval": "(() => { const p = [...document.querySelectorAll('.nq-root *')].find(e => e.style && e.style.fontSize === '35px'); const row = p && p.parentElement.nextElementSibling; if (row) row.style.display = 'none'; })()" }]
  },

  /* Only the leg rows, on the legs panel's own ground. The opening $175 leg
     is priced unlike the same strike picked off the chain, so `pre` swaps it
     for the chain's one first: then the loop — +180, +165 to three rows,
     -180, -165 back to one — ends exactly where it starts. */
  "chain-to-order": {
    "focus": ".ob-legs", "isolate": "#0f1719", "fill": 0.6, "ar": 0.5, "pad": 0, "seconds": 6.4,
    "pre": [
      { "click": "[aria-label^=\"Buy 180 call\"]" }, { "wait": 700 },
      { "click": "[aria-label^=\"Buy 175 call\"]" }, { "wait": 700 },
      { "click": "[aria-label^=\"Buy 180 call\"]" }, { "wait": 1200 }
    ],
    "script": [
      { "wait": 600 }, { "click": "[aria-label^=\"Buy 180 call\"]" },
      { "wait": 1000 }, { "click": "[aria-label^=\"Buy 165 call\"]" },
      { "wait": 1700 }, { "click": "[aria-label^=\"Buy 180 call\"]" },
      { "wait": 1000 }, { "click": "[aria-label^=\"Buy 165 call\"]" }
    ]
  },
  /* Only the four logos, drifting — no magnifier. The logos rest at 10% and
     only the glass shows them lit, so the thumbnail brings them to full
     strength itself. One 9s drift cycle (DRIFT_MS), so it loops seamlessly. */
  "holdings-empty-state": {
    "focus": ".he-scene:not(.he-scene--lit) .he-grid", "isolate": "#000",
    "css": ".he-lens { display: none !important; } .he-logo img { opacity: 1 !important; }",
    "fill": 0.18, "ar": 1.06, "pad": 0, "seconds": 9, "crf": 23
  }
};


