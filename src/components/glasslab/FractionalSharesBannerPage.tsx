import { useEffect, useState } from "react";
import { PieceShell } from "./PieceShell";
import { FractionalSharesBanner, type BannerSkin } from "./FractionalSharesBanner";

/* ?glass — the original colours with only the snackbar's white stroke, to
   see against the snackbar version (user, 2026-09-16). */
export function FractionalSharesBannerPage() {
  const [skin, setSkin] = useState<BannerSkin>("snackbar");
  useEffect(() => {
    if (new URLSearchParams(location.search).has("glass")) setSkin("glass");
  }, []);
  return (
    <PieceShell>
      <FractionalSharesBanner skin={skin} />
    </PieceShell>
  );
}
