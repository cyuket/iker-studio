import type { ReactNode } from "react";
import { useTokens } from "../design/SceneContext";

export interface ScoreBarProps {
  width: number;
  height: number;
  /** 0-1 share of the track that is filled once `progress` reaches 1. */
  level: number;
  /** 0-1 position of a threshold tick; omitted for none. */
  threshold?: number | undefined;
  /** 0-1 progress of the fill. */
  progress: number;
  colour: string;
}

/**
 * A level on a track, optionally against a threshold. It carries no numerals on purpose:
 * it says "this strong, relative to that line", never a figure nobody measured.
 */
export function ScoreBar({
  width,
  height,
  level,
  threshold,
  progress,
  colour,
}: ScoreBarProps): ReactNode {
  const tokens = useTokens();
  const fill = Math.min(1, Math.max(0, level)) * Math.min(1, Math.max(0, progress));
  return (
    <div style={{ position: "relative", width, height }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: tokens.radii.pill,
          backgroundColor: tokens.colours.hairlineStrong,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: width * fill,
          height,
          borderRadius: tokens.radii.pill,
          backgroundColor: colour,
        }}
      />
      {threshold === undefined ? null : (
        <div
          style={{
            position: "absolute",
            left: width * threshold - tokens.stroke.regular / 2,
            top: -height,
            width: tokens.stroke.regular,
            height: height * 3,
            borderRadius: tokens.radii.pill,
            backgroundColor: tokens.colours.text,
          }}
        />
      )}
    </div>
  );
}
