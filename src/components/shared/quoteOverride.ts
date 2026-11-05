/* A page can be asked to quote a different instrument: `?sym=HOOD&px=87.41`.
   The presentation passes it to every live widget it embeds, so the deck
   reads one symbol at one price while the gallery and case studies keep
   their own (DASH, PLTR). Read once, at module load, in the browser only —
   on the server (and with no params) every helper returns the default. */

const params =
  typeof location !== "undefined" ? new URLSearchParams(location.search) : null;

const px = params?.get("px");

/** The symbol asked for, or null. */
export const SYM_OVERRIDE: string | null = params?.get("sym")?.toUpperCase() || null;

/** The reference price asked for, or null. */
export const PX_OVERRIDE: number | null = px && Number.isFinite(+px) ? +px : null;

/** `def`, unless the page was asked for another symbol. */
export const symbolOr = (def: string) => SYM_OVERRIDE ?? def;

/** `def`, unless the page was asked for another price. */
export const priceOr = (def: number) => PX_OVERRIDE ?? def;

/** Moves a price that sits near `base` to the same place near the asked
    price, keeping its distance as a share of the price. */
export const rebase = (v: number, base: number) =>
  PX_OVERRIDE == null ? v : +((v / base) * PX_OVERRIDE).toFixed(2);

/** The names the deck may ask for, for the lines that print a company. */
export const NAMES: Record<string, string> = {
  HOOD: "Robinhood Markets",
};

/** Carries the override onto a URL this page loads in a frame. */
export const withOverride = (url: string) => {
  if (!SYM_OVERRIDE && PX_OVERRIDE == null) return url;
  const q = new URLSearchParams();
  if (SYM_OVERRIDE) q.set("sym", SYM_OVERRIDE);
  if (PX_OVERRIDE != null) q.set("px", String(PX_OVERRIDE));
  return url + (url.includes("?") ? "&" : "?") + q.toString();
};
