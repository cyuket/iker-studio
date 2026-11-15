import type { ReactNode } from "react";
import type { Rect } from "../design/layout";
import { useTokens } from "../design/SceneContext";

export interface SpotlightOverlayProps {
  /** Area left clear, in pixels of the parent. */
  target: Rect;
  opacity: number;
  padding: number;
}

/** Dims everything in the parent except one region. The parent must clip its overflow. */
export function SpotlightOverlay({ target, opacity, padding }: SpotlightOverlayProps): ReactNode {
  const tokens = useTokens();
  return (
    <div
      style={{
        position: "absolute",
        left: target.x - padding,
        top: target.y - padding,
        width: target.width + padding * 2,
        height: target.height + padding * 2,
        borderRadius: tokens.radii.md,
        boxShadow: `0 0 0 8000px ${tokens.colours.scrim}`,
        opacity,
      }}
    />
  );
}
