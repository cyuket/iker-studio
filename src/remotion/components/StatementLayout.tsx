import type { ReactNode } from "react";
import type { Tone } from "../../domain/storyboard";
import { estimateLines, fitFontSize } from "../design/layout";
import { useLayout, useSceneEnvironment, useTokens } from "../design/SceneContext";
import { toneColour } from "../design/tokens";
import { staggerSchedule } from "../design/useReveal";
import { Reveal } from "./Reveal";

export interface StatementLayoutProps {
  headline: string;
  body?: string | undefined;
  points: readonly { title: string; detail?: string | undefined }[];
  tone: Tone;
}

/** A claim and the evidence under it. Points share a row in 16:9 and stack in 9:16. */
export function StatementLayout({ headline, body, points, tone }: StatementLayoutProps): ReactNode {
  const tokens = useTokens();
  const { u, pick, isPortrait, zones } = useLayout();
  const { timing, fps, durationFrames } = useSceneEnvironment();
  const start = timing.leadFrames;
  const step = Math.round(fps * 0.14);
  const accent = tone === "neutral" ? tokens.colours.accent : toneColour(tokens, tone);
  const hasPoints = points.length > 0;
  const maxWidth = Math.min(zones.content.width, u(pick(hasPoints ? 1500 : 1560, 866)));
  const headlineSize = fitFontSize({
    text: headline,
    maxWidth,
    maxLines: pick(hasPoints ? 2 : 3, hasPoints ? 3 : 5),
    size: hasPoints ? tokens.type.h1.fontSize : tokens.type.display.fontSize * pick(0.86, 0.9),
    minSize: u(52),
  });
  const pointStarts = staggerSchedule({
    count: points.length,
    durationFrames,
    fps,
    startFrame: start + step * (body ? 6 : 4),
    maxStepSeconds: 1.4,
  });

  // Estimated height of the whole block. When a long statement would not fit the content
  // zone (typically 9:16 with captions burned in) it is scaled down as one piece, so
  // nothing can spill into the caption or disclosure bands.
  const sectionGap = u(56);
  const detailSize = u(pick(26, 31));
  const pointWidth = isPortrait
    ? maxWidth - u(80)
    : (maxWidth - (points.length - 1) * tokens.space[10]) / Math.max(1, points.length);
  const pointHeights = points.map(
    (point) =>
      u(pick(72, 52)) +
      estimateLines(point.title, pointWidth, tokens.type.h3.fontSize) *
        tokens.type.h3.fontSize *
        tokens.type.h3.lineHeight +
      (point.detail
        ? tokens.space[3] +
          estimateLines(point.detail, pointWidth, detailSize, 0.46) * detailSize * 1.4
        : 0),
  );
  const pointsHeight = isPortrait
    ? pointHeights.reduce((sum, value) => sum + value, 0)
    : Math.max(0, ...pointHeights);
  const estimatedHeight =
    estimateLines(headline, maxWidth, headlineSize) * headlineSize * tokens.type.h1.lineHeight +
    (body
      ? tokens.space[8] +
        estimateLines(body, Math.min(maxWidth, u(1120)), tokens.type.bodyLg.fontSize, 0.46) *
          tokens.type.bodyLg.fontSize *
          tokens.type.bodyLg.lineHeight
      : 0) +
    (hasPoints ? sectionGap + pointsHeight : 0);
  const scale = Math.min(1, zones.content.height / Math.max(1, estimatedHeight));

  return (
    <div
      style={{
        width: `${100 / scale}%`,
        height: `${100 / scale}%`,
        transform: scale < 1 ? `scale(${scale})` : "none",
        transformOrigin: "0 0",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: sectionGap,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[8] }}>
        <Reveal at={start + step}>
          <div
            style={{
              ...tokens.type.h1,
              fontSize: headlineSize,
              color: tokens.colours.text,
              maxWidth,
              textWrap: "balance",
            }}
          >
            {headline}
          </div>
        </Reveal>
        {body ? (
          <Reveal at={start + step * 3}>
            <div
              style={{
                ...tokens.type.bodyLg,
                color: tokens.colours.textMuted,
                maxWidth: Math.min(maxWidth, u(1120)),
                textWrap: "pretty",
              }}
            >
              {body}
            </div>
          </Reveal>
        ) : null}
      </div>
      {hasPoints ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isPortrait ? "1fr" : `repeat(${points.length}, minmax(0, 1fr))`,
            gap: isPortrait ? 0 : tokens.space[10],
          }}
        >
          {points.map((point, i) => (
            <Reveal key={point.title} at={pointStarts[i]}>
              <div
                style={{
                  display: "flex",
                  flexDirection: isPortrait ? "row" : "column",
                  gap: isPortrait ? tokens.space[8] : tokens.space[5],
                  borderTop: `${tokens.stroke.hairline}px solid ${accent}`,
                  padding: isPortrait ? `${u(26)}px 0` : `${u(28)}px 0 0`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: tokens.space[3],
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      ...tokens.type.h3,
                      fontWeight: 600,
                      color: tokens.colours.text,
                      textWrap: "balance",
                    }}
                  >
                    {point.title}
                  </div>
                  {point.detail ? (
                    <div
                      style={{
                        ...tokens.type.small,
                        fontSize: u(pick(26, 31)),
                        color: tokens.colours.textMuted,
                        textWrap: "pretty",
                      }}
                    >
                      {point.detail}
                    </div>
                  ) : null}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      ) : null}
    </div>
  );
}
