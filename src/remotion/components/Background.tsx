import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { withAlpha } from "../design/colour";
import { useLayout, useTokens } from "../design/SceneContext";

/**
 * The single canvas behind every scene. It is completely static: scenes are rendered as
 * separate segments and hard-cut together, so any drift here would jump at each join.
 */
export function Background(): ReactNode {
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
