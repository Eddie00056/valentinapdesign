/* Popover menu — the one Patchwork primitive this surface still needs.
   Styling lives in option-chain.css. */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MENU_MOTION, MENU_MOTION_REDUCED } from "../shared/TicketControls";

/* ------------------------------------------------------------------ */
/* Menu                                                                */
/* ------------------------------------------------------------------ */

/**
 * Popover menu. Closes on outside pointerdown and on Escape, and returns
 * focus to the trigger so keyboard users don't get dropped at the top of
 * the document.
 */
export function Menu({
  label,
  width = 240,
  direction = "left",
  triggerClass = "oc-btn",
  renderTrigger,
  children,
}: {
  label: string;
  /** A number is a fixed px width; "max-content" lets the list hug its
      widest row so there is no dead space beside the labels. */
  width?: number | string;
  direction?: "left" | "right";
  /** Class for the trigger itself — the menu owns the <button>, so the
      trigger content must never render one of its own (nested buttons). */
  triggerClass?: string;
  /** `kick` counts clicks on the trigger — hand it to the chevron's
      <Press> so it plays the tickets' press on each one. */
  renderTrigger: (state: { isOpen: boolean; kick: number }) => ReactNode;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [kick, setKick] = useState(0);
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback((refocus: boolean) => {
    setIsOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close(true);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, close]);

  return (
    <div className="oc-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClass}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => {
          setKick((k) => k + 1);
          setIsOpen((v) => !v);
        }}
      >
        {renderTrigger({ isOpen, kick })}
      </button>

      {/* the tickets' dropdown motion (TicketControls' MENU_MOTION), hinged
          at the corner the list hangs from */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={`oc-menu-list oc-menu-list--${direction}`}
            role="menu"
            aria-label={label}
            style={{
              width,
              transformOrigin: direction === "right" ? "top right" : "top left",
              transformPerspective: 800,
            }}
            {...(reduce ? MENU_MOTION_REDUCED : MENU_MOTION)}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MenuItem({
  onClick,
  label,
  disabled = false,
  children,
}: {
  onClick?: () => void;
  label: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="oc-menu-item"
      role="menuitem"
      aria-label={label}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
