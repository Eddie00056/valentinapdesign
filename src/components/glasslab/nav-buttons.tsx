import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import "./nav-buttons.css";

/* iOS-style nav chrome: soft circular icon buttons. Low-contrast
   translucent fill, a whisper of an inset highlight, generous blur, no
   mask ring — reads calm on a real screen. Not grouped. */

function ArrowBackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M19 12H5M12 19l-7-7 7-7"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
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

function BellOutlineIcon() {
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

type BtnProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export function NavIconButton({
  icon,
  size = 44,
  style,
  ...props
}: BtnProps & { icon: ReactNode; size?: number }) {
  const merged: CSSProperties = { width: size, height: size, ...style };
  return (
    <button type="button" className="navbtn" style={merged} {...props}>
      {icon}
    </button>
  );
}

type NavWrapProps = BtnProps & { size?: number };

export function BackNavButton({
  "aria-label": al = "Back",
  size = 52,
  ...props
}: NavWrapProps) {
  return (
    <NavIconButton icon={<ArrowBackIcon />} size={size} aria-label={al} {...props} />
  );
}

export function WatchlistNavButton({
  "aria-label": al = "Add to watchlist",
  ...props
}: NavWrapProps) {
  return <NavIconButton icon={<StarFilledIcon />} aria-label={al} {...props} />;
}

export function AlertNavButton({
  "aria-label": al = "Create alert",
  ...props
}: NavWrapProps) {
  return <NavIconButton icon={<BellOutlineIcon />} aria-label={al} {...props} />;
}
