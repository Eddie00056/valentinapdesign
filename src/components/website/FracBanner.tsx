import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { FractionalSharesBanner } from "../glasslab/FractionalSharesBanner";
import { LimitOrderError } from "../glasslab/LimitOrderError";

/* the banner's open bar is 616 wide and takes this share of its card */
const BAR_W = 616;
const BAR_FILL = 0.88;
/* the banner sets in 21px, the pill in 17px (both DM Sans): the pill is
   drawn 21/17 bigger so the two cards' type is 1:1 */
const PILL_BOOST = 21 / 17;

/**
 * A glasslab piece on its fixed stage, centred in its card and scaled with
 * the card's width (`k` × card width = scale).
 */
function Fit({ w, h, k, children }: { w: number; h: number; k: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(k * e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [k]);

  return (
    <div ref={ref} className="frac-fit" aria-hidden="true">
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: w,
          height: h,
          marginLeft: -w / 2,
          marginTop: -h / 2,
          transform: `scale(${scale})`,
          visibility: scale ? "visible" : "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** The live fractional-shares banner (/work/fractional-shares-banner), looping. */
export function FracBanner() {
  return (
    <Fit w={680} h={160} k={BAR_FILL / BAR_W}>
      <FractionalSharesBanner auto />
    </Fit>
  );
}

/** The live limit-order pill and its error ring (/work/limit-order-error), looping. */
export function FracPill() {
  return (
    <Fit w={400} h={160} k={(PILL_BOOST * BAR_FILL) / BAR_W}>
      <LimitOrderError auto />
    </Fit>
  );
}
