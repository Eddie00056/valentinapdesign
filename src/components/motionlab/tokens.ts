// Values taken 1:1 from Figma node 1079-9860 (Wealthsimple playground).

export type Side = "stock" | "option";

export const geo = {
  W: 104, // track width
  H: 20, // track height
  R: 6, // corner radius
  seg: 52, // pill / segment width
  travel: 52, // px the pill moves between the two states
} as const;

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
