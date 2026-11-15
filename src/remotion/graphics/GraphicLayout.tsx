import type { ReactNode } from "react";
import { Reveal } from "../components/Reveal";
import type { Rect } from "../design/layout";
import { useLayout, useTokens } from "../design/SceneContext";
import type { Tokens } from "../design/tokens";
import { graphicFrame, type GraphicFrame, type GraphicMetrics } from "../lib/graphic";

export function graphicMetrics(
  tokens: Tokens,
  layout: Pick<GraphicMetrics, "u" | "pick">,
): GraphicMetrics {
  return {
    u: layout.u,
    pick: layout.pick,
    headingSize: tokens.type.h2.fontSize,
    headingLineHeight: tokens.type.h2.lineHeight,
  };
}

/** The heading and body boxes of a graphic in the current scene's content zone. */
export function useGraphicFrame(heading: string | undefined): GraphicFrame {
  const tokens = useTokens();
  const layout = useLayout();
  return graphicFrame(layout.zones.content, heading, graphicMetrics(tokens, layout));
}

export interface GraphicLayoutProps {
  heading?: string | undefined;
  children: (body: Rect) => ReactNode;
}

/**
 * Frame shared by every motion graphic: an optional heading top left, and below it a body
 * with known pixel dimensions that the graphic positions everything inside absolutely.
 */
export function GraphicLayout({ heading, children }: GraphicLayoutProps): ReactNode {
  const tokens = useTokens();
  const frame = useGraphicFrame(heading);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {heading && frame.heading ? (
        <Reveal style={{ position: "absolute", left: 0, top: 0, width: frame.heading.width }}>
          <div
            style={{
              ...tokens.type.h2,
              fontSize: frame.heading.size,
              color: tokens.colours.text,
              textWrap: "balance",
            }}
          >
            {heading}
          </div>
        </Reveal>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: frame.body.x,
          top: frame.body.y,
          width: frame.body.width,
          height: frame.body.height,
        }}
      >
        {children({ x: 0, y: 0, width: frame.body.width, height: frame.body.height })}
      </div>
    </div>
  );
}
