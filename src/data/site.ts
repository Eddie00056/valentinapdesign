// Site-wide content.

export const site = {
  name: "Valentina P.",
  domain: "valentinapdesign.com",
};

export type Piece = {
  slug: string;
  href: string;
  title: string;
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
  },
  {
    slug: "limit-order-error",
    href: "/work/limit-order-error",
    title: "Limit order error",
  },
  {
    slug: "fractional-shares-banner",
    href: "/work/fractional-shares-banner",
    title: "Fractional shares banner",
  },
  {
    slug: "alert-prototype",
    href: "/work/alert-prototype",
    title: "Alert creation prototype",
  },
  {
    slug: "alert-creation",
    href: "/work/alert-creation",
    title: "Alert creation",
  },
  {
    slug: "order-placement-boxed",
    href: "/work/order-placement-boxed",
    title: "Order placement",
  },
  {
    slug: "order-placed-animation",
    href: "/work/order-placed-animation",
    title: "Order placed animation",
  },
  {
    slug: "fractional-order-flow",
    href: "/work/fractional-order-flow",
    title: "Fractional order flow",
  },
  {
    slug: "options-strategy-builder",
    href: "/work/options-strategy-builder",
    title: "Options strategy builder",
  },
];
