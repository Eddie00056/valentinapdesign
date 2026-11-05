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

const SPRING = { type: "spring", stiffness: 500, damping: 34 } as const;
const UNITS = ["Shares", "Dollars"] as const;
const MARK: Record<string, ReactNode> = {
  Shares: <StackIcon size={13} stroke={2.21} />,
  Dollars: <span className="ob-dd-mark">$</span>,
};
const noop = () => {};

type Kind = "value" | "stepper" | "price" | "prefix" | "select";
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

/* the bare field, every kind × every state — one width (the ticket's 168),
   one left edge per column */
const ROWS: { k: Kind; name: string }[] = [
  { k: "value", name: "Value" },
  { k: "stepper", name: "Stepper" },
  { k: "price", name: "Currency" },
  { k: "prefix", name: "Clickable prefix" },
  { k: "select", name: "Select" },
];

/* the field in a ticket line: label left, the same 168 field on the line's
   right edge (its own board, so the label never squeezes the field) */
const LINES: { k: Kind; name: string; label: string; sub?: string }[] = [
  { k: "stepper", name: "Side label", label: "Quantity" },
  { k: "price", name: "Side label + caption", label: "Limit price", sub: "Mid $19.84" },
];
const LINE_STATES: State[] = ["default", "selected", "error", "error-selected"];

/** One of our fields, by kind — the real control, wired to nothing. */
function Field({ kind, live = false, bad = false }: { kind: Kind; live?: boolean; bad?: boolean }) {
  const reduce = useReducedMotion();
  // `bad`: an error example holds a value that breaks its rule
  const [qty, setQty] = useState(bad ? 0 : 10);
  const [unit, setUnit] = useState<string>("Shares");
  const [price, setPrice] = useState(bad ? 0 : 19.84);
  const [dur, setDur] = useState("Good for day");
  if (kind === "value")
    return (
      <StepperField ariaLabel="Value" value={String(qty)} onChange={noop} onStep={noop} reduce={reduce} spring={SPRING} steppable={false} />
    );
  if (kind === "stepper")
    return (
      <StepperField
        ariaLabel="Quantity"
        value={String(qty)}
        onChange={(r) => live && setQty(Math.max(1, parseInt(r.replace(/\D/g, ""), 10) || 1))}
        onStep={(d) => live && setQty((q) => Math.max(1, q + d))}
        reduce={reduce}
        spring={SPRING}
      />
    );
  if (kind === "price")
    return (
      <PriceField
        ariaLabel="Limit price"
        value={price}
        onCommit={(v) => live && setPrice(v)}
        onStep={(d) => live && setPrice((p) => +(p + d * 0.01).toFixed(2))}
        reduce={reduce}
        spring={SPRING}
      />
    );
  if (kind === "prefix")
    return (
      <StepperField
        ariaLabel="Quantity"
        prefix={unit}
        prefixLabel={MARK[unit]}
        prefixOptions={live ? UNITS : undefined}
        onPrefixSelect={live ? setUnit : undefined}
        prefixIcon={(v) => MARK[v]}
        prefixAria="What the order is counted in"
        value={String(qty)}
        onChange={(r) => live && setQty(Math.max(1, parseInt(r.replace(/\D/g, ""), 10) || 1))}
        onStep={(d) => live && setQty((q) => Math.max(1, q + d))}
        reduce={reduce}
        spring={SPRING}
      />
    );
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
  stepper: "Enter a quantity of at least 1",
  prefix: "Enter a quantity of at least 1",
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
    <div className={`ifs-cell is-${state}`} inert>
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
      const k = at(".ob-field-k");
      const num = at(".ob-field input");
      const step = at(".ob-stepper-btns");
      const field = at(".ob-field");
      if (!label || !sub || !k || !num || !step || !field) return;
      const X = (v: number) => (v - o.left) / z;
      const Y = (v: number) => (v - o.top) / z;
      const cx = (r: DOMRect) => X(r.left + r.width / 2);
      setPins([
        { n: 1, x: cx(label), y: Y(label.top), side: "top" },
        { n: 2, x: cx(sub), y: Y(sub.bottom), side: "bottom" },
        { n: 3, x: cx(k), y: Y(field.top), side: "top" },
        { n: 4, x: X(num.left + 14 * z), y: Y(field.top), side: "top" },
        { n: 5, x: cx(step), y: Y(field.top), side: "top" },
        { n: 6, x: X(field.left + field.width * 0.62), y: Y(field.bottom), side: "bottom" },
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
              <span className="ob-line-sub">≈ $1,940.80</span>
            </span>
            <Field kind="prefix" />
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
        <li>Prefix (optional) — the unit; clickable when there is a choice</li>
        <li>Value</li>
        <li>Stepper (optional) — ±1 step; shown on hover and while editing</li>
        <li>Field fill</li>
      </ol>
    </div>
  );
}

function Menu() {
  return (
    <div className="ob-dd-menu ifs-menu" role="listbox">
      {UNITS.map((u) => (
        <div key={u} className="ob-dd-item" aria-selected={u === "Shares"}>
          <span className="ob-dd-label">
            <span className="ob-dd-lead">{MARK[u]}</span>
            {u}
          </span>
          {u === "Shares" && <Check />}
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
  const [qty, setQty] = useState("10");
  const [price, setPrice] = useState("19.84");
  const [dur, setDur] = useState("Good for day");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<string | null>(null);
  const touch = (k: string) => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));

  const qtyErr = touched.qty && qty.trim() !== "" && !(parseInt(qty, 10) >= 1) ? ERR.prefix : null;
  const pxNum = parseFloat(price.replace(/[^0-9.]/g, ""));
  const pxErr = touched.px && price.trim() !== "" && !(pxNum > 0) ? ERR.price : null;
  const errs: Record<string, string | null> = { qty: qtyErr, px: pxErr };

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

  return (
    <div className="ifs-example">
      <div className="ob-line ifs-line">
        <span className="ob-line-k">
          <span className="ob-line-label">Quantity</span>
        </span>
        {wrap(
          "qty",
          <StepperField
            ariaLabel="Quantity"
            prefix={unit}
            prefixLabel={MARK[unit]}
            prefixOptions={UNITS}
            onPrefixSelect={setUnit}
            prefixIcon={(v) => MARK[v]}
            prefixAria="What the order is counted in"
            value={qty}
            onChange={(r) => setQty(r.replace(/\D/g, ""))}
            onStep={(d) => {
              touch("qty");
              setQty((q) => String(Math.max(0, (parseInt(q, 10) || 0) + d)));
            }}
            reduce={reduce}
            spring={SPRING}
          />,
        )}
      </div>
      <div className="ob-line ifs-line">
        <span className="ob-line-k">
          <span className="ob-line-label">Limit price</span>
          <span className="ob-line-sub">Mid $19.84 · Ask $19.94</span>
        </span>
        {wrap(
          "px",
          <PriceField
            ariaLabel="Limit price"
            value={pxNum > 0 ? pxNum : 0}
            onCommit={(v) => setPrice(v.toFixed(2))}
            onStep={(d) => {
              touch("px");
              setPrice((p) => Math.max(0, (parseFloat(p) || 0) + d * 0.01).toFixed(2));
            }}
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
    <div className="ifs ob-stage st-stage">
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
        note="Live, with the error rules — enter 0 in Quantity or Limit price, leave the field, then correct it."
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

      <Section title="In a ticket line" note="The label takes the left; the field keeps its 168 on the line's right edge, as in the tickets.">
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
              <Field kind="prefix" />
              <span className="ifs-h" />
            </div>
            <figcaption>Fixed height 30 · corner radius 6</figcaption>
          </figure>
          <dl className="ifs-specs">
            <div><dt>Height</dt><dd>30px</dd></div>
            <div><dt>Radius</dt><dd>6px</dd></div>
            <div><dt>Value inset</dt><dd>6px left</dd></div>
            <div><dt>Prefix cell</dt><dd>6px padding · 1px divider (white 10%)</dd></div>
            <div><dt>Stepper</dt><dd>20 × 20, 3px from the right edge · carets 10 × 5</dd></div>
            <div><dt>Label → field</dt><dd>label column, field on a shared right edge</dd></div>
            <div><dt>Caption</dt><dd>2px under the label · 10px</dd></div>
            <div><dt>Type</dt><dd>DM Sans 12 / 400, tabular figures</dd></div>
            <div><dt>Fill</dt><dd>white 8%</dd></div>
            <div><dt>Selected</dt><dd>1px mint rim #48D597</dd></div>
            <div><dt>Error</dt><dd>red value #FF557D · fill #2C1921 · rim #F55278 (55% when inactive)</dd></div>
            <div><dt>Error message</dt><dd>6px under the field, on its left edge · 11px #FF557D</dd></div>
          </dl>
        </div>
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
              <Cell kind="stepper" state="error-selected" label="Quantity" />
            </div>
            <div>
              <h3>After leaving the field</h3>
              <Cell kind="stepper" state="error" label="Quantity" />
            </div>
            <div>
              <h3>Two fields in error</h3>
              <Cell kind="stepper" state="error" label="Quantity" />
              <Cell kind="price" state="error-selected" label="Limit price" />
            </div>
            <div>
              <h3>One corrected</h3>
              <Cell kind="stepper" state="default" label="Quantity" />
              <Cell kind="price" state="error" label="Limit price" />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Additional notes">
        <div className="ifs-notes">
          <div>
            <h3>Incremental</h3>
            <p>The stepper and ↑ / ↓ change the value by one step — a share, or a cent on a price.</p>
            <div className="ifs-cell is-selected" inert>
              <Field kind="stepper" />
            </div>
          </div>
          <div>
            <h3>Masking</h3>
            <p>A price always shows two decimals; typing strips anything that isn't a digit or a point.</p>
            <div className="ifs-cell is-default" inert>
              <PriceField ariaLabel="Amount" value={1940.8} onCommit={noop} onStep={noop} reduce spring={SPRING} />
            </div>
          </div>
          <div>
            <h3>Clickable prefix</h3>
            <p>The prefix holds the unit. With a choice it opens a menu; the chosen row takes the check.</p>
            <div className="ifs-cell is-prefix-open" inert>
              <Field kind="prefix" />
              <Menu />
            </div>
          </div>
          <div>
            <h3>Select</h3>
            <p>A field that holds a choice from a list. The caret shows on hover and while open.</p>
            <div className="ifs-cell is-hover" inert>
              <Field kind="select" />
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
