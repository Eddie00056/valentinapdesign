import { useState } from "react";
import { FractionalSharesBanner } from "./FractionalSharesBanner";

type Tab = "prototype" | "fractional";

const TABS: { id: Tab; label: string }[] = [
  { id: "prototype", label: "Prototype" },
  { id: "fractional", label: "Fractional animation" },
];

/**
 * Wrapper for /work/alert-prototype: a tab bar over the bundled prototype
 * (iframe) and a "Fractional animation" tab showing the Fractional Shares
 * Banner. The iframe stays mounted so the 1.9 MB bundle only unpacks once.
 */
export function AlertPrototypePage() {
  const [tab, setTab] = useState<Tab>("prototype");

  return (
    <div className="ap-root">
      <nav className="ap-bar">
        <a className="ap-glass ap-back" href="/" aria-label="Back to home">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M12.0833 15L7.08325 10L12.0833 5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>

        <div className="ap-glass ap-tabs" role="tablist" aria-label="View">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? "on" : undefined}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <iframe
        className="ap-frame"
        src="/prototypes/alert-creation"
        title="Alert creation prototype"
        style={{ display: tab === "prototype" ? "block" : "none" }}
      />

      <div className="ap-stage" hidden={tab !== "fractional"}>
        <FractionalSharesBanner />
      </div>
    </div>
  );
}
