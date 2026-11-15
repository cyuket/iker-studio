import type { ReactNode } from "react";
import type { Rect } from "../design/layout";
import { useLayout, useTokens } from "../design/SceneContext";

export interface AnnotationProps {
  text: string;
  /** Region being called out, in pixels of the parent. */
  target: Rect;
  /** Size of the parent the label must stay inside. */
  bounds: { width: number; height: number };
  opacity: number;
  /** Vertical offset in pixels for the entrance; 0 once settled. */
  rise: number;
}

/** Glyph advance of the label face as a fraction of its size, used to keep labels in bounds. */
const LABEL_ADVANCE = 0.56;

/**
 * An outline around part of the recording with a label attached. The label is set at
 * output size rather than scaling with the recording, so it stays legible in every format,
 * and it flips below its target when there is no room above.
 */
export function Annotation({ text, target, bounds, opacity, rise }: AnnotationProps): ReactNode {
  const tokens = useTokens();
  const { u, pick } = useLayout();
  const fontSize = u(pick(24, 27));
  const paddingX = u(16);
  const height = fontSize * 1.9;
  const gap = u(10);
  const outline = u(6);
  const margin = u(8);

  const maxWidth = Math.max(0, bounds.width - margin * 2);
  const width = Math.min(maxWidth, text.length * fontSize * LABEL_ADVANCE + paddingX * 2);
  const left = Math.min(
    Math.max(margin, target.x - outline),
    Math.max(margin, bounds.width - margin - width),
  );
  const above = target.y - outline - gap - height >= margin;
  const top = above
    ? target.y - outline - gap - height
    : Math.min(target.y + target.height + outline + gap, bounds.height - margin - height);

  return (
    <div style={{ position: "absolute", inset: 0, opacity }}>
      <div
        style={{
          position: "absolute",
          left: target.x - outline,
          top: target.y - outline,
          width: target.width + outline * 2,
          height: target.height + outline * 2,
          boxSizing: "border-box",
          borderRadius: tokens.radii.md,
          border: `${tokens.stroke.strong}px solid ${tokens.colours.primary}`,
          boxShadow: tokens.shadows.glow,
        }}
      />
      <div
        style={{
          position: "absolute",
          left,
          top: top + (above ? rise : -rise),
          height,
          maxWidth,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          padding: `0 ${paddingX}px`,
          borderRadius: tokens.radii.sm,
          backgroundColor: tokens.colours.primary,
          color: tokens.colours.onPrimary,
          fontFamily: tokens.fonts.sans,
          fontWeight: 600,
          fontSize,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          boxShadow: tokens.shadows.panel,
        }}
      >
        {text}
      </div>
    </div>
  );
}
