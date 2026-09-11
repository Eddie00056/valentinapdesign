import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";

/**
 * The controls an order ticket is built from.
 *
 * Extracted from OptionsBuilder.tsx when the stock ticket arrived — the
 * same reason WidgetShell, TickerPill and RollingNumber were: the user
 * checks these two cards against each other a field at a time, and two
 * copies of a dropdown drift the moment one of them is touched.
 *
 * They still emit `ob-` class names, and that is deliberate: the ticket
 * design system lives in options-builder.css, on an `.ob-stage` root, and
 * every consumer wears that root so a control renders identically
 * wherever it is dropped. The prefix names the system, not the page.
 */

/* ---- crossfading label (Motion) ---- */

export function Swap({ k, children }: { k: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span
        key={k}
        initial={{ y: reduce ? 0 : "0.7em", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: reduce ? 0 : "-0.7em", opacity: 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.24, ease: [0.33, 1, 0.68, 1] }}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  );
}

/**
 * A box that springs to its content's height, clipping what has not been
 * uncovered yet.
 *
 * This is the whole add-a-leg animation. Motion's own `layout` would do
 * the same job by scaling the box and correcting its children, and that
 * is exactly what must not happen here: the type inside is 12px and any
 * scale on the way puts it through sizes it was never hinted for, which
 * reads as the text wobbling. Measuring the content and animating the
 * real `height` keeps every glyph at its natural size for the whole
 * transition; `overflow: hidden` on the outer box turns that into a
 * top-to-bottom reveal.
 *
 * It starts at `auto` so the server-rendered card is the right size
 * before any of this runs, and only ever animates between two measured
 * pixel heights after that.
 */
export function AutoHeight({
  children,
  className,
  transition,
  enabled = true,
}: {
  children: ReactNode;
  className?: string;
  transition: Transition;
  /** Off under reduced motion: the box just takes its content's size. */
  enabled?: boolean;
}) {
  const inner = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | "auto">("auto");

  useEffect(() => {
    const el = inner.current;
    if (!el || !enabled) return;
    /* A ResizeObserver, not a dependency on the rows: the height changes
       for reasons this component cannot see — a leg arriving, a label
       rewrapping, the card being resized — and all of them are the same
       event as far as the box is concerned. */
    const ro = new ResizeObserver(() => setH(el.offsetHeight));
    ro.observe(el);
    setH(el.offsetHeight);
    return () => ro.disconnect();
  }, [enabled]);

  return (
    <motion.div
      className={className}
      /* Never an entrance of its own — the first commit is already the
         right height, so there is nothing to animate from. */
      initial={false}
      animate={{ height: enabled ? h : "auto" }}
      transition={transition}
      style={{ overflow: "hidden" }}
    >
      {/* The measured box. It must be a plain div: anything that
          transforms it would feed its own animation back into the
          observer. */}
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}

/* Solid triangle, up or down — the stepper's affordance in the reference
   asset. Measured off it: 22 x 11 at a 4x export is 5.5 x 2.75, so the
   shape is 2:1 and drawn on an 8 x 4 grid at 6 x 3. Filled, not stroked —
   the export shows a solid wedge, not a chevron. */
export function Caret({ dir }: { dir: "up" | "down" }) {
  return (
    <svg width="6" height="3" viewBox="0 0 8 4" aria-hidden="true">
      <path d={dir === "up" ? "M4 0 8 4H0z" : "M4 4 0 0h8z"} fill="currentColor" />
    </svg>
  );
}

/**
 * A value and a caret stepper — the field shape the limit price takes,
 * with its label lifted out onto the row beside it.
 */
export function StepperField({
  value,
  onChange,
  onStep,
  ariaLabel,
  reduce,
  spring,
  prefix,
  prefixOptions,
  onPrefixSelect,
  prefixLabel,
  prefixIcon,
  prefixHint,
  prefixAria,
  steppable = true,
}: {
  value: string;
  onChange: (raw: string) => void;
  onStep: (delta: number) => void;
  ariaLabel: string;
  reduce: boolean | null;
  spring: Transition;
  /** See PriceField — the same cell, on a field that holds a count. */
  prefix?: string;
  prefixOptions?: readonly string[];
  onPrefixSelect?: (v: string) => void;
  prefixLabel?: ReactNode;
  prefixIcon?: (v: string) => ReactNode;
  prefixHint?: string;
  prefixAria?: string;
  /** See PriceField. */
  steppable?: boolean;
}) {
  /* A <label> when the field is only an input: clicking anywhere in it
     then puts the caret in the number, which is the right affordance for
     a box that holds one value. A <div> once there is a prefix, because a
     button inside a label activates the label too — every click on the
     picker would also focus the input behind the menu. */
  const Root = prefix ? "div" : "label";

  return (
    <Root className="ob-field ob-stepper">
      {prefix && (
        <Prefix
          value={prefix}
          label={prefixLabel}
          options={prefixOptions}
          onSelect={onPrefixSelect}
          icon={prefixIcon}
          hint={prefixHint}
          ariaLabel={prefixAria ?? `${ariaLabel} unit`}
        />
      )}
      <input
        type="text"
        inputMode="numeric"
        aria-label={ariaLabel}
        size={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {steppable && (
      <div className="ob-stepper-hit" onClick={(e) => e.stopPropagation()}>
        <div className="ob-stepper-btns">
          {([1, -1] as const).map((d) => (
            <motion.button
              key={d}
              type="button"
              aria-label={`${d > 0 ? "Increase" : "Decrease"} ${ariaLabel}`}
              onClick={() => onStep(d)}
              whileHover={reduce ? undefined : { background: "rgba(72,213,151,0.12)" }}
              whileTap={reduce ? undefined : { scale: 0.82 }}
              transition={spring}
            >
              <Caret dir={d > 0 ? "up" : "down"} />
            </motion.button>
          ))}
        </div>
      </div>
      )}
    </Root>
  );
}

/**
 * The same field holding a PRICE: a currency mark set against the figure,
 * a stepper beside it, and the figure itself editable in place.
 *
 * The editing state is the field's own — nothing outside it needs to know
 * whether the caret is in the box. What the owner supplies is the value,
 * what a caret press is worth (`onStep` reports ±1, so the call site
 * decides whether that is a cent or a dollar), and where a typed number
 * lands, which is also where the owner clamps it.
 */
export function PriceField({
  value,
  onCommit,
  onStep,
  ariaLabel,
  reduce,
  spring,
  prefix,
  prefixOptions,
  onPrefixSelect,
  prefixLabel,
  prefixIcon,
  prefixHint,
  prefixAria,
  steppable = true,
}: {
  value: number;
  /** A typed number, committed on Enter or blur. Clamp it here. */
  onCommit: (v: number) => void;
  /** ±1 per caret press. */
  onStep: (delta: number) => void;
  ariaLabel: string;
  reduce: boolean | null;
  spring: Transition;
  /**
   * Given, the field opens with a prefix box — the Atlas input field's
   * "Label as Prefix": its own cell at the head of the field, divided
   * from the value by a hairline. It takes over saying what the number
   * is, so the inline currency mark is dropped: a field cannot state its
   * unit twice.
   */
  prefix?: string;
  /** Given with `onPrefixSelect`, the prefix becomes a picker. */
  prefixOptions?: readonly string[];
  onPrefixSelect?: (v: string) => void;
  /** What the cell shows, when that is not the chosen option itself. */
  prefixLabel?: ReactNode;
  /** A leading glyph per menu row. */
  prefixIcon?: (v: string) => ReactNode;
  /** The popover shown after a moment's hover. */
  prefixHint?: string;
  prefixAria?: string;
  /**
   * False drops the caret pair — the spec's "suffix". A field without one
   * is typed into rather than nudged, and the ticket uses that to keep a
   * single stepper on screen at a time.
   */
  steppable?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const noun = ariaLabel.toLowerCase();

  function commit(text: string) {
    setEditing(false);
    const parsed = parseFloat(text);
    if (Number.isFinite(parsed)) onCommit(+parsed.toFixed(2));
  }

  return (
    <div className="ob-field ob-stepper">
      {prefix && (
        <Prefix
          value={prefix}
          label={prefixLabel}
          options={prefixOptions}
          onSelect={onPrefixSelect}
          icon={prefixIcon}
          hint={prefixHint}
          ariaLabel={prefixAria ?? `${ariaLabel} unit`}
        />
      )}
      {editing ? (
        <span className="ob-stepper-num ob-stepper-num--editing">
          {/* The unit, outside the editable text. It is not something you
              type or delete — the field holds a price, and it says so
              whether or not there is a number in it yet. Unless a prefix
              box is already saying it. */}
          {!prefix && <span className="ob-unit">$</span>}
          <input
            type="text"
            inputMode="decimal"
            aria-label={ariaLabel}
            /* An <input> with no `size` carries a default intrinsic width
               of ~20 characters, which fed straight into the card's
               max-content pass and jumped the widget wider the moment
               this field was clicked into. */
            size={1}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, "").slice(0, 9))}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
              if (e.key === "Escape") setEditing(false);
            }}
          />
        </span>
      ) : (
        <button
          type="button"
          className="ob-stepper-num"
          onClick={() => {
            setDraft(value.toFixed(2));
            setEditing(true);
          }}
          aria-label={`Edit ${noun}`}
        >
          {!prefix && <span className="ob-unit">$</span>}
          {value.toFixed(2)}
        </button>
      )}
      {/* Invisible padding + matching negative margin — a bigger hit
          target than the visible square without growing the field's own
          layout. */}
      {steppable && (
      <div className="ob-stepper-hit" onClick={(e) => e.stopPropagation()}>
        <div className="ob-stepper-btns">
          {([1, -1] as const).map((d) => (
            <motion.button
              key={d}
              type="button"
              aria-label={`${d > 0 ? "Increase" : "Decrease"} ${noun}`}
              onClick={() => onStep(d)}
              whileHover={reduce ? undefined : { background: "rgba(72,213,151,0.12)" }}
              whileTap={reduce ? undefined : { scale: 0.82 }}
              transition={spring}
            >
              <Caret dir={d > 0 ? "up" : "down"} />
            </motion.button>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}

/**
 * The add-a-row glyph, on the house 16px grid at a 1.6 round-capped
 * stroke. Drawn 4→12, so its INK starts 0.8 units outside that — which
 * is what `.ob-add button svg`'s −2.8px pull cancels, and why the gap to
 * its label is 1.2 and not 4. See the bearing rule.
 */
export function Plus({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      aria-hidden
      focusable={false}
    >
      <path d="M8 4v8M4 8h8" />
    </svg>
  );
}

/** Locked to a quote — the spec's icon on the two "Follow" rows. On the
    same 16px grid and 1.6 stroke as the rest of the set. */
export function Lock({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
    >
      <rect x="3.4" y="7" width="9.2" height="6.4" rx="1.6" />
      <path d="M5.8 7V5.2a2.2 2.2 0 0 1 4.4 0V7" />
    </svg>
  );
}

/** Marks the chosen row in an open menu. */
export function Check() {
  return (
    <svg width="10" height="8" viewBox="0 0 12 10" fill="none" aria-hidden="true">
      <path
        d="M1 5.2 4.4 8.6 11 1.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Where a menu opens, measured off its own trigger.
 *
 * The menu is `position: fixed` and placed from the trigger's viewport
 * rect, rather than absolutely inside it. Both containers on these
 * tickets clip their contents to a 6px radius and the card clips to 12 —
 * an absolutely positioned menu would be cut off by whichever it opened
 * inside. Fixed escapes all three.
 */
function useMenuAnchor<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [at, setAt] = useState<{ top: number; left: number; minWidth: number }>({
    top: 0,
    left: 0,
    minWidth: 0,
  });

  function place() {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    /* 4 below the trigger, per the Atlas doc's own gap. */
    setAt({ top: r.bottom + 4, left: r.left, minWidth: r.width });
  }

  return { ref, at, place };
}

/**
 * The list itself.
 *
 * Portalled to <body>, not left in place. It is `position: fixed` at
 * coordinates read off the trigger's viewport rect, and that only holds
 * while no ancestor is transformed — these tickets can be dragged, which
 * puts a transform on a wrapper above them and turns `fixed` into
 * `absolute` against that wrapper. The menu would then be offset by
 * exactly however far the card had been moved. Out at the body there is
 * no such ancestor and the viewport coordinates mean what they say.
 */
function Menu<T extends string | number>({
  open,
  at,
  value,
  options,
  format,
  icon,
  onSelect,
  onClose,
}: {
  open: boolean;
  at: { top: number; left: number; minWidth: number };
  value: T;
  options: readonly T[];
  format: (v: T) => string;
  /** Given, each row opens with this — the spec's "$" and padlocks. */
  icon?: (v: T) => ReactNode;
  onSelect: (v: T) => void;
  onClose: () => void;
}) {
  return portal(
    <AnimatePresence>
      {open && (
        <>
          {/* Catches the click that closes it, and any scroll under it —
              the menu is placed once, so it must not outlive a scroll. */}
          <div className="ob-dd-scrim" onClick={onClose} onWheel={onClose} />
          <motion.div
            className="ob-dd-menu"
            role="listbox"
            style={{ top: at.top, left: at.left, minWidth: at.minWidth }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14, ease: [0.33, 1, 0.68, 1] }}
          >
            {options.map((o) => (
              <button
                key={String(o)}
                type="button"
                role="option"
                aria-selected={o === value}
                className="ob-dd-item"
                onClick={() => {
                  onSelect(o);
                  onClose();
                }}
              >
                <span className="ob-dd-label">
                  {icon && <span className="ob-dd-lead">{icon(o)}</span>}
                  {format(o)}
                </span>
                {o === value && <Check />}
              </button>
            ))}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
  );
}

/**
 * A field that opens a list.
 */
export function Dropdown<T extends string | number>({
  value,
  options,
  onSelect,
  format = (v) => String(v),
  className,
  ariaLabel,
  disabled,
}: {
  value: T;
  options: readonly T[];
  onSelect: (v: T) => void;
  format?: (v: T) => string;
  className: string;
  ariaLabel: string;
  /**
   * Shown, dimmed, and inert. A control the order has decided for you
   * still occupies its line, so the ticket's shape does not change with
   * its own answers.
   */
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { ref, at, place } = useMenuAnchor<HTMLButtonElement>();

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={className}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        data-open={(open && !disabled) || undefined}
        onClick={() => {
          place();
          setOpen((o) => !o);
        }}
      >
        {format(value)}
        <Chevron />
      </button>

      <Menu
        open={open && !disabled}
        at={at}
        value={value}
        options={options}
        format={format}
        onSelect={onSelect}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/**
 * The head of a field: what the number in it is, and — where there is
 * something to choose — the control that changes it.
 *
 * Atlas draws these as two states of one part: "Label as Prefix", which
 * is a cell and nothing more, and "Clickable Prefix", which lights under
 * the pointer and opens a list. Given `options` this renders the second:
 * a button wearing the same cell, with a chevron that appears on hover
 * the way every other trigger on these cards reveals its own.
 */
function Prefix({
  value,
  label,
  options,
  onSelect,
  icon,
  hint,
  ariaLabel,
}: {
  /** What the cell says, and what the menu marks as chosen. */
  value: string;
  /** What the cell shows, if that is not the value itself — a mark or a
      glyph as readily as a word. */
  label?: ReactNode;
  options?: readonly string[];
  onSelect?: (v: string) => void;
  icon?: (v: string) => ReactNode;
  /** The spec's "Hover with popover": what this control is for. */
  hint?: string;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState(false);
  const tipT = useRef<number | undefined>(undefined);
  const { ref, at, place } = useMenuAnchor<HTMLButtonElement>();
  const [tipAt, setTipAt] = useState({ left: 0, bottom: 0 });

  if (!options || !onSelect) {
    return <span className="ob-field-k">{label ?? value}</span>;
  }

  /* The popover waits. It explains a control that is also perfectly
     usable without reading it, so it must not fire on a pointer merely
     crossing the field on its way somewhere else. */
  function armTip() {
    const r = ref.current?.getBoundingClientRect();
    if (r) setTipAt({ left: r.left, bottom: window.innerHeight - r.top + 6 });
    window.clearTimeout(tipT.current);
    tipT.current = window.setTimeout(() => setTip(true), 420);
  }

  function dropTip() {
    window.clearTimeout(tipT.current);
    setTip(false);
  }

  return (
    <>
      <button
        ref={ref}
        type="button"
        className="ob-field-k"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        title={undefined}
        data-open={open || undefined}
        onPointerEnter={armTip}
        onPointerLeave={dropTip}
        onClick={() => {
          dropTip();
          place();
          setOpen((o) => !o);
        }}
      >
        {label ?? value}
        <Chevron />
      </button>

      {hint &&
        portal(
          <AnimatePresence>
            {tip && !open && (
              <motion.span
                className="ob-tip"
                role="tooltip"
                style={{ left: tipAt.left, bottom: tipAt.bottom }}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 3 }}
                transition={{ duration: 0.14, ease: [0.33, 1, 0.68, 1] }}
              >
                {hint}
              </motion.span>
            )}
          </AnimatePresence>,
        )}

      <Menu
        open={open}
        at={at}
        value={value}
        options={options}
        format={(v) => v}
        icon={icon}
        onSelect={onSelect}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/**
 * Render into <body>, or nowhere until the client has it.
 *
 * These widgets are server-rendered by Astro before they hydrate, so
 * `document` does not exist on the first pass. Nothing here is visible
 * until a menu is opened, which cannot happen before hydration, so
 * skipping the portal server-side costs nothing.
 */
export function portal(node: ReactNode): ReactNode {
  return typeof document === "undefined" ? null : createPortal(node, document.body);
}

export function Chevron() {
  return (
    <svg
      className="ob-chevron"
      width="8"
      height="8"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3.5 5.25 7 8.75l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
