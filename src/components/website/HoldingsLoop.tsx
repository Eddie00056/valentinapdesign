import { useLayoutEffect, useRef, useState } from "react";
import { HoldingsMagnifier } from "../holdings/HoldingsMagnifier";
import "../holdings/holdings-magnifier.css";

/* the piece's card is a fixed 240×240 */
const CARD = 240;
/* the card drawn at 0.95× the slot's height: its ground matches the slot,
   so only the cluster shows — at ~30% of the slot, in scale with the bell
   and the ticket beside it — and the margin the glass never reaches is
   clipped */
const FILL = 0.95;

/**
 * The holdings magnifier (/work/holdings-empty-state) — its logos as a
 * cluster of sizes, the glass wandering them on its own 8s loop — scaled to
 * its slot. Look-only: the
 * card it sits in is the project link.
 */
export function HoldingsLoop({ fill = FILL }: { fill?: number } = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setScale(
        Math.min(fill * e.contentRect.height, fill * e.contentRect.width) / CARD,
      ),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill]);

  return (
    <div ref={ref} className="holdings-fit" aria-hidden="true" inert>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: CARD,
          height: CARD,
          marginLeft: -CARD / 2,
          marginTop: -CARD / 2,
          transform: `scale(${scale})`,
          visibility: scale ? "visible" : "hidden",
        }}
      >
        <HoldingsMagnifier auto cluster wanderMs={8000} />
      </div>
    </div>
  );
}
