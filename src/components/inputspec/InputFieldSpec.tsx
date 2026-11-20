import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { Check, Dropdown, PriceField, StepperField } from "../shared/TicketControls";
import { StackIcon } from "../glasslab/icons";
import "../optionsbuilder/options-builder.css";
import "../stockticket/stock-ticket.css";
import "./input-field-spec.css";

/* The input-field spec for the order tickets in the deck (the user's
   "Input field" board, rebuilt for OUR field): every cell is the real
   control from TicketControls — StepperField, PriceField, Dropdown — so the
   board can't drift from the tickets. States the ticket reaches by pointer
   or focus (hover, selected) are held with a class on the cell; the ones
   it doesn't have yet (error, disabled, read only) are the spec's own
   proposal, drawn on the same field. */

/* Updated to the final ticket (the user, 2026-11-19: "update the
   component design system page with the updated behaviour and design"):
   140 × 28, no ±0.01 arrows, the unit a one-tap toggle plate on the right,
   the value crossing over when it changes unit, the deck's colours. */
const SPRING = { type: "spring", stiffness: 500, damping: 34 } as const;
const UNITS = ["Shares", "Dollars"] as const;
const PX_UNITS = ["Dollar amount", "Percentage"] as const;
const LAST = 87.41;
const MARK: Record<string, ReactNode> = {
  Shares: <StackIcon size={13} stroke={2.21} />,
  Dollars: <span className="ob-dd-mark">$</span>,
};
const noop = () => {};

type Kind = "value" | "unit" | "price" | "select";
type State = "default" | "hover" | "selected" | "error" | "error-hover" | "error-selected" | "disabled" | "readonly";

const STATES: { k: State; name: string }[] = [
  { k: "default", name: "Default" },
  { k: "hover", name: "Hover" },
  { k: "selected", name: "Selected" },
  { k: "error", name: "Error" },
  { k: "error-selected", name: "Error selected" },
  { k: "disabled", name: "Disabled" },
  { k: "readonly", name: "Read only" },
];

/* the bare field, every kind × every state — one width (the ticket's 140),
   one left edge per column */
const ROWS: { k: Kind; name: string }[] = [
  { k: "value", name: "Value" },
  { k: "unit", name: "Unit toggle" },
  { k: "price", name: "Price toggle" },
  { k: "select", name: "Select" },
];

/* the field in a ticket line: label left, the same 140 field on the line's
   right edge (its own board, so the label never squeezes the field) */
const LINES: { k: Kind; name: string; label: string; sub?: string }[] = [
  { k: "unit", name: "Side label", label: "Quantity" },
  { k: "price", name: "Side label + caption", label: "Limit price", sub: "Bid $87.40  Ask $87.42" },
];
const LINE_STATES: State[] = ["default", "selected", "error", "error-selected"];

/** One of our fields, by kind — the real control, wired to nothing. */
function Field({ kind, live = false, bad = false }: { kind: Kind; live?: boolean; bad?: boolean }) {
  const reduce = useReducedMotion();
  // `bad`: an error example holds a value that breaks its rule
  const [qty, setQty] = useState(bad ? 0 : 10);
  const [unit, setUnit] = useState<string>("Shares");
  const [pxUnit, setPxUnit] = useState<string>("Dollar amount");
  const [price, setPrice] = useState(bad ? 0 : 87.41);
  const [dur, setDur] = useState("Good for day");
  if (kind === "value")
    return (
      <StepperField ariaLabel="Value" value={String(qty)} onChange={noop} onStep={noop} reduce={reduce} spring={SPRING} steppable={false} />
    );
  if (kind === "unit")
    return unit === "Dollars" ? (
      <PriceField
        ariaLabel="Amount"
        steppable={false}
        prefixCycle
        prefix={unit}
        prefixLabel={MARK[unit]}
        prefixOptions={UNITS}
        onPrefixSelect={live ? setUnit : noop}
        prefixIcon={(v) => MARK[v]}
        prefixAria="What the order is counted in"
        unitMorph={{ key: "Dollars", side: "prefix" }}
        value={qty * LAST}
        onCommit={noop}
        onStep={noop}
        reduce={reduce}
        spring={SPRING}
      />
    ) : (
      <StepperField
        ariaLabel="Quantity"
        steppable={false}
        prefixCycle
        prefix={unit}
        prefixLabel={MARK[unit]}
        prefixOptions={UNITS}
        onPrefixSelect={live ? setUnit : noop}
        prefixIcon={(v) => MARK[v]}
        prefixAria="What the order is counted in"
        unitMorph={{ key: "Shares", side: "suffix" }}
        value={String(qty)}
        onChange={(r) => live && setQty(Math.max(1, parseInt(r.replace(/\D/g, ""), 10) || 1))}
        onStep={noop}
        reduce={reduce}
        spring={SPRING}
      />
    );
  if (kind === "price") {
    const pct = pxUnit === "Percentage";
    return (
      <PriceField
        ariaLabel="Limit price"
        steppable={false}
        prefixCycle
        prefix={pxUnit}
        prefixLabel={pct ? "%" : "$"}
        prefixOptions={PX_UNITS}
        onPrefixSelect={live ? setPxUnit : noop}
        prefixIcon={(v) => <span className="ob-dd-mark">{v === "Percentage" ? "%" : "$"}</span>}
        prefixAria="What the limit price is set in"
        unitMorph={{ key: pxUnit, side: pct ? "suffix" : "prefix" }}
        decimals={pct ? 0 : 2}
        value={pct ? (bad ? 0 : 2) : price}
        onCommit={(v) => live && setPrice(v)}
        onStep={noop}
        reduce={reduce}
        spring={SPRING}
      />
    );
  }
  return (
    <Dropdown
      className="ob-field ob-field--switch"
      ariaLabel="Duration"
      value={dur}
      options={["Good for day", "Good till cancelled", "Extended hours"]}
      onSelect={(v) => live && setDur(v)}
    />
  );
}

const ERR: Record<Kind, string> = {
  value: "Enter a quantity of at least 1",
  unit: "Enter a quantity of at least 1",
  price: "Enter a price above $0.00",
  select: "Choose a duration",
};

/* The error message: under the field, on its left edge. When it shows
   follows the Atlas component library's text-field error rules (see the
   "Error rules" section): not before the field is used, live while typing,
   and it stays until the value is corrected. */
function Msg({ children }: { children: ReactNode }) {
  return (
    <p className="ifs-err" role="alert">
      {children}
    </p>
  );
}

/** A field in a held state, with its side label / caption / error line. */
function Cell({ kind, state, label, sub }: { kind: Kind; state: State; label?: string; sub?: string }) {
  const err = state === "error" || state === "error-selected" || state === "error-hover";
  return (
    /* a unit toggle's hover is the plate's alone (the user, 2026-11-19:
       "the hover treatment for the icon only") — the field keeps its fill */
    <div className={`ifs-cell ${state === "hover" && (kind === "unit" || kind === "price") ? "is-default is-plate-hover" : `is-${state}`}`} inert>
      <div className={label ? "ob-line ifs-line" : "ifs-solo"}>
        {label && (
          <span className="ob-line-k">
            <span className="ob-line-label">{label}</span>
            {sub && !err && <span className="ob-line-sub">{sub}</span>}
          </span>
        )}
        {/* the message hangs off the field itself: it starts on the
            field's left edge wherever the field sits */}
        <div className="ifs-fieldwrap">
          <Field kind={kind} bad={err && kind !== "select"} />
          {err && <Msg>{ERR[kind]}</Msg>}
        </div>
      </div>
    </div>
  );
}

/** The breakdown: the field with numbered callouts measured off its parts. */
function Breakdown() {
  const box = useRef<HTMLDivElement>(null);
  const [pins, setPins] = useState<{ n: number; x: number; y: number; side: "top" | "bottom" }[]>([]);
  useLayoutEffect(() => {
    const measure = () => {
      const b = box.current;
      if (!b) return;
      const o = b.getBoundingClientRect();
      // the art is zoomed: rects come back zoomed, positions inside it don't
      const z = parseFloat(getComputedStyle(b).zoom) || 1;
      const at = (sel: string) => b.querySelector(sel)?.getBoundingClientRect();
      const label = at(".ob-line-label");
      const sub = at(".ob-line-sub");
      const plate = at(".ob-cycle-chip");
      const num = at(".ob-field input");
      const field = at(".ob-field");
      if (!label || !sub || !plate || !num || !field) return;
      const X = (v: number) => (v - o.left) / z;
      const Y = (v: number) => (v - o.top) / z;
      const cx = (r: DOMRect) => X(r.left + r.width / 2);
      setPins([
        { n: 1, x: cx(label), y: Y(label.top), side: "top" },
        { n: 2, x: cx(sub), y: Y(sub.bottom), side: "bottom" },
        { n: 3, x: X(num.left + 12 * z), y: Y(field.top), side: "top" },
        { n: 4, x: cx(plate), y: Y(field.top), side: "top" },
        { n: 5, x: X(field.left + field.width * 0.55), y: Y(field.bottom), side: "bottom" },
      ]);
    };
    measure();
    const t = setTimeout(measure, 300);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, []);
  return (
    <div className="ifs-break">
      <div className="ifs-break-art" ref={box}>
        <div className="ifs-cell is-hover" inert>
          <div className="ob-line ifs-line">
            <span className="ob-line-k">
              <span className="ob-line-label">Quantity</span>
              <span className="ob-line-sub">≈ $874.10</span>
            </span>
            <Field kind="unit" />
          </div>
        </div>
        {pins.map((p) => (
          <span key={p.n} className={`ifs-pin is-${p.side}`} style={{ left: p.x, top: p.y }}>
            <i>{p.n}</i>
          </span>
        ))}
      </div>
      <ol className="ifs-legend">
        <li>Label</li>
        <li>Caption (optional) — a reading about the value; an error replaces it</li>
        <li>Value — typed; no arrows</li>
        <li>Unit toggle (optional) — the unit, on the right; one tap switches it</li>
        <li>Field fill</li>
      </ol>
    </div>
  );
}

function Menu() {
  return (
    <div className="ob-dd-menu ifs-menu" role="listbox">
      {["Good for day", "Good till cancelled", "Extended hours"].map((u) => (
        <div key={u} className="ob-dd-item" aria-selected={u === "Good for day"}>
          <span className="ob-dd-label">{u}</span>
          {u === "Good for day" && <Check />}
        </div>
      ))}
    </div>
  );
}

/* The example, live with the error rules (after Atlas):
   - no error until the field has been typed in or stepped; left empty, none
   - while active: the error updates as you type
   - leaving the field doesn't clear it: the message, rim and red value
     stay until the value is corrected — on every field in error */
function LiveExample() {
  const reduce = useReducedMotion();
  const [unit, setUnit] = useState<string>("Shares");
  const [pxUnit, setPxUnit] = useState<string>("Dollar amount");
  const [qty, setQty] = useState("10");
  const [price, setPrice] = useState("87.41");
  const [dur, setDur] = useState("Good for day");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<string | null>(null);
  /* the figure a unit switch replaced — the shares field and the dollars
     field are different fields, so the old one plays its exit here */
  const from = useRef<{ text: string; side: "prefix" | "suffix" } | undefined>(undefined);
  const touch = (k: string) => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));

  const qtyN = parseInt(qty, 10);
  const qtyErr = unit === "Shares" && touched.qty && qty.trim() !== "" && !(qtyN >= 1) ? ERR.unit : null;
  const pct = pxUnit === "Percentage";
  const pxNum = parseFloat(price.replace(/[^0-9.]/g, ""));
  const pxErr = touched.px && price.trim() !== "" && !(pxNum > 0) ? ERR.price : null;
  const errs: Record<string, string | null> = { qty: qtyErr, px: pxErr };
  const pickUnit = (v: string) => {
    from.current = unit === "Shares" ? { text: qty, side: "suffix" } : { text: ((qtyN || 0) * LAST).toFixed(2), side: "prefix" };
    setUnit(v);
  };
  /* each unit keeps its own value, so a round trip lands where it began
     (a whole-number % converted back would drift the price) */
  const other = useRef("2");
  const pickPx = (v: string) => {
    const was = price;
    setPrice(other.current);
    other.current = was;
    setPxUnit(v);
  };

  const wrap = (k: string, child: ReactNode) => (
    <div
      className={`ifs-fieldwrap${errs[k] ? " is-error" : ""}${active === k ? " is-active" : ""}`}
      onFocusCapture={() => setActive(k)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setActive((a) => (a === k ? null : a));
      }}
      onInputCapture={(e) => {
        const t = e.target as HTMLInputElement;
        if (t.tagName !== "INPUT") return;
        touch(k);
        if (k === "px") setPrice(t.value);
      }}
    >
      {child}
      {errs[k] && <Msg>{errs[k]}</Msg>}
    </div>
  );

  const common = {
    steppable: false,
    prefixCycle: true,
    prefixOptions: UNITS,
    onPrefixSelect: pickUnit,
    prefixIcon: (v: string) => MARK[v],
    prefixAria: "What the order is counted in",
    reduce,
    spring: SPRING,
  };
  return (
    <div className="ifs-example">
      <div className="ob-line ifs-line">
        <span className="ob-line-k">
          <span className="ob-line-label">{unit === "Dollars" ? "Amount" : "Quantity"}</span>
        </span>
        {wrap(
          "qty",
          unit === "Dollars" ? (
            <PriceField
              key="amount"
              {...common}
              ariaLabel="Amount"
              prefix={unit}
              prefixLabel={MARK[unit]}
              prefixRollIn
              unitMorph={{ key: "Dollars", side: "prefix" }}
              morphFrom={from.current}
              value={(qtyN || 0) * LAST}
              onCommit={(v) => setQty(String(Math.max(1, Math.round(v / LAST))))}
              onStep={noop}
            />
          ) : (
            <StepperField
              key="qty"
              {...common}
              ariaLabel="Quantity"
              prefix={unit}
              prefixLabel={MARK[unit]}
              prefixRollIn={!!from.current}
              unitMorph={{ key: "Shares", side: "suffix" }}
              morphFrom={from.current}
              value={qty}
              onChange={(r) => setQty(r.replace(/\D/g, ""))}
              onStep={noop}
            />
          ),
        )}
      </div>
      <div className="ob-line ifs-line">
        <span className="ob-line-k">
          <span className="ob-line-label">Limit price</span>
          <span className="ob-line-sub">Bid $87.40  Ask $87.42</span>
        </span>
        {wrap(
          "px",
          <PriceField
            ariaLabel="Limit price"
            steppable={false}
            prefixCycle
            prefix={pxUnit}
            prefixLabel={pct ? "%" : "$"}
            prefixOptions={PX_UNITS}
            onPrefixSelect={pickPx}
            prefixIcon={(v) => <span className="ob-dd-mark">{v === "Percentage" ? "%" : "$"}</span>}
            prefixAria="What the limit price is set in"
            unitMorph={{ key: pxUnit, side: pct ? "suffix" : "prefix" }}
            decimals={pct ? 0 : 2}
            value={pxNum > 0 ? pxNum : 0}
            onCommit={(v) => setPrice(pct ? String(Math.round(v)) : v.toFixed(2))}
            onStep={noop}
            reduce={reduce}
            spring={SPRING}
          />,
        )}
      </div>
      <div className="ob-line ifs-line">
        <span className="ob-line-k">
          <span className="ob-line-label">Duration</span>
        </span>
        <div className="ifs-fieldwrap">
          <Dropdown
            className="ob-field ob-field--switch"
            ariaLabel="Duration"
            value={dur}
            options={["Good for day", "Good till cancelled", "Extended hours"]}
            onSelect={setDur}
          />
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, note }: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section className="ifs-sec">
      <h2>{title}</h2>
      {note && <p className="ifs-sec-note">{note}</p>}
      <div className="ifs-panel">{children}</div>
    </section>
  );
}

export function InputFieldSpec() {
  return (
    <div className="ifs ob-stage st-stage" data-variant="cycle">
      <header className="ifs-head">
        <h1>Input field</h1>
        <div className="ifs-badges">
          <span className="ifs-badge">Order tickets</span>
          <span className="ifs-badge is-go">
            <i /> In the deck
          </span>
        </div>
      </header>

      <Section
        title="Example"
        note="Live, with the error rules — enter 0 in Quantity or Limit price, leave the field, then correct it. Tap a unit plate to switch the unit."
      >
        <LiveExample />
      </Section>

      <Section title="Breakdown">
        <Breakdown />
      </Section>

      <Section
        title="Variations + States"
        note="Hover and Selected are the tickets' own. Error, Disabled and Read only are proposed here — the tickets don't use them yet."
      >
        <div className="ifs-grid" style={{ ["--cols" as string]: STATES.length }}>
          <span />
          {STATES.map((s) => (
            <span key={s.k} className="ifs-colh">
              {s.name}
            </span>
          ))}
          {ROWS.map((r, ri) => (
            <div className="ifs-row" key={ri}>
              <span className="ifs-rowh">{r.name}</span>
              {STATES.map((s) => (
                <Cell key={s.k} kind={r.k} state={s.k} />
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section title="In a ticket line" note="The label takes the left; the field keeps its 140 on the line's right edge, as in the tickets.">
        <div className="ifs-lines">
          <span />
          {LINE_STATES.map((k) => (
            <span key={k} className="ifs-colh">
              {STATES.find((s) => s.k === k)!.name}
            </span>
          ))}
          {LINES.map((r, ri) => (
            <div className="ifs-row" key={ri}>
              <span className="ifs-rowh">{r.name}</span>
              {LINE_STATES.map((k) => (
                <Cell key={k} kind={r.k} state={k} label={r.label} sub={r.sub} />
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Spacing + height">
        <div className="ifs-dims">
          <figure>
            <div className="ifs-cell is-default ifs-measure" inert>
              <Field kind="unit" />
              <span className="ifs-h" />
            </div>
            <figcaption>140 × 28 · corner radius 4</figcaption>
          </figure>
          <dl className="ifs-specs">
            <div><dt>Size</dt><dd>140 × 28 — every control on both tickets, one width</dd></div>
            <div><dt>Radius</dt><dd>4px</dd></div>
            <div><dt>Value inset</dt><dd>6px left</dd></div>
            <div><dt>Unit toggle</dt><dd>20 × 20 plate, 4px in from the top, right and bottom · radius 2 · white 12%, 18% on hover · glyph centred</dd></div>
            <div><dt>Label → field</dt><dd>label column, fields on one right edge · 304 card, 10px sides · widest label row 12 clear of its field</dd></div>
            <div><dt>Label</dt><dd>DM Sans 12 / 400, white 60%</dd></div>
            <div><dt>Caption</dt><dd>under the label · Bid / Ask 5px apart, fixed-width figures so ticks never shift it</dd></div>
            <div><dt>Type</dt><dd>DM Sans 12 / 400</dd></div>
            <div><dt>Fill</dt><dd>#242424 · hover #383838 · pressed #434343</dd></div>
            <div><dt>Selected</dt><dd>fill #1E2920 · 1px rim #7ED68C</dd></div>
            <div><dt>Menu</dt><dd>4px under the field, its width · #141414, 1px white 10%, radius 6 · rows the field's height, 0 8 padding · check #7ED68C</dd></div>
            <div><dt>Error</dt><dd>red value #FF557D · fill #2C1921 · rim #F55278 (55% when inactive)</dd></div>
            <div><dt>Error message</dt><dd>6px under the field, on its left edge · 11px #FF557D</dd></div>
          </dl>
        </div>
      </Section>

      <Section title="Motion" note="One spring for every row, a short crossover for every value — nothing overshoots, and what shouldn't move holds still.">
        <dl className="ifs-rulelist">
          <div>
            <dt>Rows appear and leave</dt>
            <dd>A field an order type brings (or a bracket, or a leg) unrolls from 0 on one critically damped spring — 560 / 34 / 0.5 — fading in over 0.15s; leaving, it folds in place on the same spring, out in 0.14s with a 3px blur.</dd>
          </div>
          <div>
            <dt>One row replaces another</dt>
            <dd>Limit ↔ Stop: a crossfade in place — out in 0.12s, in over 0.16s. Nothing below moves.</dd>
          </div>
          <div>
            <dt>Unit toggle</dt>
            <dd>The plate changes at once. The value crosses over: out toward its old unit's side, in from the new one's — 3px over 0.18s, fading out in 0.1s (2px blur) and in over 0.16s, overlapping so the field never empties.</dd>
          </div>
          <div>
            <dt>Menu</dt>
            <dd>Unfolds from the field: from 96%, 4px up, tipped back 4°, settling in 0.2s on cubic-bezier(.22, 1.6, .36, 1), fading in 0.1s; closes in 0.08–0.1s. The chevron dips 1.5px on each click.</dd>
          </div>
          <div>
            <dt>Hover</dt>
            <dd>Fills ease in 0.15s; the unit plate 12% → 18%.</dd>
          </div>
          <div>
            <dt>Holds still</dt>
            <dd>The ticket's top stays put — it only grows downward; live figures sit in fixed-width boxes so a tick never shifts the layout.</dd>
          </div>
        </dl>
      </Section>

      <Section title="Error rules" note="From the Atlas component library's text-field errors, applied to this field.">
        <div className="ifs-rules">
          <dl className="ifs-rulelist">
            <div>
              <dt>Landing</dt>
              <dd>No error until the field has been used. Focused and left empty: still no error.</dd>
            </div>
            <div>
              <dt>While typing</dt>
              <dd>The error checks in real time as the value changes, and clears the moment it is valid.</dd>
            </div>
            <div>
              <dt>Leaving the field</dt>
              <dd>Nothing clears on blur: the message, the rim and the red value stay until the value is corrected.</dd>
            </div>
            <div>
              <dt>Several errors</dt>
              <dd>Each field carries its own message; correcting one leaves the others as they are.</dd>
            </div>
            <div>
              <dt>Where</dt>
              <dd>Under the field it belongs to, on its left edge — in the field's column, never under the label.</dd>
            </div>
            <div>
              <dt>Submit</dt>
              <dd>Never disabled. With errors present it changes nothing; empty required fields take their error.</dd>
            </div>
          </dl>
          <div className="ifs-errs">
            <div>
              <h3>While typing</h3>
              <Cell kind="unit" state="error-selected" label="Quantity" />
            </div>
            <div>
              <h3>After leaving the field</h3>
              <Cell kind="unit" state="error" label="Quantity" />
            </div>
            <div>
              <h3>Two fields in error</h3>
              <Cell kind="unit" state="error" label="Quantity" />
              <Cell kind="price" state="error-selected" label="Limit price" />
            </div>
            <div>
              <h3>One corrected</h3>
              <Cell kind="unit" state="default" label="Quantity" />
              <Cell kind="price" state="error" label="Limit price" />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Additional notes">
        <div className="ifs-notes">
          <div>
            <h3>Unit toggle</h3>
            <p>The unit sits in a plate on the right. One tap switches it — shares ⇄ dollars, $ ⇄ % — and the value converts.</p>
            <div className="ifs-cell is-default is-plate-hover" inert>
              <Field kind="unit" />
            </div>
          </div>
          <div>
            <h3>Masking</h3>
            <p>A dollar value always shows two decimals; a percentage is a whole number. Typing strips anything that isn't a digit or a point.</p>
            <div className="ifs-cell is-default" inert>
              <Field kind="price" />
            </div>
          </div>
          <div>
            <h3>No arrows</h3>
            <p>Values are typed or converted, not nudged: the ±0.01 arrows are gone, so the field is the value and its unit.</p>
            <div className="ifs-cell is-selected" inert>
              <Field kind="value" />
            </div>
          </div>
          <div>
            <h3>Select</h3>
            <p>A choice from a list. The menu drops 4px below, the field's width; its rows are the field's height, the chosen one checked.</p>
            <div className="ifs-cell is-select-open" inert>
              <Field kind="select" />
              <Menu />
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
