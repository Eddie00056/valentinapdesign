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

export type WebsitePage = {
  name: string;
  blurb: string;
  status: "todo" | "wip" | "live";
  href?: string;
};

// Content from the Framer site (valentinapadure.framer.website), being
// ported over one page at a time. Set `href` + status "live" as each lands.
export const websitePages: WebsitePage[] = [
  {
    name: "Home / intro",
    blurb: "Name, role, tagline — “I get shit work done”",
    status: "todo",
  },
  {
    name: "Questrade Pro",
    blurb: "Case study — redesigned the highest-impact feature; cut trade time 60%",
    status: "todo",
  },
  {
    name: "Fractional Shares",
    blurb: "Case study — end-to-end fractional trading; $33M revenue",
    status: "todo",
  },
  {
    name: "EdgeMobile",
    blurb: "Case study — Questrade’s top income-generating mobile platform",
    status: "todo",
  },
  {
    name: "Testimonials",
    blurb: "Four endorsements — Questrade, Wealthsimple, Microsoft",
    status: "todo",
  },
  {
    name: "Contact",
    blurb: "Email, phone, LinkedIn, availability",
    status: "todo",
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
];
