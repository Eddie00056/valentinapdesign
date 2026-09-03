/* Single source of truth for the shared button icons.
   Edit an icon here and every page that renders it — glass-buttons,
   buttons-lab, the alert-creation screen — picks up the change on the
   next build. All icons: 20×20 default, viewBox 0 0 24 24, currentColor. */

export function StarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.6l2.6 5.27 5.82.85-4.21 4.1.99 5.8L12 17.9l-5.2 2.72.99-5.8-4.21-4.1 5.82-.85z"
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

/* "Fractional shares" — a circle with a wedge sliced out (a fraction of a
   whole). Thin-stroke SVG to match the rest of the set; replaces the bold
   PNG (Frame 1000006345) that sat heavy next to the others. */
export function FractionalIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 12V3.75M12 12l7.15 4.13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
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
