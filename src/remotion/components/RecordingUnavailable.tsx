import type { ReactNode } from "react";
import { withAlpha } from "../design/colour";
import { useLayout, useTokens } from "../design/SceneContext";
import { labelStyle } from "../design/tokens";

export interface RecordingUnavailableProps {
  scenarioId: string;
  width: number;
  height: number;
}

/**
 * Shown when a product scene has no capture. It is deliberately a blunt placeholder with
 * no interface drawn in it, so an unfinished scene can never pass for real product footage.
 */
export function RecordingUnavailable({
  scenarioId,
  width,
  height,
}: RecordingUnavailableProps): ReactNode {
  const tokens = useTokens();
  const { u, pick } = useLayout();
  const stripe = u(22);
  return (
    <div
      style={{
        width,
        height,
        boxSizing: "border-box",
        borderRadius: tokens.radii.lg,
        border: `${tokens.stroke.strong}px dashed ${withAlpha(tokens.colours.warning, 0.75)}`,
        background: `repeating-linear-gradient(135deg, ${withAlpha(tokens.colours.warning, 0.07)} 0 ${stripe}px, transparent ${stripe}px ${stripe * 2}px), ${withAlpha(tokens.colours.surface, 0.8)}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: tokens.space[6],
        padding: tokens.space[10],
      }}
    >
      <div style={labelStyle(tokens, tokens.colours.warning)}>Placeholder · not final</div>
      <div style={{ ...tokens.type.h2, color: tokens.colours.text }}>Recording not available</div>
      <div
        style={{
          ...tokens.type.body,
          color: tokens.colours.textSoft,
          maxWidth: u(pick(900, 720)),
          textWrap: "balance",
        }}
      >
        No capture was found for this scene. Record the scenario, then render again.
      </div>
      <div
        style={{
          fontFamily: tokens.fonts.mono,
          fontSize: u(pick(24, 28)),
          color: tokens.colours.text,
          backgroundColor: tokens.colours.background,
          border: `${tokens.stroke.hairline}px solid ${tokens.colours.hairlineStrong}`,
          borderRadius: tokens.radii.sm,
          padding: `${u(10)}px ${u(18)}px`,
          overflowWrap: "anywhere",
        }}
      >
        scenario: {scenarioId}
      </div>
    </div>
  );
}
