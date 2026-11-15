import type { ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { CaptionCue } from "../../domain/captions";
import { withAlpha } from "../design/colour";
import { zoneMetrics, type Rect } from "../design/layout";
import { useLayout, useSceneEnvironment, useTokens } from "../design/SceneContext";
import { activeCue, activeWordIndex, cueLineTokens } from "../lib/captions";

export interface AnimatedCaptionProps {
  cues: readonly CaptionCue[];
  /** The band reserved for captions, inside the safe area and clear of every other overlay. */
  zone: Rect;
}

/**
 * Burned-in captions. Lines are shown exactly as the pipeline wrapped them; the word being
 * spoken is picked out and words already spoken stay bright, using colour only so the
 * text never shifts while it is being read.
 */
export function AnimatedCaption({ cues, zone }: AnimatedCaptionProps): ReactNode {
  const tokens = useTokens();
  const layout = useLayout();
  const { fps } = useSceneEnvironment();
  const frame = useCurrentFrame();
  const seconds = frame / fps;
  const cue = activeCue(cues, seconds);
  if (!cue) return null;

  const metrics = zoneMetrics(layout);
  const current = activeWordIndex(cue, seconds);
  const cueStart = cue.startSeconds * fps;
  const opacity = interpolate(frame, [cueStart - 1, cueStart + 2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fontSize = metrics.captionLineHeight * 0.76;

  return (
    <div
      style={{
        position: "absolute",
        left: zone.x,
        top: zone.y,
        width: zone.width,
        height: zone.height,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        opacity,
      }}
    >
      <div
        style={{
          maxWidth: "100%",
          boxSizing: "border-box",
          padding: `${metrics.captionPadding}px ${metrics.captionPadding * 2}px`,
          borderRadius: tokens.radii.md,
          backgroundColor: withAlpha(tokens.colours.background, 0.82),
          border: `${tokens.stroke.hairline}px solid ${tokens.colours.hairline}`,
          textAlign: "center",
          fontFamily: tokens.fonts.sans,
          fontWeight: 600,
          fontSize,
          lineHeight: `${metrics.captionLineHeight}px`,
          letterSpacing: "-0.01em",
        }}
      >
        {cueLineTokens(cue).map((line, lineIndex) => (
          <div key={lineIndex} style={{ whiteSpace: "nowrap" }}>
            {line.map((token, tokenIndex) => {
              const spoken = token.wordIndex >= 0 && token.wordIndex < current;
              const speaking = token.wordIndex >= 0 && token.wordIndex === current;
              return (
                <span
                  key={tokenIndex}
                  style={{
                    color: speaking
                      ? tokens.colours.accent
                      : spoken || token.wordIndex < 0
                        ? tokens.colours.text
                        : withAlpha(tokens.colours.text, 0.5),
                  }}
                >
                  {tokenIndex > 0 ? " " : ""}
                  {token.text}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
