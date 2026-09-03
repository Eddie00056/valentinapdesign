import type { ReactNode } from "react";

/* Chrome modelled on the tcosta.com/wspoc snippet pages:
   floating glass back-button (top-left), a glass pill control (top-right),
   a floating background toggle (bottom-centre), and the demo centred on a
   plain white / black canvas. */

function IconBack() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M12.0833 15L7.08325 10L12.0833 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSoundOn() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
      <path
        d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a9 9 0 0 1 0 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSoundOff() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
      <path
        d="m16.5 9.5 5 5M21.5 9.5l-5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSun() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4.2" fill="currentColor" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function DemoShell({
  children,
  soundOn,
  onSoundChange,
  onBack,
  dark,
  onDarkChange,
  scale = 3,
}: {
  children: ReactNode;
  soundOn: boolean;
  onSoundChange: (v: boolean) => void;
  onBack: () => void;
  dark: boolean;
  onDarkChange: (v: boolean) => void;
  scale?: number;
}) {
  return (
    <div className={`shell ${dark ? "shell--dark" : "shell--light"}`}>
      <nav className="shell-nav">
        <button
          type="button"
          className="shell-glass shell-btn shell-btn--back"
          aria-label="Back to index"
          onClick={onBack}
        >
          <IconBack />
        </button>

        <div className="shell-glass shell-pill" role="group" aria-label="Sound">
          <button
            type="button"
            className="shell-pill-btn"
            data-on={soundOn}
            aria-pressed={soundOn}
            aria-label="Sound on"
            onClick={() => onSoundChange(true)}
          >
            <IconSoundOn />
          </button>
          <button
            type="button"
            className="shell-pill-btn"
            data-on={!soundOn}
            aria-pressed={!soundOn}
            aria-label="Sound off"
            onClick={() => onSoundChange(false)}
          >
            <IconSoundOff />
          </button>
        </div>
      </nav>

      <div
        className="shell-stage"
        style={{ transform: `scale(${scale})`, transformOrigin: "center" }}
      >
        {children}
      </div>

      <div className="shell-foot">
        <button
          type="button"
          className="shell-glass shell-btn"
          aria-label={
            dark ? "Switch to white background" : "Switch to black background"
          }
          onClick={() => onDarkChange(!dark)}
        >
          {dark ? <IconSun /> : <IconMoon />}
        </button>
      </div>
    </div>
  );
}
