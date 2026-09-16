import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import "./ownership.css";

/* The "design ownership" build (deck slides 2–10): one stack of cards that
   gains a row per slide. Every slide renders the whole stack; the rows it
   already had on the slide before are drawn settled, and only the NEWEST
   row plays its entrance — on arrival, not at page load, because the deck
   keeps off-slides display:none and `whileInView` only fires once the slide
   is actually shown. Leaving and coming back replays it.

   Motion is discrete and settles: the numbers count up in ticks, the ticker
   pills bump on a clock and roll only the digits that changed, the icons
   pop once. Nothing crawls. Reduced motion: everything drawn settled. */

const OWN = "/website/case/gusto/own/tight/"; // the renders cropped to their ink
const RISE = { type: "spring", stiffness: 380, damping: 34 } as const;
const POP = { type: "spring", stiffness: 420, damping: 26 } as const;
const SNAP = [0.33, 1, 0.68, 1] as const;

type RowProps = { fresh: boolean; dim?: boolean; className?: string; children: ReactNode };

/** A row the closing slide fades to a quarter — on arrival, by a CSS
    transition off the in-view flag (compositor-driven, so it completes even
    where a frame loop would be throttled). */
function DimRow({ className, children }: { className?: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref, { amount: 0.2 });
  return (
    <div
      ref={ref}
      className={className}
      style={{ opacity: reduce || on ? 0.24 : 1, transition: reduce ? undefined : "opacity 0.6s ease" }}
    >
      {children}
    </div>
  );
}

/** A card row: springs up out of a blur when it is the slide's new row;
    fades on the closing slide; otherwise just sits there. */
function Row({ fresh, dim, className, children }: RowProps) {
  const reduce = useReducedMotion();
  if (dim) return <DimRow className={className}>{children}</DimRow>;
  if (reduce || !fresh) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ amount: 0.2 }}
      transition={{ y: RISE, opacity: { duration: 0.35, ease: SNAP }, filter: { duration: 0.45, ease: SNAP } }}
    >
      {children}
    </motion.div>
  );
}

/* ---- ticker pills ---------------------------------------------------- */

const CLOSE = 267.37; // previous close: the PDF pill reads +$3.64 on $271.01
const SEQ = [3, -2, 5, -4, 2, -1, 4, -3]; // cents, cycled — deterministic, small
const money = (v: number) => v.toFixed(2);

/** One string whose changed characters roll in from above or below. Each
    glyph sits in its own clipped cell; tabular figures keep the width. */
function Roll({ text, dir }: { text: string; dir: 1 | -1 }) {
  const prev = useRef(text);
  const was = prev.current;
  useEffect(() => {
    prev.current = text;
  }, [text]);
  return (
    <span className="gd-roll">
      {text.split("").map((ch, i) => {
        const changed = was[i] !== ch;
        return (
          <span className="gd-roll-cell" key={i}>
            <motion.span
              key={changed ? `${ch}-${text}` : ch}
              initial={changed ? { y: `${dir * -100}%`, opacity: 0 } : false}
              animate={{ y: "0%", opacity: 1 }}
              transition={{ duration: 0.32, ease: SNAP }}
              style={{ display: "inline-block" }}
            >
              {ch}
            </motion.span>
          </span>
        );
      })}
    </span>
  );
}

function Pill({ price, dir }: { price: number; dir: 1 | -1 }) {
  const chg = price - CLOSE;
  const pct = (chg / CLOSE) * 100;
  const sign = chg >= 0 ? "+" : "−";
  return (
    <span className="gd-pill">
      <b>
        $<Roll text={money(price)} dir={dir} />
      </b>{" "}
      <i className={chg >= 0 ? "" : "is-down"}>
        {sign}${money(Math.abs(chg))} {sign}
        {pct.toFixed(2)}%
      </i>
    </span>
  );
}

/** Four pills on one clock: every beat, the next pill takes the next step of
    SEQ. Runs only while the slide is on screen. */
function Pills({ live, count = 4 }: { live: boolean; count?: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2 });
  const [prices, setPrices] = useState<number[]>(() => Array(count).fill(271.01));
  const [dirs, setDirs] = useState<(1 | -1)[]>(() => Array(count).fill(1));
  const beat = useRef(0);
  useEffect(() => {
    if (!live || reduce || !inView) return;
    const id = window.setInterval(() => {
      const b = beat.current++;
      const step = SEQ[b % SEQ.length] / 100;
      const which = b % count;
      setPrices((p) => p.map((v, i) => (i === which ? Math.round((v + step) * 100) / 100 : v)));
      setDirs((d) => d.map((v, i) => (i === which ? (step > 0 ? 1 : -1) : v)));
    }, 1700);
    return () => window.clearInterval(id);
  }, [live, reduce, inView, count]);
  return (
    <div className="gd-own-pills" ref={ref}>
      {prices.map((p, i) => (
        <Pill key={i} price={p} dir={dirs[i]} />
      ))}
    </div>
  );
}

/* ---- metric ---------------------------------------------------------- */

/** "10+" counted up in ticks — a step every few frames, then it holds. The
    suffix lands after the last step. */
function Metric({ n, suffix = "", label, fresh }: { n: number; suffix?: string; label: string; fresh: boolean }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2 });
  const animate = fresh && !reduce;
  const [shown, setShown] = useState(animate ? 0 : n);
  const [done, setDone] = useState(!animate);
  useEffect(() => {
    if (!animate) return;
    if (!inView) {
      setShown(0);
      setDone(false);
      return;
    }
    const stepMs = Math.max(42, Math.round(520 / n));
    let v = 0;
    const id = window.setInterval(() => {
      v += 1;
      setShown(v);
      if (v >= n) {
        window.clearInterval(id);
        setDone(true);
      }
    }, stepMs);
    return () => window.clearInterval(id);
  }, [animate, inView, n]);
  return (
    <Row fresh={fresh} className="gd-own-card gd-own-metric">
      <div ref={ref} className="gd-own-metric-in">
        <span className="gd-own-n">
          {shown}
          <span className="gd-own-suffix" style={{ opacity: done ? 1 : 0 }}>
            {suffix}
          </span>
        </span>
        <motion.span
          className="gd-own-l"
          initial={animate ? { opacity: 0, x: -6 } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.25, ease: SNAP }}
        >
          {label}
        </motion.span>
      </div>
    </Row>
  );
}

/* ---- icon tiles ------------------------------------------------------ */

/* `h`: the render height that puts the icon's solid core in a 66px box
   (measured off each crop; the glow around it is what differs). `dx`/`dy`:
   the shift that centres that core in the tile — the bell's and Edge's
   glow is lopsided, so centring the file dropped their shapes. */
function Tile({ img, h = 84, dx = 0, dy = 0, label, fresh, dim = false, delay = 0, children }: { img?: string; h?: number; dx?: number; dy?: number; label: string; fresh: boolean; dim?: boolean; delay?: number; children?: ReactNode }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref, { amount: 0.2 });
  const pop = fresh && !reduce;
  /* `dim`: this tile fades on the closing slide while its neighbour stays
     lit (the focus is Questrade Pro and Fractional trading) — the same
     CSS-transition fade DimRow uses. */
  const fade = dim ? { opacity: reduce || on ? 0.24 : 1, transition: reduce ? undefined : "opacity 0.6s ease" } : undefined;
  /* No idle float: every slide renders its own stack, so a breathing icon
     restarted on each arrow and read as the icons moving between slides.
     The icon pops once, on the slide that brings it, and then sits. */
  return (
    <div ref={ref} className="gd-own-card gd-own-icon" style={fade}>
      {img ? (
        <span className="gd-own-float" style={{ translate: `${dx}px ${dy}px` }}>
          <motion.img
            src={img}
            alt=""
            style={{ height: h }}
            initial={pop ? { scale: 0.72, y: 8, opacity: 0 } : false}
            whileInView={{ scale: 1, y: 0, opacity: 1 }}
            viewport={{ amount: 0.2 }}
            transition={{ ...POP, delay: 0.12 + delay }}
          />
        </span>
      ) : (
        children
      )}
      <span>{label}</span>
    </div>
  );
}

/* ---- the stack ------------------------------------------------------- */

export function OwnershipStack({ reveal, dim = false }: { reveal: number; dim?: boolean }) {
  // row i is "fresh" on the slide that first shows it; on the dim slide nothing is new
  const fresh = (i: number) => !dim && reveal === i + 1;
  /* the closing slide fades every row but the two tile rows that hold the
     focus — Fractional trading (row 4) and Questrade Pro (row 5) — whose
     other tile fades on its own */
  const dimmed = (i: number) => dim && i !== 4 && i !== 5;
  return (
    <div className={`gd-own${dim ? " is-dim" : ""}`}>
      {reveal >= 1 && (
        <Row fresh={fresh(0)} dim={dimmed(0)} className="gd-own-card gd-own-head">
          <Pills live={!dim} />
          <p>Design ownership spread across highest revenue products</p>
        </Row>
      )}
      {reveal >= 2 && (
        <Row fresh={false} dim={dimmed(1)}>
          <Metric n={10} suffix="+" label="active trader features" fresh={fresh(1)} />
        </Row>
      )}
      {reveal >= 3 && (
        <Row fresh={fresh(2)} dim={dimmed(2)} className="gd-own-icons">
          <Tile img={`${OWN}adv-charting.webp`} h={68.5} label="Advanced charting" fresh={fresh(2)} />
          <Tile img={`${OWN}sym-alerts.webp`} h={104} dx={-2.5} dy={-17.2} label="Symbol alerts" fresh={fresh(2)} delay={0.08} />
        </Row>
      )}
      {reveal >= 4 && (
        <Row fresh={false} dim={dimmed(3)}>
          <Metric n={3} suffix="+" label="0→1 products launched" fresh={fresh(3)} />
        </Row>
      )}
      {reveal >= 5 && (
        <Row fresh={fresh(4)} dim={dimmed(4)} className="gd-own-icons">
          <Tile label="Real time streaming" fresh={fresh(4)} dim={dim}>
            <span className="gd-own-chip">
              <Pills live={!dim} count={1} />
            </span>
          </Tile>
          <Tile img={`${OWN}frac-trading.webp`} h={61} label="Fractional trading" fresh={fresh(4)} delay={0.08} />
        </Row>
      )}
      {reveal >= 6 && (
        <Row fresh={fresh(5)} dim={dimmed(5)} className="gd-own-icons">
          <Tile img={`${OWN}questrade-pro.webp`} h={69} label="Questrade Pro" fresh={fresh(5)} />
          <Tile img={`${OWN}edge-mobile.webp`} h={108} dx={19.3} dy={-19.3} label="Edge Mobile" fresh={fresh(5)} dim={dim} delay={0.08} />
        </Row>
      )}
      {reveal >= 7 && (
        <Row fresh={fresh(6)} dim={dimmed(6)} className="gd-own-card gd-own-team">
          <p>Led 4 Product Designers + Multiple team initiatives</p>
        </Row>
      )}
      {reveal >= 8 && (
        <Row fresh={false} dim={dimmed(7)}>
          <Metric n={2} label="awards" fresh={fresh(7)} />
        </Row>
      )}
    </div>
  );
}
