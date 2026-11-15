import type { ReactNode } from "react";
import { useCurrentFrame } from "remotion";
import type { RecordingTimeline } from "../../domain/recording";
import { withAlpha } from "../design/colour";
import { useLayout, useSceneEnvironment, useTokens } from "../design/SceneContext";
import { easeMove } from "../design/motion";
import { cursorAt, mapRegion, type ZoomState } from "../lib/recording";

export interface CursorAnimationProps {
  events: RecordingTimeline["events"];
  /** Size of the viewport the cursor moves over, in output pixels. */
  bounds: { width: number; height: number };
  zoom: ZoomState;
  opacity: number;
}

/**
 * A drawn pointer that glides between the elements the recording acted on, arriving as
 * each event starts. Only for stills: recorded video already contains its own cursor.
 */
export function CursorAnimation({
  events,
  bounds,
  zoom,
  opacity,
}: CursorAnimationProps): ReactNode {
  const tokens = useTokens();
  const { u, pick } = useLayout();
  const { fps, reducedMotion } = useSceneEnvironment();
  const frame = useCurrentFrame();
  // With reduced motion the pointer steps between targets instead of travelling.
  const state = cursorAt(events, frame / fps, reducedMotion ? (t) => (t < 1 ? 0 : 1) : easeMove);
  if (!state) return null;

  const point = mapRegion({ x: state.x, y: state.y, width: 0, height: 0 }, zoom);
  const size = u(pick(34, 38));
  const ring = u(pick(64, 72));
  return (
    <div
      style={{
        position: "absolute",
        left: point.x * bounds.width,
        top: point.y * bounds.height,
        width: 0,
        height: 0,
        opacity,
      }}
    >
      {state.click === null ? null : (
        <div
          style={{
            position: "absolute",
            left: -ring / 2,
            top: -ring / 2,
            width: ring,
            height: ring,
            boxSizing: "border-box",
            borderRadius: tokens.radii.pill,
            border: `${tokens.stroke.strong}px solid ${tokens.colours.primary}`,
            backgroundColor: withAlpha(tokens.colours.primary, 0.18),
            opacity: 1 - state.click,
            transform: reducedMotion ? "none" : `scale(${0.4 + state.click * 0.6})`,
          }}
        />
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={{ position: "absolute", left: -size * 0.17, top: -size * 0.1, overflow: "visible" }}
      >
        <path
          d="M4 2.5v17l4.6-4.3 3 6.6 2.9-1.3-3-6.5H18L4 2.5z"
          fill={tokens.colours.text}
          stroke={tokens.colours.background}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
