import { LimitOrderError } from "./LimitOrderError";

/** Homepage thumbnail: the error animation loops; clicks fall through to the
 *  card link (pointer events are disabled inside the component in auto mode). */
export function LimitOrderErrorPreview() {
  return (
    <div
      aria-hidden="true"
      style={{
        transform: "scale(1.05)",
        transformOrigin: "center",
        fontFamily:
          '"DM Sans", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <LimitOrderError auto />
    </div>
  );
}
