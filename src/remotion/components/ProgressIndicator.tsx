import type { ReactNode } from "react";
import { useCurrentFrame } from "remotion";
import type { Rect } from "../design/layout";
import { useSceneEnvironment, useTokens } from "../design/SceneContext";
import { progressAt } from "../design/motion";

export interface ProgressIndicatorProps {
  /** Where this scene starts and ends within its cut, as fractions of the whole. */
  start: number;
  end: number;
  zone: Rect;
}

/**
 * A thin bar showing how far through the cut the viewer is. It sits outside the scene's
 * fade and runs continuously across scene joins, so it never blinks at a cut.
 */
export function ProgressIndicator({ start, end, zone }: ProgressIndicatorProps): ReactNode {
  const tokens = useTokens();
  const { durationFrames } = useSceneEnvironment();
  const frame = useCurrentFrame();
  const fraction = progressAt(frame, durationFrames, start, end);
  return (
    <div
      style={{
        position: "absolute",
        left: zone.x,
        top: zone.y,
        width: zone.width,
        height: zone.height,
        borderRadius: tokens.radii.pill,
        backgroundColor: tokens.colours.hairlineStrong,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${fraction * 100}%`,
          height: "100%",
          borderRadius: tokens.radii.pill,
          backgroundColor: tokens.colours.primary,
        }}
      />
    </div>
  );
}
