/* UI chrome icons for the option chain.

   Distinct vocabulary from `glasslab/icons.tsx` (that module is the single
   source of truth for the mobile glass-button set — star / bell / search /
   fractional / back — and stays that way). Everything here is a 16px grid,
   1.6 stroke, `currentColor`, sized by the `size` prop. */

type Props = { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 16 16",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
});

export function ChevronDown({ size = 14 }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M4 6.5 8 10.5 12 6.5" />
    </svg>
  );
}

export function ChevronUp({ size = 14 }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M4 9.5 8 5.5 12 9.5" />
    </svg>
  );
}

/* The horizontal pair used to be drawn 4 across by 4.5 tall while the
   vertical pair was 4 by 4 — so a left/right chevron carried a 6% longer
   arm than an up/down one at the same `size`, and sat half a unit off the
   viewBox's centre. Every chevron here is now the same ±4 on both axes,
   which is what lets two of them at the same `size` actually match. */
export function ChevronLeft({ size = 14 }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M10 4 6 8l4 4" />
    </svg>
  );
}

export function ChevronRight({ size = 14 }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M6 4 10 8l-4 4" />
    </svg>
  );
}

export function Close({ size = 13 }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function Info({ size = 12 }: Props) {
  return (
    <svg {...base(size)}>
      <circle cx="8" cy="8" r="5.75" />
      <path d="M8 7.25v3.5M8 5.4v.1" />
    </svg>
  );
}

/** Spot-price marker. */

export function Search({ size = 13 }: Props) {
  return (
    <svg {...base(size)}>
      <circle cx="7.2" cy="7.2" r="4.4" />
      <path d="M10.6 10.6 13.6 13.6" />
    </svg>
  );
}

/** Pop the widget out. */
export function LinkOut({ size = 14 }: Props) {
  return (
    <svg {...base(size)} strokeWidth={1.4}>
      <path d="M6.6 8.6a2.6 2.6 0 0 0 3.9.3l2-2a2.6 2.6 0 0 0-3.7-3.7l-1.1 1.1" />
      <path d="M9.4 7.4a2.6 2.6 0 0 0-3.9-.3l-2 2a2.6 2.6 0 0 0 3.7 3.7l1.1-1.1" />
    </svg>
  );
}

export function Check({ size = 12 }: Props) {
  return (
    <svg {...base(size)} strokeWidth={2}>
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
  );
}
