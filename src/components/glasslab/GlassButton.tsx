import type { ComponentProps, ReactNode } from "react";

export type GlassVariant =
  | "dark"
  | "light"
  | "cream"
  | "blue"
  | "green"
  | "red";

type GlassButtonProps = Omit<ComponentProps<"button">, "className"> & {
  variant?: GlassVariant;
  /**
   * "web" = 160×48 desktop pill;
   * "mobile" = iOS sizing (50pt tall labelled, or 24px with iconOnly);
   * "trade" = web-style pill at a fixed 71×32.
   */
  size?: "web" | "mobile" | "trade";
  /** Stretch to the container width (pair it with 16pt screen-edge insets on the parent). */
  block?: boolean;
  /** Drop the label, render a circular icon-only button. Caller must pass an aria-label. */
  iconOnly?: boolean;
  icon?: ReactNode;
  children: ReactNode;
};

/**
 * Glass pill button. One resting style per colour variant; the CSS
 * (glass-button.css) supplies the ::before ring and .inner-stroke highlight
 * plus hover / active / .dark-ancestor treatments.
 *
 * The importing page must also import ../components/glasslab/glass-button.css.
 */
export function GlassButton({
  variant = "dark",
  size = "web",
  block = false,
  iconOnly = false,
  icon,
  children,
  type = "button",
  ...rest
}: GlassButtonProps) {
  const strokeClass =
    variant === "dark"
      ? "inner-stroke"
      : `inner-stroke inner-stroke--${variant}`;

  const cls = [
    "btn",
    `btn--${variant}`,
    size === "mobile" && "btn--mobile",
    size === "trade" && "btn--trade",
    iconOnly && "btn--icon",
    block && !iconOnly && "btn--block",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={cls} {...rest}>
      <span className={strokeClass} aria-hidden="true" />
      {icon}
      {!iconOnly && <span className="label">{children}</span>}
    </button>
  );
}

/* ---- icons ---- */

export function StarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.6l2.6 5.27 5.82.85-4.21 4.1.99 5.8L12 17.9l-5.2 2.72.99-5.8-4.21-4.1 5.82-.85z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 8.5a6 6 0 1 0-12 0c0 6.5-2.6 8.5-2.6 8.5h17.2S18 15 18 8.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M10 20.5a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* Material Symbols "search" (opsz24, wght400) as an SVG so it takes the
   button's currentColor across variants. */
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

/* ---- named buttons ---- */

type WrappedProps = Omit<GlassButtonProps, "icon" | "children"> & {
  label?: string;
};

export function WatchlistButton({
  label = "Watchlist",
  iconOnly = false,
  ...rest
}: WrappedProps) {
  return (
    <GlassButton
      icon={<StarIcon />}
      iconOnly={iconOnly}
      aria-label={iconOnly ? "Add to watchlist" : undefined}
      {...rest}
    >
      {label}
    </GlassButton>
  );
}

export function AlertButton({
  label = "Alert",
  iconOnly = false,
  ...rest
}: WrappedProps) {
  return (
    <GlassButton
      icon={<BellIcon />}
      iconOnly={iconOnly}
      aria-label={iconOnly ? "Set alert" : undefined}
      {...rest}
    >
      {label}
    </GlassButton>
  );
}

/** Label-only web-style pill, fixed 71×32. */
export function TradeButton({
  label = "Trade",
  size = "trade",
  ...rest
}: WrappedProps) {
  return (
    <GlassButton size={size} {...rest}>
      {label}
    </GlassButton>
  );
}

/** Icon-only search action — same sizing as Watchlist / Alert. */
export function SearchButton({
  label = "Search",
  size = "mobile",
  ...rest
}: WrappedProps) {
  return (
    <GlassButton
      size={size}
      iconOnly
      icon={<SearchIcon />}
      aria-label={label}
      {...rest}
    >
      {label}
    </GlassButton>
  );
}
