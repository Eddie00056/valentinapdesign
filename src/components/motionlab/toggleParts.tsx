import type { ReactNode } from "react";
import type { MotionStyle } from "motion/react";
import { c, geo as defaultGeo, themed } from "./tokens";
import type { Geo, Side, Theme } from "./tokens";

// Figma places the pill at (-1, -1) so its 1px border sits exactly on top of
// the track's 1px border on the selected side (see node 88:5243).
export const pillStyle = (g: Geo = defaultGeo): MotionStyle => ({
  position: "absolute",
  top: -1,
  left: -1,
  width: g.seg,
  height: g.H,
  borderRadius: g.R,
  background: c.pillBg,
  border: `1px solid ${c.pillBorder}`,
  boxSizing: "border-box",
  zIndex: 0,
});

export const xFor = (v: Side, g: Geo = defaultGeo) => (v === "stock" ? 0 : g.travel);

export function FxSpan({
  children,
  active,
  fx,
}: {
  children: ReactNode;
  active: boolean;
  fx?: boolean;
}) {
  // The label only changes colour (via CSS transition on .lbl) — no movement.
  void active;
  void fx;
  return <span style={{ display: "inline-block" }}>{children}</span>;
}

export type FrameProps = {
  value: Side;
  onPick: (s: Side) => void;
  children: ReactNode;
  labelFx?: boolean;
  onPressSide?: (s: Side | null) => void;
  theme?: Theme;
  /** override the Figma-accurate 104x20 default (e.g. to stretch the toggle
      full-width elsewhere). */
  geo?: Geo;
  /** override the label font-size (px) independent of the track's own size. */
  labelFontSize?: number;
};

export function TrackFrame({
  value,
  onPick,
  children,
  labelFx,
  onPressSide,
  theme = "dark",
  geo: g = defaultGeo,
  labelFontSize,
}: FrameProps) {
  const t = themed(theme);
  return (
    <div
      className="track"
      role="radiogroup"
      aria-label="Stock or Option"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          onPick("option");
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          onPick("stock");
        }
      }}
      style={{
        width: g.W,
        height: g.H,
        borderRadius: g.R,
        border: `1px solid ${t.trackBorder}`,
      }}
    >
      {children}
      <div className="labels">
        {(["stock", "option"] as Side[]).map((side) => (
          <button
            key={side}
            type="button"
            className="lbl"
            role="radio"
            aria-checked={value === side}
            onClick={() => onPick(side)}
            onPointerDown={() => onPressSide?.(side)}
            onPointerUp={() => onPressSide?.(null)}
            onPointerLeave={() => onPressSide?.(null)}
            style={{
              color: value === side ? c.labelOn : t.labelOff,
              ...(labelFontSize != null ? { fontSize: labelFontSize } : null),
            }}
          >
            <FxSpan active={value === side} fx={labelFx}>
              {side === "stock" ? "Stock" : "Option"}
            </FxSpan>
          </button>
        ))}
      </div>
    </div>
  );
}
