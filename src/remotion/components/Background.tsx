import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { SceneRenderProps } from "../../domain/render-props";
import { withAlpha } from "../design/colour";
import { useLayout, useSceneEnvironment, useTokens } from "../design/SceneContext";
import { MOTION } from "../design/tokens";
import { backdropFrame } from "../lib/backdrop";

export interface BackgroundProps {
  /**
   * Set for a cut with an animated background. Without it, or with reduced motion, the
   * canvas is completely still.
   */
  backdrop?: SceneRenderProps["backdrop"];
}

/**
 * The single canvas behind every scene. By default it is completely static: scenes are
 * rendered as separate segments and hard-cut together, so drift keyed to a scene's own frames
 * would jump at each join. The animated variant is keyed to the frame of the cut instead
 * (`backdrop.startFrame` plus the scene's frame), so it carries on unbroken across joins.
 */
export function Background({ backdrop = null }: BackgroundProps): ReactNode {
  const { reducedMotion } = useSceneEnvironment();
  if (backdrop === null || reducedMotion) return <StillBackground />;
  return <AnimatedBackground startFrame={backdrop.startFrame} />;
}

function StillBackground(): ReactNode {
  const { colours } = useTokens();
  const { u, pick } = useLayout();
  const grid = u(pick(96, 90));
  const line = withAlpha(colours.text, 0.028);
  return (
    <AbsoluteFill style={{ backgroundColor: colours.background }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse ${pick("70% 62%", "120% 46%")} at 50% 0%, ${withAlpha(colours.primary, 0.2)} 0%, ${withAlpha(colours.primary, 0.06)} 45%, transparent 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(${line} 1px, transparent 1px) 0 0 / ${grid}px ${grid}px, linear-gradient(90deg, ${line} 1px, transparent 1px) 0 0 / ${grid}px ${grid}px`,
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 30%, black 0%, transparent 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 115%, ${withAlpha(colours.accent, 0.07)} 0%, transparent 100%)`,
        }}
      />
    </AbsoluteFill>
  );
}

function AnimatedBackground({ startFrame }: { startFrame: number }): ReactNode {
  const frame = useCurrentFrame();
  const { fps } = useSceneEnvironment();
  const { colours } = useTokens();
  const layout = useLayout();
  const state = backdropFrame({
    seconds: (startFrame + frame) / fps,
    width: layout.width,
    height: layout.height,
    unit: layout.u(1),
    portrait: layout.orientation === "portrait",
    margins: {
      left: layout.safe.x,
      right: layout.width - layout.safe.x - layout.safe.width,
    },
    motion: MOTION.backdrop,
  });
  const line = withAlpha(colours.text, 0.055);
  const { gridSize, gridOffset } = state;
  const glowLayers = state.glows
    .map((glow) => {
      const colour = glow.tone === "primary" ? colours.primary : colours.accent;
      const peak = (glow.tone === "primary" ? 0.3 : 0.14) * glow.strength;
      return `radial-gradient(circle ${String(glow.radius)}px at ${String(glow.x)}px ${String(glow.y)}px, ${withAlpha(colour, peak)} 0%, ${withAlpha(colour, peak * 0.3)} 40%, transparent 70%)`;
    })
    .join(", ");
  return (
    <AbsoluteFill style={{ backgroundColor: colours.background }}>
      <AbsoluteFill style={{ background: glowLayers }} />
      <AbsoluteFill
        style={{
          background: `linear-gradient(${line} 1px, transparent 1px) ${String(gridOffset)}px ${String(gridOffset)}px / ${String(gridSize)}px ${String(gridSize)}px, linear-gradient(90deg, ${line} 1px, transparent 1px) ${String(gridOffset)}px ${String(gridOffset)}px / ${String(gridSize)}px ${String(gridSize)}px`,
          maskImage: "radial-gradient(ellipse 85% 75% at 50% 45%, black 0%, transparent 100%)",
        }}
      />
      {state.dots.map((dot, index) => (
        <div
          // The dot list has a fixed length and order, so the index is a stable identity.
          key={index}
          style={{
            position: "absolute",
            left: dot.x - dot.radius,
            top: dot.y - dot.radius,
            width: dot.radius * 2,
            height: dot.radius * 2,
            borderRadius: "50%",
            opacity: dot.opacity * 0.75,
            ...(dot.ring
              ? { border: `${String(layout.u(2))}px solid ${colours.primary}` }
              : { backgroundColor: colours.primary }),
          }}
        />
      ))}
    </AbsoluteFill>
  );
}
