import type { ReactNode } from "react";
import { useCurrentFrame } from "remotion";
import type { Tone } from "../../domain/storyboard";
import { withAlpha } from "../design/colour";
import { useLayout, useSceneEnvironment, useTokens } from "../design/SceneContext";
import { enterProgress } from "../design/motion";
import { toneColour } from "../design/tokens";
import { staggerSchedule } from "../design/useReveal";
import { formatValue } from "../lib/format";
import { Reveal } from "./Reveal";

export interface DataVisualisationProps {
  unit: string;
  series: readonly { label: string; value: number; tone: Tone }[];
  source: string;
  illustrative: boolean;
  /** Scene frame at which the first bar appears. */
  startFrame: number;
}

/**
 * Horizontal bars with the value printed on every row. The source line is always shown,
 * and illustrative data is marked as such next to the numbers it qualifies.
 */
export function DataVisualisation({
  unit,
  series,
  source,
  illustrative,
  startFrame,
}: DataVisualisationProps): ReactNode {
  const tokens = useTokens();
  const { u, pick, isPortrait } = useLayout();
  const { fps, durationFrames, timing, reducedMotion, enter } = useSceneEnvironment();
  const frame = useCurrentFrame();
  const starts = staggerSchedule({
    count: series.length,
    durationFrames,
    fps,
    startFrame,
    maxStepSeconds: 0.9,
    spread: 0.4,
  });
  const peak = Math.max(1e-9, ...series.map((entry) => Math.abs(entry.value)));
  const barHeight = u(series.length > 4 ? 24 : 34);
  const valueSize = u(pick(series.length > 4 ? 44 : 60, series.length > 4 ? 46 : 58));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: u(pick(44, 40)) }}>
      {illustrative ? (
        <Reveal at={startFrame}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: tokens.space[4],
              padding: `${u(12)}px ${u(20)}px`,
              borderRadius: tokens.radii.sm,
              backgroundColor: withAlpha(tokens.colours.warning, 0.12),
              border: `${tokens.stroke.hairline}px solid ${withAlpha(tokens.colours.warning, 0.6)}`,
              color: tokens.colours.warning,
              fontFamily: tokens.fonts.mono,
              fontWeight: 600,
              fontSize: u(pick(24, 28)),
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Illustrative
            <span
              style={{
                fontWeight: 500,
                letterSpacing: "0.02em",
                textTransform: "none",
                color: tokens.colours.textSoft,
              }}
            >
              not measured data
            </span>
          </div>
        </Reveal>
      ) : null}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: u(pick(series.length > 4 ? 28 : 48, series.length > 4 ? 30 : 44)),
        }}
      >
        {series.map((entry, i) => {
          const at = enter === "none" ? timing.leadFrames : (starts[i] ?? startFrame);
          const grow = enterProgress(frame, at + Math.round(fps * 0.1), Math.round(fps * 1.1));
          const fraction = Math.abs(entry.value) / peak;
          const colour = toneColour(tokens, entry.tone);
          const label = (
            <div
              style={{
                ...tokens.type.body,
                fontSize: u(pick(34, 36)),
                color: tokens.colours.textSoft,
                textWrap: "balance",
                minWidth: 0,
              }}
            >
              {entry.label}
            </div>
          );
          const value = (
            <div
              style={{
                fontFamily: tokens.fonts.display,
                fontWeight: 600,
                fontSize: valueSize,
                lineHeight: 1,
                letterSpacing: "-0.03em",
                fontVariantNumeric: "tabular-nums",
                color: tokens.colours.text,
                whiteSpace: "nowrap",
                textAlign: "right",
              }}
            >
              {formatValue(entry.value, unit)}
            </div>
          );
          const bar = (
            <div
              style={{
                height: barHeight,
                borderRadius: tokens.radii.pill,
                backgroundColor: withAlpha(tokens.colours.text, 0.07),
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${fraction * (reducedMotion ? 1 : grow) * 100}%`,
                  opacity: reducedMotion ? grow : 1,
                  minWidth: barHeight,
                  borderRadius: tokens.radii.pill,
                  background: `linear-gradient(90deg, ${withAlpha(colour, 0.55)}, ${colour})`,
                }}
              />
            </div>
          );
          return (
            <Reveal key={entry.label} at={at} distance={12}>
              {isPortrait ? (
                <div style={{ display: "flex", flexDirection: "column", gap: u(16) }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "space-between",
                      gap: tokens.space[8],
                    }}
                  >
                    {label}
                    {value}
                  </div>
                  {bar}
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `${u(430)}px 1fr ${u(300)}px`,
                    alignItems: "center",
                    columnGap: tokens.space[10],
                  }}
                >
                  {label}
                  {bar}
                  {value}
                </div>
              )}
            </Reveal>
          );
        })}
      </div>
      <Reveal at={startFrame}>
        <div
          style={{
            ...tokens.type.small,
            color: tokens.colours.textMuted,
            borderTop: `${tokens.stroke.hairline}px solid ${tokens.colours.hairlineStrong}`,
            paddingTop: u(20),
          }}
        >
          <span style={{ color: tokens.colours.textSoft, fontWeight: 600 }}>Source: </span>
          {source}
          {illustrative ? " · Illustrative figures" : ""}
        </div>
      </Reveal>
    </div>
  );
}
