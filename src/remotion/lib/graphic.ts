import { estimateLines, fitFontSize, type Rect } from "../design/layout";

export interface GraphicMetrics {
  u: (designPixels: number) => number;
  pick: <T>(landscape: T, portrait: T) => T;
  /** Preferred size and line height of the heading. */
  headingSize: number;
  headingLineHeight: number;
}

export interface GraphicFrame {
  /** Fitted heading size and the box it occupies; null without a heading. */
  heading: { size: number; width: number; height: number } | null;
  /** Where the graphic itself is drawn, relative to the content zone. */
  body: Rect;
}

/**
 * Splits a content zone into an optional heading at the top and a body below it. Pure, so
 * a graphic's geometry is known without rendering it: layouts are tested against the body
 * and a handoff can find where an element of a prelude sits on screen.
 */
export function graphicFrame(
  content: { width: number; height: number },
  heading: string | undefined,
  metrics: GraphicMetrics,
): GraphicFrame {
  const { u, pick } = metrics;
  if (!heading) {
    return { heading: null, body: { x: 0, y: 0, width: content.width, height: content.height } };
  }
  const width = Math.min(content.width, u(pick(1500, 866)));
  const size = fitFontSize({
    text: heading,
    maxWidth: width,
    maxLines: pick(2, 3),
    size: metrics.headingSize,
    minSize: u(40),
  });
  const height = estimateLines(heading, width, size) * size * metrics.headingLineHeight;
  const gap = u(pick(44, 40));
  return {
    heading: { size, width, height },
    body: {
      x: 0,
      y: height + gap,
      width: content.width,
      height: Math.max(0, content.height - height - gap),
    },
  };
}
