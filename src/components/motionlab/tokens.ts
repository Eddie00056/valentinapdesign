// Values taken 1:1 from Figma node 1079-9860 (Wealthsimple playground).

export type Side = "stock" | "option";

/** Shape of the track geometry — lets a consumer pass a differently-sized
    track (e.g. a full-width instance elsewhere) while the default below
    stays Figma-accurate. */
export type Geo = {
  W: number; // track width
  H: number; // track height
  R: number; // corner radius
  seg: number; // pill / segment width
  travel: number; // px the pill moves between the two states
};

export const geo: Geo = {
  W: 104,
  H: 20,
  R: 6,
  seg: 52,
  travel: 52,
};

export const c = {
  trackBorder: "rgba(254,255,253,0.2)", // opacity/neutral-140a
  pillBg: "#0e231e", // colour/green/green-1900
  pillBorder: "#48d597", // colour/green/green-1100
  labelOn: "#41bf88",
  labelOff: "#ffffff",
} as const;

// The Figma component is drawn for a dark surface. On a light canvas the track
// chrome + the unselected label need dark equivalents (the green pill reads on
// both). Same weights, just inverted neutrals.
export type Theme = "dark" | "light";

export const themed = (theme: Theme) => ({
  trackBorder: theme === "light" ? "rgba(0,0,0,0.22)" : c.trackBorder,
  labelOff: theme === "light" ? "rgba(0,0,0,0.55)" : c.labelOff,
});
