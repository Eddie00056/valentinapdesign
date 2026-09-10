/* Popover menu — the one Patchwork primitive this surface still needs.
   Styling lives in option-chain.css. */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

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
  renderTrigger: (state: { isOpen: boolean }) => ReactNode;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
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
        onClick={() => setIsOpen((v) => !v)}
      >
        {renderTrigger({ isOpen })}
      </button>

      {isOpen && (
        <div
          className={`oc-menu-list oc-menu-list--${direction}`}
          role="menu"
          aria-label={label}
          style={{ width }}
        >
          {children}
        </div>
      )}
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
