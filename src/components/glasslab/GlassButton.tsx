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
  icon,
  children,
  type = "button",
  ...rest
}: GlassButtonProps) {
  const strokeClass =
    variant === "dark"
      ? "inner-stroke"
      : `inner-stroke inner-stroke--${variant}`;

  return (
    <button type={type} className={`btn btn--${variant}`} {...rest}>
      <span className={strokeClass} aria-hidden="true" />
      {icon}
      <span className="label">{children}</span>
    </button>
  );
}

/* ---- icons ---- */

function StarIcon() {
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

function BellIcon() {
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

/* ---- named buttons ---- */

type WrappedProps = Omit<GlassButtonProps, "icon" | "children"> & {
  label?: string;
};

export function WatchlistButton({ label = "Watchlist", ...rest }: WrappedProps) {
  return (
    <GlassButton icon={<StarIcon />} {...rest}>
      {label}
    </GlassButton>
  );
}

export function AlertButton({ label = "Alert", ...rest }: WrappedProps) {
  return (
    <GlassButton icon={<BellIcon />} {...rest}>
      {label}
    </GlassButton>
  );
}
