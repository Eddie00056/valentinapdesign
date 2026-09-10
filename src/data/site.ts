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

// The gallery, in display order.
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
    slug: "alert-prototype",
    href: "/work/alert-prototype",
    title: "Alert creation prototype",
    previewWidth: 900,
    previewHeight: 900,
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
];
