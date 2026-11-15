import type { ReactNode } from "react";
import { withAlpha } from "../design/colour";
import type { Rect } from "../design/layout";
import { mix } from "../design/motion";
import { useTokens } from "../design/SceneContext";
import { MOTION } from "../design/tokens";

export interface FocusRingProps {
  /** What to ring, in pixels of the parent. */
  target: Rect;
  /** 0 is absent, 1 is settled on the target. */
  progress: number;
  colour: string;
  /** Space between the target and the ring, in output pixels. */
  padding: number;
  radius: number;
  /** Stroke width in output pixels. */
  weight: number;
}

/** A ring that closes in on its target and stays: "this one". No glow, no pulse. */
export function FocusRing({
  target,
  progress,
  colour,
  padding,
  radius,
  weight,
}: FocusRingProps): ReactNode {
  if (progress <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: target.x - padding,
        top: target.y - padding,
        width: target.width + padding * 2,
        height: target.height + padding * 2,
        boxSizing: "border-box",
        borderRadius: radius,
        border: `${weight}px solid ${colour}`,
        opacity: Math.min(1, progress * 1.5),
        scale: String(mix(MOTION.scale.emphasis, 1, Math.min(1, progress))),
      }}
    />
  );
}

export interface DimMaskProps {
  /** Area left clear, in pixels of the parent. The parent must clip its overflow. */
  target: Rect;
  /** 0 is no dimming, 1 is the full token scrim. */
  progress: number;
  padding: number;
  radius: number;
}

/** Dims everything in the parent except one region: isolation without hiding the context. */
export function DimMask({ target, progress, padding, radius }: DimMaskProps): ReactNode {
  const tokens = useTokens();
  if (progress <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: target.x - padding,
        top: target.y - padding,
        width: target.width + padding * 2,
        height: target.height + padding * 2,
        borderRadius: radius,
        boxShadow: `0 0 0 9999px ${withAlpha(tokens.colours.background, MOTION.focus.dim)}`,
        opacity: progress,
      }}
    />
  );
}
