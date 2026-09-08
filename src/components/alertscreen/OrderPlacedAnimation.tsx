import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import "./OrderPlacedAnimation.css";

const PHONE = "/prototypes/uploads/iphone-order-placed.png";

type Props = {
  /** How long the spinner dwells before it resolves into the check, ms.
      Every downstream beat is offset from this. */
  durationMs?: number;
  /** Play the two-note confirmation chime when the check lands. Fires on
      the first play and on manual replays — never on an auto-loop. */
  sound?: boolean;
  /** Restart automatically a couple of seconds after it settles. */
  loop?: boolean;
  /** Rendered width of the phone, px. */
  phoneWidth?: number;
  /** Wrap the phone in the ambient backdrop + a Replay button (the
      standalone page). Off = just the phone, for thumbnails/embeds. */
  chrome?: boolean;
};

function chime() {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AC();
    const t = ctx.currentTime;
    [
      { f: 880, d: 0.12, v: 0.15, at: t },
      { f: 1318.5, d: 0.2, v: 0.12, at: t + 0.36 },
    ].forEach(({ f, d, v, at }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(v, at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, at + d);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + d);
    });
  } catch {
    /* AudioContext unavailable or blocked — no chime, no harm. */
  }
}

export function OrderPlacedAnimation({
  durationMs = 2000,
  sound = true,
  loop = true,
  phoneWidth = 380,
  chrome = true,
}: Props) {
  // Bumping this key remounts the phone subtree, which restarts every CSS
  // animation from zero — simpler and flicker-free vs. juggling
  // getAnimations().cancel()/play().
  const [run, setRun] = useState(0);
  const withSound = useRef(true);
  const chimeTimer = useRef<number>();
  const loopTimer = useRef<number>();

  const dur = Math.min(6000, Math.max(600, durationMs));

  const replay = useCallback(() => {
    withSound.current = true;
    setRun((n) => n + 1);
  }, []);

  useEffect(() => {
    window.clearTimeout(chimeTimer.current);
    window.clearTimeout(loopTimer.current);

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    if (sound && withSound.current) {
      chimeTimer.current = window.setTimeout(chime, dur);
    }
    if (loop) {
      loopTimer.current = window.setTimeout(() => {
        withSound.current = false;
        setRun((n) => n + 1);
      }, dur + 2600);
    }

    return () => {
      window.clearTimeout(chimeTimer.current);
      window.clearTimeout(loopTimer.current);
    };
  }, [run, sound, loop, dur]);

  const phone = (
    <div
      key={run}
      className="opa-phone"
      data-screen-label="Order animation"
      style={{ width: phoneWidth, "--d": dur / 1000 + "s" } as CSSProperties}
    >
      <img src={PHONE} alt="iPhone" />

      <div className="opa-screen">
        <div className="opa-badge">
          <svg className="opa-ring" viewBox="0 0 120 120">
            <circle className="opa-ring-track" cx="60" cy="60" r="48" />
            <circle className="opa-ring-fill" cx="60" cy="60" r="46.25" />
            <circle className="opa-ring-draw" cx="60" cy="60" r="48" />
            <circle className="opa-spin" cx="60" cy="60" r="48" />
          </svg>

          <svg className="opa-check" viewBox="0 0 50 50">
            <path d="M12 26 L22 36 L38 16" />
          </svg>

          <div className="opa-glow" />
          <div className="opa-ripple" />
          <div className="opa-ripple2" />
        </div>

        <div className="opa-caption">
          <span className="opa-caption--from">Placing order</span>
          <span className="opa-caption--to">Order placed</span>
        </div>
      </div>
    </div>
  );

  if (!chrome) return phone;

  return (
    <div className="opa-stage">
      {phone}
      <button type="button" className="opa-replay" onClick={replay}>
        Replay
      </button>
    </div>
  );
}
