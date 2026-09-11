import type { CSSProperties, ReactNode } from "react";

/**
 * A border with a light running round it.
 *
 * The ring is the border — the component clips a spun conic gradient and
 * lays an opaque face back over the middle, so what is left is the edge
 * the box already had, with a light travelling along it. See the comment
 * at the top of beam-ring.css for the construction; everything below is
 * the handle on it.
 *
 * It wraps whatever it is given and takes its size from it: the ring is
 * padding, so a beamed box is `width` wider than the same box without
 * one. Give it a `width`/`height` in `style` to pin it instead.
 *
 * Every visual is a custom property, so a caller that wants a whole
 * family of these sets them once on an ancestor rather than passing the
 * same six props at every call site.
 */
export function BeamRing({
  children,
  /** Off leaves the border, and takes the light away. */
  running = true,
  /** The arc's own colour — the side, the state, the brand. */
  color,
  /** The hot point at the head of the arc. Near-white, not white. */
  core,
  /** What the face is filled with. It has to be opaque: it is what turns
      the disc into a ring. */
  background,
  /** The ring's thickness, in px. */
  width = 1,
  /** The OUTER radius, in px. The face takes this minus `width`, which is
      what keeps the two curves concentric. */
  radius = 6,
  /** One turn, in seconds. */
  duration = 5,
  /** The static border the arc travels along. */
  track,
  /** A bloom outside the box: `true` for the default, or a px blur. */
  glow = false,
  className,
  style,
}: {
  children?: ReactNode;
  running?: boolean;
  color?: string;
  core?: string;
  background?: string;
  width?: number;
  radius?: number;
  duration?: number;
  track?: string;
  glow?: boolean | number;
  className?: string;
  style?: CSSProperties;
}) {
  const vars = {
    "--beam-w": `${width}px`,
    "--beam-r": `${radius}px`,
    "--beam-duration": `${duration}s`,
    ...(color ? { "--beam-color": color } : null),
    ...(core ? { "--beam-core": core } : null),
    ...(background ? { "--beam-bg": background } : null),
    ...(track ? { "--beam-track": track } : null),
    ...(typeof glow === "number" ? { "--beam-glow": `${glow}px` } : null),
    ...style,
  } as CSSProperties;

  return (
    <span
      className={className ? `beam ${className}` : "beam"}
      data-still={running ? undefined : ""}
      style={vars}
    >
      {/* The bloom first, because it belongs behind everything — it is the
          same arc again, blurred, and the face is what hides all of it
          except the part the blur pushes past the edge. */}
      {glow !== false && (
        <span className="beam-halo" aria-hidden="true">
          <span className="beam-arc" />
        </span>
      )}
      <span className="beam-clip" aria-hidden="true">
        <span className="beam-arc" />
      </span>
      <span className="beam-face">{children}</span>
    </span>
  );
}
