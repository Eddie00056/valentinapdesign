import { useEffect, useState } from "react";

/* The amount / quantity switcher — the user's own component, as given.
   Tap flips both arrowheads; the deck taps it on a loop (slide 95).
   ?auto: it flips itself every two seconds (slide 89's top-left icon). */
export default function SwitchIcon() {
  const [active, setActive] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("auto")) return;
    const id = window.setInterval(() => setActive((a) => !a), 2000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <button
      className="si-btn"
      aria-label="Switch"
      onClick={() => setActive(!active)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", borderRadius: 12, border: "none", padding: 0,
        background: hovered ? "rgba(0,0,0,0.06)" : "none",
        transition: "background 0.15s ease",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M11.5 3V13" stroke="black" strokeWidth="1.8" strokeLinecap="round"
          style={{ transition: "all 0.2s ease" }} />
        <path d={active ? "M14 5.5L11.5 3L9 5.5" : "M14 10.5L11.5 13L9 10.5"}
          stroke="black" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: "all 0.2s ease" }} />
        <path d="M4.5 13L4.5 3" stroke="black" strokeWidth="1.8" strokeLinecap="round"
          style={{ transition: "all 0.2s ease" }} />
        <path d={active ? "M7 10.5L4.5 13L2 10.5" : "M7 5.5L4.5 3L2 5.5"}
          stroke="black" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: "all 0.2s ease" }} />
      </svg>
    </button>
  );
}
