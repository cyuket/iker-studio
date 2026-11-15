import type { ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { Region } from "../../domain/storyboard";
import { useSceneEnvironment } from "../design/SceneContext";
import { easeMove } from "../design/motion";
import { MOTION } from "../design/tokens";
import { NO_ZOOM, zoomTowards, type ZoomState } from "../lib/recording";

/**
 * State of the scene's single push-in. It starts once the frame has settled, eases to the
 * focus region and stays there; it never zooms back out or repeats. Reduced motion and
 * scenes without a focus region get no zoom at all.
 */
export function useZoom(focus: Region | undefined, enabled: boolean): ZoomState {
  const frame = useCurrentFrame();
  const { fps, timing, reducedMotion } = useSceneEnvironment();
  if (!enabled || !focus || reducedMotion) return NO_ZOOM;
  const start = timing.leadFrames + timing.enterFrames + Math.round(fps * 0.6);
  const progress = interpolate(
    frame,
    [start, start + Math.round(MOTION.zoomSeconds * fps)],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: easeMove,
    },
  );
  return zoomTowards(focus, progress);
}

export interface ZoomTransitionProps {
  zoom: ZoomState;
  children: ReactNode;
}

/** Applies a zoom state to its children. Overlays use the same state to stay registered. */
export function ZoomTransition({ zoom, children }: ZoomTransitionProps): ReactNode {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transformOrigin: "0 0",
        transform: `translate(${zoom.translateX * 100}%, ${zoom.translateY * 100}%) scale(${zoom.scale})`,
      }}
    >
      {children}
    </div>
  );
}
