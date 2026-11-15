import type { ReactNode } from "react";
import { useCurrentFrame } from "remotion";
import { withAlpha } from "../design/colour";
import { useLayout, useSceneEnvironment, useTokens } from "../design/SceneContext";
import { enterProgress } from "../design/motion";
import { staggerSchedule } from "../design/useReveal";
import { Reveal } from "./Reveal";

export interface StepIndicatorProps {
  steps: readonly { title: string; detail?: string | undefined }[];
  /** Scene frame at which the first step appears. */
  startFrame: number;
}

/**
 * A numbered sequence joined by a track that fills as each step arrives, so the viewer
 * always knows which step is being talked about. Horizontal in 16:9, a vertical rail in 9:16.
 */
export function StepIndicator({ steps, startFrame }: StepIndicatorProps): ReactNode {
  const tokens = useTokens();
  const { u, pick, isPortrait } = useLayout();
  const { fps, durationFrames, timing, enter } = useSceneEnvironment();
  const frame = useCurrentFrame();
  const starts = staggerSchedule({
    count: steps.length,
    durationFrames,
    fps,
    startFrame,
    maxStepSeconds: 2.2,
    spread: 0.6,
  });
  const node = u(pick(72, 68));
  const railFrames = Math.round(fps * 0.5);

  const progressOf = (i: number): number =>
    enterProgress(
      frame,
      enter === "none" ? timing.leadFrames : (starts[i] ?? startFrame),
      timing.enterFrames,
    );
  const current = starts.reduce((last, at, i) => (frame >= at ? i : last), 0);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isPortrait ? "1fr" : `repeat(${steps.length}, minmax(0, 1fr))`,
        columnGap: tokens.space[8],
      }}
    >
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const next = starts[i + 1];
        const fill = next === undefined ? 0 : enterProgress(frame, next - railFrames, railFrames);
        const active = i === current;
        const rail = (
          <div
            style={{
              flex: 1,
              backgroundColor: tokens.colours.hairlineStrong,
              ...(isPortrait
                ? {
                    width: tokens.stroke.regular,
                    minHeight: u(28),
                    marginTop: u(10),
                    marginBottom: u(10),
                  }
                : { height: tokens.stroke.regular, marginLeft: tokens.space[5] }),
              opacity: progressOf(i),
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                backgroundColor: tokens.colours.primary,
                ...(isPortrait
                  ? { width: "100%", height: `${fill * 100}%` }
                  : { height: "100%", width: `${fill * 100}%` }),
              }}
            />
          </div>
        );
        const marker = (
          <div
            style={{
              width: node,
              height: node,
              flexShrink: 0,
              boxSizing: "border-box",
              borderRadius: tokens.radii.pill,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: tokens.fonts.mono,
              fontWeight: 600,
              fontSize: node * 0.4,
              color: active ? tokens.colours.onPrimary : tokens.colours.accent,
              backgroundColor: active
                ? tokens.colours.primary
                : withAlpha(tokens.colours.primary, 0.14),
              border: `${tokens.stroke.regular}px solid ${active ? tokens.colours.primary : withAlpha(tokens.colours.primary, 0.5)}`,
            }}
          >
            {i + 1}
          </div>
        );
        const copy = (
          <div
            style={{ display: "flex", flexDirection: "column", gap: tokens.space[3], minWidth: 0 }}
          >
            <div
              style={{
                ...tokens.type.h3,
                fontWeight: 600,
                fontSize: u(pick(steps.length > 4 ? 34 : 44, 44)),
                color: tokens.colours.text,
                textWrap: "balance",
              }}
            >
              {step.title}
            </div>
            {step.detail ? (
              <div
                style={{
                  ...tokens.type.small,
                  fontSize: u(pick(steps.length > 4 ? 25 : 30, 32)),
                  color: tokens.colours.textMuted,
                  textWrap: "pretty",
                }}
              >
                {step.detail}
              </div>
            ) : null}
          </div>
        );

        return isPortrait ? (
          <div key={step.title} style={{ display: "flex", gap: tokens.space[8] }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Reveal at={starts[i]} distance={0}>
                {marker}
              </Reveal>
              {isLast ? null : rail}
            </div>
            <Reveal
              at={starts[i]}
              style={{ flex: 1, minWidth: 0, paddingTop: u(6), paddingBottom: isLast ? 0 : u(48) }}
            >
              {copy}
            </Reveal>
          </div>
        ) : (
          <div
            key={step.title}
            style={{ display: "flex", flexDirection: "column", gap: tokens.space[8], minWidth: 0 }}
          >
            <div style={{ display: "flex", alignItems: "center", marginRight: -tokens.space[8] }}>
              <Reveal at={starts[i]} distance={0}>
                {marker}
              </Reveal>
              {isLast ? null : rail}
            </div>
            <Reveal at={starts[i]} style={{ paddingRight: tokens.space[4] }}>
              {copy}
            </Reveal>
          </div>
        );
      })}
    </div>
  );
}
