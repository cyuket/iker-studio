import type { ReactNode } from "react";
import type { ZoomState } from "../lib/recording";

export interface CameraRigProps {
  /** Where the virtual camera is. */
  zoom: ZoomState;
  children: ReactNode;
}

/**
 * Applies the virtual camera to whatever it wraps. The footage is never re-recorded or
 * re-encoded for a move: it is drawn once, larger and shifted, inside a parent that clips.
 * Overlays use the same state through `mapRegion`, so they stay registered to the footage.
 */
export function CameraRig({ zoom, children }: CameraRigProps): ReactNode {
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
