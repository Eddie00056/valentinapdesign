// Central place for site-wide content. Edit these to change copy everywhere.

export const site = {
  name: "Valentina P.",
  domain: "valentinapdesign.com",
  role: "Brand & Digital Designer",
  tagline: "Selected work, experiments, and things in progress.",
  location: "TODO — city, country",
  email: "hello@valentinapdesign.com", // TODO — set the real address
  social: [
    { label: "Instagram", href: "https://instagram.com/" }, // TODO
    { label: "LinkedIn", href: "https://linkedin.com/in/" }, // TODO
    { label: "Are.na", href: "https://are.na/" }, // TODO
  ],
};

export type Piece = {
  slug: string;
  title: string;
  year: string;
  kind: string; // short tag, e.g. "Identity", "Website", "Print", "Motion"
  summary: string;
  cover?: string; // path under /public, e.g. "/work/solene/cover.jpg"
  accent?: string; // optional hex for the placeholder tile
};

// TODO — replace with real pieces. Order = display order (newest first).
export const pieces: Piece[] = [
  {
    slug: "solene-studio",
    title: "Solène Studio",
    year: "2025",
    kind: "Identity",
    summary: "Wordmark, packaging, and a slow catalogue site for a ceramics studio.",
    accent: "#c8624a",
  },
  {
    slug: "field-notes-journal",
    title: "Field Notes",
    year: "2025",
    kind: "Editorial",
    summary: "Type system and publishing platform for an independent design journal.",
    accent: "#3f5e57",
  },
  {
    slug: "north-loop-coffee",
    title: "North Loop Coffee",
    year: "2024",
    kind: "Packaging",
    summary: "Naming, identity, and retail packaging for a neighbourhood roaster.",
    accent: "#8a6d3b",
  },
  {
    slug: "atlas-fintech",
    title: "Atlas",
    year: "2024",
    kind: "Product",
    summary: "Design system and marketing site for a small fintech team.",
    accent: "#3d4a7a",
  },
  {
    slug: "grain-type",
    title: "Grain",
    year: "2024",
    kind: "Typeface",
    summary: "A work-in-progress text face with a low-contrast, humanist skeleton.",
    accent: "#5a4a5e",
  },
  {
    slug: "harbor-festival",
    title: "Harbor Festival",
    year: "2023",
    kind: "Poster",
    summary: "Identity and a run of risograph posters for a two-day music festival.",
    accent: "#b5453b",
  },
  {
    slug: "meridian-report",
    title: "Meridian Annual Report",
    year: "2023",
    kind: "Print",
    summary: "120-page report — data visualisation, grid, and photographic direction.",
    accent: "#2f5d63",
  },
  {
    slug: "loop-motion-study",
    title: "Loop",
    year: "2023",
    kind: "Motion",
    summary: "A short set of looping type animations exploring rhythm and weight.",
    accent: "#6b6152",
  },
  {
    slug: "verdant-app",
    title: "Verdant",
    year: "2022",
    kind: "Website",
    summary: "Brand refresh and marketing site for a plant-care subscription.",
    accent: "#3f6b45",
  },
];
