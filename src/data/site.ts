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

// The gallery. One piece for now.
export const pieces: Piece[] = [
  {
    slug: "stock-option-toggle",
    href: "/work/stock-option-toggle",
    title: "Stock / Option toggle",
  },
];
