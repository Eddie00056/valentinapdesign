import { useMemo } from "react";
import { OrderBar } from "./OrderBar";
import { FlattenIcon, SlashIcon, QTY_HINT, type QtyVariant, type Session, type Treatment } from "./TradingLadder";

/** A stand-in chart surface for the quantity study: the platform's chart
    window, with the shared OrderBar floated top-left in compact fit —
    the same component, the same quantity, as the ladder beside it. The
    candles are a static deterministic sketch; only the bar is live. */
export function ChartPreview({
  qty,
  onQty,
  onBuy,
  onSell,
  variant,
  session = "regular",
  treatment = "proposed",
}: {
  variant: QtyVariant;
  session?: Session;
  treatment?: Treatment;
  qty: number;
  onQty: (n: number) => void;
  onBuy?: () => void;
  onSell?: () => void;
}) {
  const W = 534;
  const H = 300;
  const AXIS = 64;
  const candles = useMemo(() => {
    let p = 118.1;
    const out: { o: number; c: number; h: number; l: number }[] = [];
    for (let i = 0; i < 46; i++) {
      const r = Math.sin(i * 1.7) * 0.5 + Math.sin(i * 0.37) * 0.8 + Math.cos(i * 2.9) * 0.3;
      const o = p;
      const c = p + r * 0.05 + 0.006;
      const h = Math.max(o, c) + Math.abs(Math.sin(i * 3.1)) * 0.04;
      const l = Math.min(o, c) - Math.abs(Math.cos(i * 2.3)) * 0.04;
      out.push({ o, c, h, l });
      p = c;
    }
    /* End on the ladder's price so the two surfaces agree. */
    const d = 118.45 - p;
    return out.map((k) => ({ o: k.o + d, c: k.c + d, h: k.h + d, l: k.l + d }));
  }, []);
  const lo = Math.min(...candles.map((k) => k.l)) - 0.05;
  /* Headroom so the floated bar never sits on the candles. */
  const hi = Math.max(...candles.map((k) => k.h)) + 0.22;
  const y = (v: number) => ((hi - v) / (hi - lo)) * H;
  const step = (W - AXIS - 12) / candles.length;
  const last = candles[candles.length - 1].c;
  const ticks = Array.from({ length: 6 }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / 6);

  return (
    <section className="tl-root tlc" aria-label="Chart with the shared order bar">
      <div className="tl-bar-top">
        <span className="tl-win" aria-hidden="true">
          <span />
        </span>
        <span className="tl-sym">
          <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="m11 11 3.2 3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span>HOOD</span>
        </span>
        <span className="tl-quote">
          <span className="tl-quote-chg" data-dir="up">▲ 1.52</span>
        </span>
      </div>
      <div className="tlc-plot">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {ticks.filter((t) => Math.abs(y(t) - y(last)) > 18).map((t) => (
            <text key={t} x={W - 8} y={y(t) + 4} textAnchor="end" className="tlc-axis">
              {t.toFixed(2)}
            </text>
          ))}
          <line x1={0} x2={W - AXIS} y1={y(last)} y2={y(last)} className="tlc-last-line" />
          {candles.map((k, i) => {
            const x = 6 + i * step + step / 2;
            const up = k.c >= k.o;
            return (
              <g key={i} className={up ? "tlc-up" : "tlc-dn"}>
                <line x1={x} x2={x} y1={y(k.h)} y2={y(k.l)} />
                <rect x={x - step * 0.3} width={step * 0.6} y={y(Math.max(k.o, k.c))} height={Math.max(1, Math.abs(y(k.o) - y(k.c)))} />
              </g>
            );
          })}
          <rect x={W - AXIS + 2} y={y(last) - 11} width={AXIS - 6} height={22} rx={3} className="tlc-last-tag" />
          <text x={W - 8} y={y(last) + 4} textAnchor="end" className="tlc-last-tx">
            {last.toFixed(2)}
          </text>
        </svg>
        <div className="tlc-bar">
          <OrderBar
            qty={qty}
            onQty={onQty}
            onBuy={onBuy ?? (() => {})}
            onSell={onSell ?? (() => {})}
            fit="compact"
            order={variant === "lead" ? "lead" : "trail"}
            hint={variant === "tip" ? QTY_HINT : undefined}
            blocked={
              session === "after"
                ? { reason: "Market orders open at 9:30 AM ET. You can trade now with a limit order.", explain: treatment === "proposed" }
                : undefined
            }
            label="MKT"
            trailing={
              <button type="button" className="tlc-flat" aria-label="Flatten">
                {treatment === "current" ? <SlashIcon /> : <FlattenIcon />}
              </button>
            }
          />
        </div>
      </div>
    </section>
  );
}
