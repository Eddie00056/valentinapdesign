import { useRef } from "react";

export type TickApi = {
  tick: () => void;
  select: () => void;
  readonly enabled: boolean;
};

/**
 * Deep cinematic "brrram" on commit — a low fifth (root + 3:2) on detuned
 * sawtooths through a dark low-pass, with a sub sine underneath, a short
 * upward bend and a long tail. Meant to land like the two-note Batman motif
 * rather than a UI tick.
 *
 * Returns a STABLE object so memoised consumers never re-render on toggle.
 */
export function useTickSound(enabled: boolean): TickApi {
  const ctxRef = useRef<AudioContext | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const apiRef = useRef<TickApi | null>(null);
  if (!apiRef.current) {
    const ac = () => {
      if (!ctxRef.current) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        ctxRef.current = new Ctor();
      }
      if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
      return ctxRef.current;
    };

    // one deep hit starting at time `t`
    const hit = (ctx: AudioContext, t: number, gain = 1) => {
      const root = 123; // ~B2 — dark but present, not a sub rumble

      // soft saturation for grit
      const shaper = ctx.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) {
        const x = (i / 1023) * 2 - 1;
        curve[i] = Math.tanh(x * 2.4);
      }
      shaper.curve = curve;
      shaper.oversample = "2x";

      // keep it dark: low-pass opens a crack then shuts
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.value = 6;
      lp.frequency.setValueAtTime(240, t);
      lp.frequency.exponentialRampToValueAtTime(950, t + 0.09);
      lp.frequency.exponentialRampToValueAtTime(240, t + 0.6);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.15 * gain, t + 0.016);
      env.gain.exponentialRampToValueAtTime(0.045 * gain, t + 0.26);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.72);

      env.connect(shaper);
      shaper.connect(lp);
      lp.connect(ctx.destination);

      const stop = t + 0.82;

      // a little octave-down weight, kept subtle
      const sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(root * 0.5, t);
      sub.frequency.exponentialRampToValueAtTime(root * 0.56, t + 0.2);
      const subGain = ctx.createGain();
      subGain.gain.value = 0.18;
      sub.connect(subGain).connect(env);
      sub.start(t);
      sub.stop(stop);

      // the two-note body: root + a fifth, three detuned saw voices, bent up
      const voices: Array<[number, number, number]> = [
        [root, 0, 0.34],
        [root * 1.5, 9, 0.22], // fifth
        [root, -11, 0.3],
      ];
      for (const [freq, detune, level] of voices) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.detune.value = detune;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(freq * 1.12, t + 0.19);
        const g = ctx.createGain();
        g.gain.value = level;
        o.connect(g).connect(env);
        o.start(t);
        o.stop(stop);
      }
    };

    apiRef.current = {
      get enabled() {
        return enabledRef.current;
      },
      tick: () => {
        if (!enabledRef.current) return;
        const ctx = ac();
        hit(ctx, ctx.currentTime);
      },
      // two-note version — the "brr-ram, brr-ram"
      select: () => {
        if (!enabledRef.current) return;
        const ctx = ac();
        const t = ctx.currentTime;
        hit(ctx, t, 0.85);
        hit(ctx, t + 0.19, 1);
      },
    };
  }

  return apiRef.current;
}
