import type { ReactNode } from "react";

/* Minimal focused-canvas chrome for the glass pieces: a white stage with a
   single glass back button (top-left) that returns to the site home page.
   Mirrors the toggle demo's shell, without the sound / theme controls those
   pieces don't use. */

function IconBack() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M12.0833 15L7.08325 10L12.0833 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PieceShell({ children }: { children: ReactNode }) {
  return (
    <div className="pshell">
      <nav className="pshell-nav">
        <button
          type="button"
          className="pshell-glass pshell-back"
          aria-label="Back to home"
          onClick={() => {
            window.location.href = "/";
          }}
        >
          <IconBack />
        </button>
      </nav>
      <div className="pshell-stage">{children}</div>
    </div>
  );
}
