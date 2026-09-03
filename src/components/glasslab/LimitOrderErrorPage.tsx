import { PieceShell } from "./PieceShell";
import { LimitOrderError } from "./LimitOrderError";

export function LimitOrderErrorPage() {
  return (
    <PieceShell>
      <LimitOrderError />
    </PieceShell>
  );
}
