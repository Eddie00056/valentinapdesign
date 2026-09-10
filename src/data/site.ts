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
   * Viewport height, in px, that the gallery renders this piece's page at
   * behind a fixed 1280px width. It sets the tile's aspect ratio, so it is
   * how the masonry gets its variety: phone screens are tall, a toggle or
   * a banner is short. Nothing is cropped — the page's own background
   * becomes the tile's margin, which is what lets the UI float rather
   * than fill.
   */
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
    previewHeight: 640,
  },
  {
    slug: "limit-order-error",
    href: "/work/limit-order-error",
    title: "Limit order error",
    previewHeight: 640,
  },
  {
    slug: "fractional-shares-banner",
    href: "/work/fractional-shares-banner",
    title: "Fractional shares banner",
    previewHeight: 640,
  },
  {
    slug: "alert-prototype",
    href: "/work/alert-prototype",
    title: "Alert creation prototype",
    previewHeight: 900,
  },
  {
    slug: "alert-creation",
    href: "/work/alert-creation",
    title: "Alert creation",
    previewHeight: 900,
  },
  {
    slug: "order-placement-boxed",
    href: "/work/order-placement-boxed",
    title: "Order placement",
    previewHeight: 900,
  },
  {
    slug: "order-placed-animation",
    href: "/work/order-placed-animation",
    title: "Order placed animation",
    previewHeight: 900,
  },
  {
    slug: "fractional-order-flow",
    href: "/work/fractional-order-flow",
    title: "Fractional order flow",
    previewHeight: 980,
  },
  {
    slug: "options-strategy-builder",
    href: "/work/options-strategy-builder",
    title: "Options strategy builder",
    previewHeight: 720,
  },
  {
    slug: "option-chain",
    href: "/work/option-chain",
    title: "Option chain",
    previewHeight: 700,
  },
];
