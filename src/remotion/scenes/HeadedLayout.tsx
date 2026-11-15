import type { ReactNode } from "react";
import { Reveal } from "../components/Reveal";
import { estimateLines, fitFontSize } from "../design/layout";
import { useLayout, useSceneEnvironment, useTokens } from "../design/SceneContext";

export interface BodyBox {
  width: number;
  /** Height left for the body once the heading has taken its share. */
  height: number;
  /** Scene frame at which the body should start to appear. */
  startFrame: number;
}

export interface HeadedLayoutProps {
  heading?: string | undefined;
  /** `fill` gives the body all remaining height; `hug` centres heading and body as a group. */
  body: "fill" | "hug";
  children: (box: BodyBox) => ReactNode;
}

/**
 * Heading above a body, shared by every scene that has one. The heading's height is
 * estimated from its text so the body can be given exact pixel dimensions up front.
 */
export function HeadedLayout({ heading, body, children }: HeadedLayoutProps): ReactNode {
  const tokens = useTokens();
  const { u, pick, zones } = useLayout();
  const { timing, fps } = useSceneEnvironment();
  const { width, height } = zones.content;
  const gap = u(pick(52, 48));
  const headingWidth = Math.min(width, u(pick(1500, 866)));
  const size = heading
    ? fitFontSize({
        text: heading,
        maxWidth: headingWidth,
        maxLines: pick(2, 3),
        size: tokens.type.h2.fontSize,
        minSize: u(40),
      })
    : 0;
  const headingHeight = heading
    ? estimateLines(heading, headingWidth, size) * size * tokens.type.h2.lineHeight
    : 0;
  const bodyHeight = Math.max(0, height - (heading ? headingHeight + gap : 0));
  const start = timing.leadFrames;
  const bodyStart = heading ? start + Math.round(fps * 0.3) : start;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap,
      }}
    >
      {heading ? (
        <Reveal at={start} style={{ flexShrink: 0 }}>
          <div
            style={{
              ...tokens.type.h2,
              fontSize: size,
              color: tokens.colours.text,
              maxWidth: headingWidth,
              textWrap: "balance",
            }}
          >
            {heading}
          </div>
        </Reveal>
      ) : null}
      <div style={body === "fill" ? { height: bodyHeight, flexShrink: 0 } : { flexShrink: 0 }}>
        {children({ width, height: bodyHeight, startFrame: bodyStart })}
      </div>
    </div>
  );
}
