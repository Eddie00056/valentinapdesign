import { useState } from "react";
import type { Side } from "./tokens";
import { DemoShell } from "./DemoShell";
import { ReactiveToggle } from "./ReactiveToggle";
import { useTickSound } from "./useTickSound";

/**
 * Full-screen focused demo for the "Stock / Option toggle" piece.
 * Back button returns to the site home page.
 */
export function ToggleDemo() {
  const [soundOn, setSoundOn] = useState(true);
  const [dark, setDark] = useState(true);
  const [value, setValue] = useState<Side>("stock");
  const tick = useTickSound(soundOn);

  return (
    <DemoShell
      soundOn={soundOn}
      onSoundChange={setSoundOn}
      dark={dark}
      onDarkChange={setDark}
      onBack={() => {
        window.location.href = "/";
      }}
    >
      <ReactiveToggle
        value={value}
        onChange={setValue}
        sound={tick}
        theme={dark ? "dark" : "light"}
      />
    </DemoShell>
  );
}
