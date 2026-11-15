import type { ReactNode } from "react";
import type { ResolvedRecording } from "../../domain/render-props";
import type { Region } from "../../domain/storyboard";
import { useLayout, useTokens } from "../design/SceneContext";
import { RecordingMedia, type RecordingMode } from "./RecordingMedia";

export interface FeatureHighlightProps {
  recording: ResolvedRecording;
  mode: RecordingMode;
  /** Part of the recording to magnify, in viewport fractions. */
  crop: Region;
  width: number;
  height: number;
  /** What the viewer should notice; shown above the panel. */
  caption: string | null;
  /** Second of the recording to show, when the scene controls playback. */
  atSeconds?: number | undefined;
}

export function featureHighlightHeaderHeight(u: (value: number) => number): number {
  return u(56);
}

/**
 * A magnified view of one region of the recording. It shows the same pixels as the frame
 * above it, enlarged, so the interaction that matters stays readable on a phone.
 */
export function FeatureHighlight({
  recording,
  mode,
  crop,
  width,
  height,
  caption,
  atSeconds,
}: FeatureHighlightProps): ReactNode {
  const tokens = useTokens();
  const { u } = useLayout();
  const header = featureHighlightHeaderHeight(u);
  const panelHeight = height - header;
  const mediaWidth = width / crop.width;
  const mediaHeight = panelHeight / crop.height;
  return (
    <div style={{ width, height, display: "flex", flexDirection: "column" }}>
      <div
        style={{
          height: header,
          display: "flex",
          alignItems: "flex-start",
          gap: tokens.space[4],
          minWidth: 0,
        }}
      >
        {caption ? (
          <div
            style={{
              fontFamily: tokens.fonts.sans,
              fontWeight: 600,
              fontSize: u(30),
              lineHeight: `${u(36)}px`,
              color: tokens.colours.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {caption}
          </div>
        ) : null}
      </div>
      <div
        style={{
          position: "relative",
          width,
          height: panelHeight,
          boxSizing: "border-box",
          overflow: "hidden",
          borderRadius: tokens.radii.lg,
          backgroundColor: tokens.colours.surface,
          boxShadow: `0 0 0 ${tokens.stroke.regular}px ${tokens.colours.accent}, ${tokens.shadows.raised}`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: -crop.x * mediaWidth,
            top: -crop.y * mediaHeight,
            width: mediaWidth,
            height: mediaHeight,
          }}
        >
          <RecordingMedia recording={recording} mode={mode} atSeconds={atSeconds} />
        </div>
      </div>
    </div>
  );
}
