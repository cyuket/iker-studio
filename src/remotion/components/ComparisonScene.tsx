import type { ReactNode } from "react";
import type { Tone } from "../../domain/storyboard";
import { withAlpha } from "../design/colour";
import { useLayout, useSceneEnvironment, useTokens } from "../design/SceneContext";
import { toneColour } from "../design/tokens";
import { staggerSchedule } from "../design/useReveal";
import { Reveal } from "./Reveal";

export interface ComparisonSide {
  title: string;
  points: readonly string[];
  tone: Tone;
}

export interface ComparisonSceneProps {
  left: ComparisonSide;
  right: ComparisonSide;
  /** Scene frame at which the first panel appears. */
  startFrame: number;
}

function ToneGlyph({
  tone,
  size,
  colour,
}: {
  tone: Tone;
  size: number;
  colour: string;
}): ReactNode {
  const path =
    tone === "positive" || tone === "primary"
      ? "M5 12.5l4.5 4.5L19 7.5"
      : tone === "danger" || tone === "warning"
        ? "M7 7l10 10M17 7 7 17"
        : "M6 12h12";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path
        d={path}
        stroke={colour}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Two options set against each other: side by side in 16:9, stacked in 9:16. */
export function ComparisonScene({ left, right, startFrame }: ComparisonSceneProps): ReactNode {
  const tokens = useTokens();
  const { u, pick, isPortrait } = useLayout();
  const { fps, durationFrames } = useSceneEnvironment();
  const sides = [left, right];
  // The right-hand panel waits until the left has been read.
  const panelStarts = staggerSchedule({
    count: 2,
    durationFrames,
    fps,
    startFrame,
    maxStepSeconds: 2.4,
    spread: 0.4,
  });
  const pointStep = Math.round(fps * 0.16);
  const glyph = u(pick(34, 38));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isPortrait ? "1fr" : "1fr 1fr",
        gap: u(pick(40, 32)),
        alignItems: "stretch",
      }}
    >
      {sides.map((side, sideIndex) => {
        const colour = toneColour(tokens, side.tone);
        const emphasised = side.tone === "positive" || side.tone === "primary";
        const panelStart = panelStarts[sideIndex] ?? startFrame;
        return (
          <Reveal key={`${sideIndex}-${side.title}`} at={panelStart} style={{ display: "flex" }}>
            <div
              style={{
                flex: 1,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                gap: u(pick(40, 28)),
                padding: u(pick(56, 40)),
                borderRadius: tokens.radii.xl,
                backgroundColor: emphasised
                  ? tokens.colours.surfaceRaised
                  : withAlpha(tokens.colours.surface, 0.72),
                border: `${tokens.stroke.hairline}px solid ${emphasised ? withAlpha(colour, 0.55) : tokens.colours.hairlineStrong}`,
                boxShadow: emphasised ? tokens.shadows.raised : "none",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[6] }}>
                <div
                  style={{
                    width: u(44),
                    height: u(5),
                    borderRadius: tokens.radii.pill,
                    backgroundColor: colour,
                  }}
                />
                <div
                  style={{
                    ...tokens.type.h2,
                    fontSize: u(pick(58, 54)),
                    color: tokens.colours.text,
                    textWrap: "balance",
                  }}
                >
                  {side.title}
                </div>
              </div>
              <div
                style={{
                  height: tokens.stroke.hairline,
                  backgroundColor: tokens.colours.hairlineStrong,
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: u(pick(28, 22)) }}>
                {side.points.map((point, i) => (
                  <Reveal key={point} at={panelStart + pointStep * (i + 2)} distance={12}>
                    <div
                      style={{ display: "flex", alignItems: "flex-start", gap: tokens.space[5] }}
                    >
                      <div style={{ paddingTop: u(pick(4, 6)) }}>
                        <ToneGlyph tone={side.tone} size={glyph} colour={colour} />
                      </div>
                      <div
                        style={{
                          ...tokens.type.body,
                          fontSize: u(pick(35, 36)),
                          color: emphasised ? tokens.colours.text : tokens.colours.textSoft,
                          textWrap: "pretty",
                        }}
                      >
                        {point}
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}
