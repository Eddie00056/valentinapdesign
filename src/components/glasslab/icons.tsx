/* Single source of truth for the shared button icons.
   Edit an icon here and every page that renders it — glass-buttons,
   buttons-lab, the alert-creation screen — picks up the change on the
   next build. All icons: 20×20 default, viewBox 0 0 24 24, currentColor. */

export function StarIcon() {
  // Clean, symmetric 5-point star (Material "star" proportions) — the old
  // hand-tuned polygon sat crooked.
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.5 L14.23 8.93 L21.03 9.06 L15.61 13.17 L17.58 19.69 L12 15.8 L6.42 19.69 L8.39 13.17 L2.97 9.06 L9.77 8.93 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StarFilledIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.4l2.7 5.47 6.04.88-4.37 4.26 1.03 6.01L12 17.25l-5.4 2.84 1.03-6.01L3.26 9.75l6.04-.88z"
        fill="currentColor"
      />
    </svg>
  );
}

export function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 8.5a6 6 0 1 0-12 0c0 6.5-2.6 8.5-2.6 8.5h17.2S18 15 18 8.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M10 20.3a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* Material Symbols "search" (opsz24, wght400). */
export function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path
        d="M20 20l-4.85-4.85"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* "Fractional shares" — the mark from the fractional order flow
   (public/prototypes/uploads/fof-fractional-icon.png), redrawn here so it
   scales and takes currentColor. A pie cut by a radius east and a radius
   south, with the missing quarter set down beside it, bottom-right.

   The geometry is not eyeballed: the PNG's outer ring was least-squares
   circle-fitted, then centre / radius / stroke were swept against the
   alpha mask for best overlap. The values below score IoU 0.93 against it,
   the remainder being antialiasing. An earlier hand-drawn version sat at
   r 7.5 with a 2 stroke — 11% small and a quarter too light — which is
   exactly why it read as a different icon next to the real one. */
export function FractionalIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18.31 9.87A8.46 8.46 0 1 0 9.85 18.33L9.85 9.87Z"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22.45 14A8.45 8.45 0 0 1 14 22.45L14 14Z"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Apple's mark, for the AAPL quote. Filled, not stroked — it is a logo,
   not a UI glyph, so it does not take the set's stroke weight; `size` is how
   it is balanced against the type it sits with. Two subpaths, body and leaf,
   on the standard 24-unit outline: a hand-approximated apple reads as a
   blob at 16px, where the notch and the leaf's angle are the whole
   silhouette. */
export function AppleIcon({ size = 20 }: { size?: number } = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.088-4.61 1.088zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * A stack — "Share quantity" on the mobile order screen, and the unit
 * mark on the stock ticket's size field.
 *
 * Drawn on a 24-unit grid, so `stroke` is in those units: at 16 it paints
 * 1.2, and anywhere else it has to be scaled to hold that weight. The
 * ticket renders it at 12 with a 2.4 stroke for exactly that reason.
 */
export function StackIcon({
  size = 16,
  stroke = 1.8,
}: {
  size?: number;
  stroke?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <ellipse cx="12" cy="6" rx="8" ry="3.2" stroke="currentColor" strokeWidth={stroke} />
      <path
        d="M4 6v6c0 1.77 3.58 3.2 8 3.2s8-1.43 8-3.2V6M4 12v6c0 1.77 3.58 3.2 8 3.2s8-1.43 8-3.2v-6"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Its pair — "Dollar amount" on the same screen. Same grid, same rule. */
export function DollarIcon({
  size = 16,
  stroke = 1.8,
}: {
  size?: number;
  stroke?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2v20M17 6.5c0-1.93-2.24-3.5-5-3.5s-5 1.57-5 3.5S9.24 10 12 10s5 1.57 5 3.5-2.24 3.5-5 3.5-5-1.57-5-3.5"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Material Symbols "arrow_back" (opsz24, wght400). */
export function ArrowBackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M19 12H5M12 19l-7-7 7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Material Symbols "close" (opsz24, wght400). Same 2px weight and round
   caps as SearchIcon / ArrowBackIcon so the header set reads as one row. */
export function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5.5 5.5l13 13M18.5 5.5l-13 13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
