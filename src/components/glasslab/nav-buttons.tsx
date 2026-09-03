import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import "./nav-buttons.css";
import { ArrowBackIcon, StarFilledIcon, BellIcon } from "./icons";

export { StarFilledIcon } from "./icons";

/* Flat nav buttons: a separate, glass-free variation. Solid low-contrast
   circular fill, no blur / no ring / no shadow. Never grouped. */

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
  return <NavIconButton icon={<BellIcon />} aria-label={al} {...props} />;
}
