import { useLayoutEffect, useRef, useState } from "react";
import { FractionalOrderFlow } from "../fractionalflow/FractionalOrderFlow";
import "../fractionalflow/FractionalOrderFlow.css";

/* the flow's phone (bezel image included) */
const PHONE_W = 440.55;
const PHONE_H = 909.3;
/* share of the card's width the phone takes; the card's bottom edge cuts it
   off around the middle of the screen */
const FILL = 0.86;
/* gap above the phone, as a share of the card's width */
const TOP = 0.2;

/**
 * The live fractional order flow (/work/fractional-order-flow) — its entry
 * screen with the AAPL quote ticking — scaled to the card and anchored from
 * the top so the card crops the lower half. Look-only: the keypad and the
 * Review button sit below the crop, and the card itself is the link.
 */
export function FracFlowPhone() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = (FILL * w) / PHONE_W;

  return (
    <div ref={ref} className="frac-flow-fit" aria-hidden="true" inert>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: TOP * w,
          width: PHONE_W,
          height: PHONE_H,
          marginLeft: -PHONE_W / 2,
          transform: `scale(${scale})`,
          transformOrigin: "50% 0",
          visibility: w ? "visible" : "hidden",
        }}
      >
        <FractionalOrderFlow bgOpacity={0} />
      </div>
    </div>
  );
}
