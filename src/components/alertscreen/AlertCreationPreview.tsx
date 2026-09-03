import { AlertCreationScreen } from "./AlertCreationScreen";

/** Homepage thumbnail — top-cropped, non-interactive. */
export function AlertCreationPreview() {
  return (
    <div
      aria-hidden="true"
      style={{
        pointerEvents: "none",
        width: 320,
        height: 240,
        overflow: "hidden",
        borderRadius: 8,
      }}
    >
      <div
        style={{
          width: 406,
          transform: "scale(0.788)",
          transformOrigin: "top left",
        }}
      >
        <AlertCreationScreen frame="bare" />
      </div>
    </div>
  );
}
