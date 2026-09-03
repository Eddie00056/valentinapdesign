import type { ComponentProps, ReactNode } from "react";
import {
  StarIcon,
  BellIcon,
  SearchIcon,
  ArrowBackIcon,
  FractionalIcon,
} from "./icons";

export {
  StarIcon,
  StarFilledIcon,
  BellIcon,
  SearchIcon,
  ArrowBackIcon,
  FractionalIcon,
} from "./icons";

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

/** Icon-only fractional-shares action — same sizing as Watchlist / Alert. */
export function FractionalButton({
  label = "Fractional shares",
  size = "mobile",
  ...rest
}: WrappedProps) {
  return (
    <GlassButton
      size={size}
      iconOnly
      icon={<FractionalIcon />}
      aria-label={label}
      {...rest}
    >
      {label}
    </GlassButton>
  );
}

/** Icon-only mobile back button. */
export function BackButton({
  label = "Back",
  size = "mobile",
  ...rest
}: WrappedProps) {
  return (
    <GlassButton
      size={size}
      iconOnly
      icon={<ArrowBackIcon />}
      aria-label={label}
      {...rest}
    >
      {label}
    </GlassButton>
  );
}
