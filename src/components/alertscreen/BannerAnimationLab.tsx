import { useState } from "react";
import type { CSSProperties, ReactNode, ComponentProps } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FractionalIcon } from "../glasslab/GlassButton";

/* LOCAL PROTOTYPE — not linked, not shipped.

   Four takes on the SAME fractional-shares banner (icon, copy, dismiss)
   from AlertCreationScreen — each borrowing its motion language from a
   different reference the user asked for, so they're directly comparable
   side by side:

   - iOS App Folder   — icon "pops" open with a bouncy spring, content trails
   - Family — dialog  — springier still, dimmed backdrop, staggered entrance
   - Clerk UserButton — no shape morph at all: a small anchored dropdown,
                         quick fade + scale, no bounce
   - Clerk Create btn — the button itself grows into the bar; a plain eased
                         tween, no spring, no bounce

   None of this touches AlertCreationScreen — whichever treatment wins can
   be ported back into its real banner by hand. */

type Transition = ComponentProps<typeof motion.div>["transition"];

const VAL = "#f2f2f8";
const MUTED = "#8e97ad";
const SYMBOL = "DASH";
const BANNER_TEXT = `Fractional shares available for ${SYMBOL} market orders`;

// same glass `light`-icon-button treatment as the real header icon
// (AlertCreationScreen's fracGlass) — ported verbatim.
const fracGlass: CSSProperties = {
  background: "linear-gradient(66deg, rgba(255,255,255,0.1), rgba(255,255,255,0.045))",
  boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  color: "rgba(255,255,255,0.9)",
};

export function BannerAnimationLab() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #131417 0%, #0b0b0d 100%)",
        padding: "56px 24px 80px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 40,
        fontFamily: "'Open Sans', Helvetica, Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: MUTED,
          }}
        >
          Banner animation lab
        </p>
        <p style={{ color: VAL, fontSize: 15, lineHeight: 1.5, margin: "8px 0 0" }}>
          Same icon, copy and dismiss — four different motion languages. Tap
          the glass icon to open each one, tap the banner (or the ✕) to close it.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28, width: 340, maxWidth: "100%" }}>
        <Card title="iOS App Folder" note="Bouncy spring pop from the icon; the glyph overshoots, copy trails in.">
          <IOSFolderBanner />
        </Card>
        <Card title="Family — dialog" note="Springier still, a dimmed backdrop, content staggering in piece by piece.">
          <FamilyDialogBanner />
        </Card>
        <Card title="Clerk — UserButton" note="No shape morph at all — a small anchored dropdown, quick fade + scale, no bounce.">
          <ClerkUserButtonBanner />
        </Card>
        <Card title="Clerk — Create button" note="The button itself grows into the bar. A plain eased tween — no spring, no overshoot.">
          <ClerkCreateButtonBanner />
        </Card>
        <Card title="Bevel — blur dissolve" note="Opens like the iOS Folder card, but closing isn't a shrink at all: the button resets instantly, the panel just blurs + fades away in place.">
          <BlurDissolveBanner />
        </Card>
      </div>

      <style>{`.bal-frac-btn svg { width: 16px; height: 16px; }`}</style>
    </div>
  );
}

/* ---- shared chrome ---- */

function Card({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={{ color: VAL, fontSize: 14, fontWeight: 700 }}>{title}</div>
        <div style={{ color: MUTED, fontSize: 12, lineHeight: 1.4, marginTop: 2 }}>{note}</div>
      </div>
      {children}
    </div>
  );
}

function MiniScreen({ children, overflowVisible = false }: { children: ReactNode; overflowVisible?: boolean }) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        boxSizing: "border-box",
        background: "#000",
        border: "1px solid #1d2328",
        borderRadius: 20,
        padding: "18px 18px 22px",
        overflow: overflowVisible ? "visible" : "hidden",
      }}
    >
      {children}
    </div>
  );
}

function CompactIcon({
  layoutId,
  onClick,
  transition,
}: {
  layoutId: string;
  onClick: () => void;
  transition: Transition;
}) {
  return (
    <motion.div
      layoutId={layoutId}
      transition={transition}
      role="button"
      tabIndex={0}
      aria-label="Fractional shares"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="bal-frac-btn"
      style={{
        width: 32,
        height: 32,
        flex: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        cursor: "pointer",
        ...fracGlass,
      }}
    >
      <FractionalIcon />
    </motion.div>
  );
}

function CloseX() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M1.6 1.6l10.8 10.8M12.4 1.6L1.6 12.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* ---- 1. iOS App Folder — bouncy spring, icon "pops", copy trails in ---- */

function IOSFolderBanner() {
  const [open, setOpen] = useState(false);
  const spring: Transition = { type: "spring", stiffness: 380, damping: 20, mass: 0.9 };

  return (
    <MiniScreen>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: VAL }}>{SYMBOL}</span>
        {!open && <CompactIcon layoutId="ios-frac" transition={spring} onClick={() => setOpen(true)} />}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="slot"
            initial={{ height: 0, marginTop: 0 }}
            animate={{ height: 44, marginTop: 12 }}
            exit={{ height: 0, marginTop: 0, transition: { duration: 0.14, ease: [0.4, 0, 0.2, 1] } }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{ position: "relative" }}
          >
            <motion.div
              layoutId="ios-frac"
              transition={spring}
              role="button"
              tabIndex={0}
              aria-label="Dismiss fractional shares notice"
              onClick={() => setOpen(false)}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 16,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0 14px",
                cursor: "pointer",
                ...fracGlass,
              }}
            >
              <motion.span
                initial={{ scale: 0.6, opacity: 0.4 }}
                animate={{ scale: 1, opacity: 1, transition: { type: "spring", stiffness: 500, damping: 16, delay: 0.05 } }}
                style={{ flex: "none", lineHeight: 0 }}
              >
                <FractionalIcon />
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.2, delay: 0.14 } }}
                exit={{ opacity: 0, transition: { duration: 0.08 } }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  fontWeight: 500,
                  color: VAL,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {BANNER_TEXT}
              </motion.span>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6, transition: { duration: 0.2, delay: 0.14 } }}
                exit={{ opacity: 0, transition: { duration: 0.06 } }}
                style={{ flex: "none", color: VAL }}
              >
                <CloseX />
              </motion.span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MiniScreen>
  );
}

/* ---- 1b. Bevel — blur dissolve: same bouncy open as the iOS Folder card,
    but closing is NOT the reverse of that morph. Traced frame-by-frame from
    a screen recording of Bevel's own "+" quick-actions menu: on close the
    trigger button resets to rest instantly and independently, while the
    open panel just blurs + fades away in place — no size/position
    interpolation into the button at all. `ready` toggles the compact
    icon's layoutId off for the ~240ms a dismiss is in flight, so Motion has
    no shared-layout partner to morph the exiting panel toward — it just
    plays the panel's own blur/fade `exit`. */

function BlurDissolveBanner() {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(true);
  const spring: Transition = { type: "spring", stiffness: 380, damping: 20, mass: 0.9 };
  const glyphPop: Transition = { type: "spring", stiffness: 500, damping: 16, delay: 0.05 };
  const dissolve: Transition = { duration: 0.18, ease: [0.4, 0, 0.2, 1] };

  const dismiss = () => {
    setOpen(false);
    setReady(false);
    window.setTimeout(() => setReady(true), 240);
  };

  return (
    <MiniScreen>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: VAL }}>{SYMBOL}</span>
        {!open && (
          <motion.div
            layoutId={ready ? "dissolve-frac" : undefined}
            transition={spring}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: ready ? 0.2 : 0.1 } }}
            role="button"
            tabIndex={0}
            aria-label="Fractional shares"
            onClick={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen(true);
              }
            }}
            className="bal-frac-btn"
            style={{
              width: 32,
              height: 32,
              flex: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              cursor: "pointer",
              ...fracGlass,
            }}
          >
            <FractionalIcon />
          </motion.div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="slot"
            initial={{ height: 0, marginTop: 0 }}
            animate={{ height: 44, marginTop: 12 }}
            exit={{ height: 0, marginTop: 0, transition: dissolve }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{ position: "relative" }}
          >
            <motion.div
              layoutId="dissolve-frac"
              transition={spring}
              role="button"
              tabIndex={0}
              aria-label="Dismiss fractional shares notice"
              onClick={dismiss}
              // dissolve, not a shrink: no shared-layout partner exists
              // while `ready` is false, so this just blurs + fades in place.
              exit={{ opacity: 0, filter: "blur(10px)", transition: dissolve }}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 16,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0 14px",
                cursor: "pointer",
                ...fracGlass,
              }}
            >
              <motion.span
                initial={{ scale: 0.6, opacity: 0.4 }}
                animate={{ scale: 1, opacity: 1, transition: glyphPop }}
                style={{ flex: "none", lineHeight: 0 }}
              >
                <FractionalIcon />
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.2, delay: 0.14 } }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  fontWeight: 500,
                  color: VAL,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {BANNER_TEXT}
              </motion.span>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6, transition: { duration: 0.2, delay: 0.14 } }}
                style={{ flex: "none", color: VAL }}
              >
                <CloseX />
              </motion.span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MiniScreen>
  );
}

/* ---- 2. Family — dialog: bouncier spring, dimmed backdrop, staggered content ---- */

function FamilyDialogBanner() {
  const [open, setOpen] = useState(false);
  const spring: Transition = { type: "spring", stiffness: 300, damping: 18, mass: 1 };

  return (
    <MiniScreen>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", position: "relative", zIndex: 2 }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: VAL }}>{SYMBOL}</span>
        {!open && <CompactIcon layoutId="family-frac" transition={spring} onClick={() => setOpen(true)} />}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
              borderRadius: 20,
              zIndex: 1,
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="slot"
            initial={{ height: 0, marginTop: 0 }}
            animate={{ height: 48, marginTop: 14 }}
            exit={{ height: 0, marginTop: 0, transition: { duration: 0.16, ease: [0.4, 0, 0.2, 1] } }}
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
            style={{ position: "relative", zIndex: 2 }}
          >
            <motion.div
              layoutId="family-frac"
              transition={spring}
              role="button"
              tabIndex={0}
              aria-label="Dismiss fractional shares notice"
              onClick={() => setOpen(false)}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 18,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0 16px",
                cursor: "pointer",
                background: "#141519",
                boxShadow: "0 20px 40px rgba(0,0,0,0.45)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <motion.span
                initial={{ opacity: 0, y: 8, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 420, damping: 20, delay: 0.08 } }}
                style={{ flex: "none" }}
              >
                <FractionalIcon />
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { type: "spring", stiffness: 420, damping: 24, delay: 0.14 } }}
                exit={{ opacity: 0, transition: { duration: 0.08 } }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  fontWeight: 500,
                  color: VAL,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {BANNER_TEXT}
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { type: "spring", stiffness: 420, damping: 24, delay: 0.18 } }}
                exit={{ opacity: 0, transition: { duration: 0.06 } }}
                style={{ flex: "none", color: VAL }}
              >
                <CloseX />
              </motion.span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MiniScreen>
  );
}

/* ---- 3. Clerk UserButton — no morph, a small anchored dropdown, quick fade + scale ---- */

function ClerkUserButtonBanner() {
  const [open, setOpen] = useState(false);

  return (
    <MiniScreen overflowVisible>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: VAL }}>{SYMBOL}</span>
        <div style={{ position: "relative" }}>
          <motion.div
            role="button"
            tabIndex={0}
            aria-label="Fractional shares"
            onClick={() => setOpen((o) => !o)}
            whileTap={{ scale: 0.94 }}
            className="bal-frac-btn"
            style={{
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              cursor: "pointer",
              ...fracGlass,
            }}
          >
            <FractionalIcon />
          </motion.div>

          <AnimatePresence>
            {open && (
              <motion.div
                key="panel"
                initial={{ opacity: 0, scale: 0.94, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -2, transition: { duration: 0.1 } }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  transformOrigin: "top right",
                  width: 240,
                  background: "#131417",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10,
                  padding: 12,
                  boxShadow: "0 16px 32px rgba(0,0,0,0.5)",
                  zIndex: 10,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <span style={{ flex: "none", color: VAL, marginTop: 1, lineHeight: 0 }}>
                  <FractionalIcon />
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, color: VAL, lineHeight: 1.4 }}>
                  {BANNER_TEXT}
                </span>
                <button
                  aria-label="Dismiss"
                  onClick={() => setOpen(false)}
                  style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", padding: 0, flex: "none" }}
                >
                  <CloseX />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MiniScreen>
  );
}

/* ---- 4. Clerk Create button — the button itself grows into the bar; plain tween, no spring ---- */

function ClerkCreateButtonBanner() {
  const [open, setOpen] = useState(false);
  const tween: Transition = { duration: 0.28, ease: [0.4, 0, 0.2, 1] };

  return (
    <MiniScreen>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: VAL }}>{SYMBOL}</span>
        {!open && <CompactIcon layoutId="clerk-create-frac" transition={tween} onClick={() => setOpen(true)} />}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="slot"
            initial={{ height: 0, marginTop: 0 }}
            animate={{ height: 40, marginTop: 12 }}
            exit={{ height: 0, marginTop: 0, transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] } }}
            transition={tween}
            style={{ position: "relative" }}
          >
            <motion.div
              layoutId="clerk-create-frac"
              transition={tween}
              role="button"
              tabIndex={0}
              aria-label="Dismiss fractional shares notice"
              onClick={() => setOpen(false)}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0 14px",
                cursor: "pointer",
                background: "#131417",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span style={{ flex: "none", color: VAL, lineHeight: 0 }}>
                <FractionalIcon />
              </span>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.15, delay: 0.16 } }}
                exit={{ opacity: 0, transition: { duration: 0.06 } }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  fontWeight: 500,
                  color: VAL,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {BANNER_TEXT}
              </motion.span>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6, transition: { duration: 0.15, delay: 0.16 } }}
                exit={{ opacity: 0, transition: { duration: 0.06 } }}
                style={{ flex: "none", color: VAL }}
              >
                <CloseX />
              </motion.span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MiniScreen>
  );
}
