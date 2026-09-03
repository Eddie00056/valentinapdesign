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
