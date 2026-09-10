import { useState } from "react";
import type { CSSProperties, ReactNode, Ref } from "react";
import "./widget-shell.css";

/* The two glyphs the bar needs, on the same 16px grid / 1.6 stroke as the
   rest of the trading-UI icon vocabulary. They live here rather than in a
   piece's own icon module because the bar is the only thing that draws
   them, and the bar is shared. */

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

/** Pop the widget out. */
export function LinkOut({ size = 14 }: { size?: number }) {
  return (
    <svg {...base(size)} strokeWidth={1.4}>
      <path d="M6.6 8.6a2.6 2.6 0 0 0 3.9.3l2-2a2.6 2.6 0 0 0-3.7-3.7l-1.1 1.1" />
      <path d="M9.4 7.4a2.6 2.6 0 0 0-3.9-.3l-2 2a2.6 2.6 0 0 0 3.7 3.7l1.1-1.1" />
    </svg>
  );
}

export function Close({ size = 15 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export interface WidgetShellProps {
  /** Shown in the bar. Also names the region for assistive tech. */
  title: string;
  /** Everything below the bar. The consumer owns its own padding. */
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClose?: () => void;
  /** For consumers that measure the card — the chain sizes a drag from it. */
  innerRef?: Ref<HTMLElement>;
}

/**
 * A floating widget: a dark card with a named bar across the top and a
 * pop-out / close pair at its right.
 *
 * The pop-out is deliberately inert beyond its own click glow — these are
 * interaction studies, and a control that actually detached the widget
 * would be a second surface to design. It is here because the chrome is
 * not honest without it.
 */
export function WidgetShell({
  title,
  children,
  className,
  style,
  onClose,
  innerRef,
}: WidgetShellProps) {
  /* Bumping this remounts the glow span, which restarts its one-shot
     keyframe — the same replay trick the order-placed animation uses. */
  const [glow, setGlow] = useState(0);

  return (
    <section
      className={className ? `wshell ${className}` : "wshell"}
      aria-label={title}
      style={style}
      ref={innerRef}
    >
      <header className="wshell-bar">
        <h2 className="wshell-title">{title}</h2>
        <div className="wshell-actions">
          <button
            type="button"
            className="wshell-btn wshell-linkout"
            aria-label="Open in a new window"
            onClick={() => setGlow((g) => g + 1)}
          >
            {glow > 0 && (
              <span key={glow} className="wshell-glow" aria-hidden="true" />
            )}
            <LinkOut size={14} />
          </button>
          <button
            type="button"
            className="wshell-btn"
            aria-label="Close"
            onClick={onClose}
          >
            <Close size={15} />
          </button>
        </div>
      </header>

      {children}
    </section>
  );
}
