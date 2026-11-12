import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { QTY_VARIANTS, TradingLadder, type QtyVariant, type Session, type Treatment } from "./TradingLadder";
import { SEG_SPRING } from "../optionchain/motion";

type Opt<T extends string> = { id: T; name: string };
const SESSIONS: Opt<Session>[] = [
  { id: "regular", name: "Regular hours" },
  { id: "after", name: "After hours" },
];
type Summary = "text" | "pills" | "icons" | "morph";
type Width = "534" | "420" | "346";
const WIDTHS: Opt<Width>[] = [
  { id: "534", name: "Full 534" },
  { id: "420", name: "420" },
  { id: "346", name: "Mid 346" },
];
/* Header states (user, 2026-11-05): each opens the ladder fresh in it.
   "after" is "all" in the after-hours session, where Flatten's tooltip
   carries the market-hours copy; in regular hours it never mentions it. */
type HState = "all" | "empty" | "orders" | "position" | "after" | "orderBracket" | "posBracket";
const HSTATES: Opt<HState>[] = [
  { id: "empty", name: "Empty" },
  { id: "all", name: "All" },
  { id: "orders", name: "Orders only" },
  { id: "position", name: "Position only" },
  { id: "posBracket", name: "Filled → position + bracket" },
];
type Data = "normal" | "stress";
const DATA: Opt<Data>[] = [
  { id: "normal", name: "Normal" },
  { id: "stress", name: "Stress" },
];
const SUMMARIES: Opt<Summary>[] = [
  { id: "text", name: "Text" },
  { id: "pills", name: "Pills" },
  { id: "icons", name: "Icons (vision)" },
  { id: "morph", name: "Pill → icon" },
];
const TREATMENTS: Opt<Treatment>[] = [
  { id: "current", name: "Current" },
  { id: "proposed", name: "Proposed" },
];

/** Review harness: one live ladder under three
    switches — quantity placement, market session, and the after-hours
    treatment. Each rides the URL (?v=tip&s=after&t=current) so a link
    opens on exactly what it names. The ladder is never remounted, so
    orders, position and quantity carry across every switch. */
export function LadderVariants() {
  const [v, setV] = useState<QtyVariant>("tip");
  const [s, setS] = useState<Session>("regular");
  const [t, setT] = useState<Treatment>("proposed");
  const [sum, setSum] = useState<Summary>("pills");
  const [w, setW] = useState<Width>("534");
  const [data, setData] = useState<Data>("normal");
  const [hs, setHs] = useState<HState>("all");
  /* One quantity for the whole platform: the ladder and the chart share it. */
  const [qty, setQty] = useState(10);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const v0 = q.get("v"), s0 = q.get("s"), t0 = q.get("t"), p0 = q.get("p");
    if (p0 && SUMMARIES.some((x) => x.id === p0)) setSum(p0 as Summary);
    const h0 = q.get("h");
    if (h0 && HSTATES.some((x) => x.id === h0)) {
      setHs(h0 as HState);
      if (h0 === "after") setS("after");
    }
    const w0 = q.get("w"), d0 = q.get("d");
    if (w0 && WIDTHS.some((x) => x.id === w0)) setW(w0 as Width);
    if (d0 && DATA.some((x) => x.id === d0)) setData(d0 as Data);
    if (v0 && QTY_VARIANTS.some((x) => x.id === v0)) setV(v0 as QtyVariant);
    if (s0 && SESSIONS.some((x) => x.id === s0)) setS(s0 as Session);
    if (t0 && TREATMENTS.some((x) => x.id === t0)) setT(t0 as Treatment);
  }, []);

  const param = (k: string, val: string) => {
    const u = new URL(location.href);
    u.searchParams.set(k, val);
    history.replaceState(null, "", u);
  };

  const note =
    s === "regular"
      ? QTY_VARIANTS.find((x) => x.id === v)!.note
      : t === "current"
        ? "As shipped: nothing says the session changed — try Buy market, then hover Flatten"
        : "Session in the quote bar · market buttons say why on press · Flatten closes with a limit";

  const pickState = (id: HState) => {
    setHs(id);
    param("h", id);
    const sess: Session = id === "after" ? "after" : "regular";
    setS(sess);
    param("s", sess);
  };

  return (
    <div className="tlv">
      {/* The case study lives at /website/level-2 (user, 2026-11-05):
          this page is the prototype alone. */}
      <div className="tlv-demo">
      <div className="tlv-head">
        <div className="tlv-row">
          <Seg label="Header state" id="h" opts={HSTATES} value={hs} onPick={pickState} />
        </div>
        <div className="tlv-row">
          {/* Settled (user, 2026-11-05): quantity last, regular session
              unless the After hours preset, the proposed treatment, normal
              data — their switches are gone; the URL params still work. */}
          <Seg label="Header summary" id="p" opts={SUMMARIES} value={sum} onPick={(id) => (setSum(id), param("p", id))} />
          <Seg label="Width" id="w" opts={WIDTHS} value={w} onPick={(id) => (setW(id), param("w", id))} />
        </div>
        <p className="tlv-note">{note}</p>
      </div>
      <div className="tlv-stage">
        <TradingLadder
          key={`${data}-${hs === "after" ? "all" : hs}`}
          seed={hs === "after" ? "all" : hs}
          width={Number(w)}
          stress={data === "stress"}
          variant={v} qty={qty} onQty={setQty} session={s} treatment={t} summary={sum} />
      </div>
      </div>
    </div>
  );
}

function Seg<T extends string>({
  label,
  id,
  opts,
  value,
  onPick,
  disabled = false,
}: {
  label: string;
  id: string;
  opts: (Opt<T> & { k?: string })[];
  value: T;
  onPick: (v: T) => void;
  disabled?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="tlv-switch" role="radiogroup" aria-label={label} aria-disabled={disabled || undefined} data-off={disabled || undefined}>
      {opts.map((x) => (
        <button
          key={x.id}
          type="button"
          role="radio"
          aria-checked={value === x.id}
          disabled={disabled}
          className="tlv-opt"
          onClick={() => onPick(x.id)}
        >
          {value === x.id && (
            <motion.span layoutId={`tlv-on-${id}`} className="tlv-on" transition={reduce ? { duration: 0 } : SEG_SPRING} />
          )}
          {x.k && <span className="tlv-opt-k">{x.k}</span>}
          <span className="tlv-opt-n">{x.name}</span>
        </button>
      ))}
    </div>
  );
}
