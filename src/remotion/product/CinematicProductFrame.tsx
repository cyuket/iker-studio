import type { ReactNode } from "react";
import { BrowserFrame } from "../components/BrowserFrame";
import { withAlpha } from "../design/colour";
import { useLayout, useTokens } from "../design/SceneContext";
import type { BrowserFrameSize } from "../lib/product-layout";

export interface CinematicProductFrameProps {
  size: BrowserFrameSize;
  /** Address shown in the bar; already stripped of credentials and query strings upstream. */
  displayUrl: string;
  children: ReactNode;
}

/**
 * The browser frame as an object in the scene rather than a rectangle on it: a soft pool of
 * the brand colour on the canvas behind it, a close contact shadow and a long ambient one,
 * so a light interface sits in the dark canvas instead of glaring out of it. Nothing here
 * moves, glows or tilts.
 */
export function CinematicProductFrame({
  size,
  displayUrl,
  children,
}: CinematicProductFrameProps): ReactNode {
  const tokens = useTokens();
  const { u } = useLayout();
  const spread = u(120);
  const shadow = [
    `0 ${u(2)}px ${u(6)}px ${withAlpha(tokens.colours.background, 0.5)}`,
    `0 ${u(18)}px ${u(40)}px ${withAlpha(tokens.colours.background, 0.55)}`,
    `0 ${u(56)}px ${u(120)}px ${withAlpha(tokens.colours.background, 0.6)}`,
  ].join(", ");
  return (
    <div style={{ position: "relative", width: size.width, height: size.height }}>
      <div
        style={{
          position: "absolute",
          left: -spread,
          top: -spread,
          right: -spread,
          bottom: -spread,
          background: `radial-gradient(closest-side, ${withAlpha(tokens.colours.primary, 0.16)} 0%, ${withAlpha(tokens.colours.primary, 0.05)} 55%, transparent 100%)`,
        }}
      />
      <div style={{ position: "relative" }}>
        <BrowserFrame size={size} displayUrl={displayUrl} shadow={shadow}>
          {children}
        </BrowserFrame>
      </div>
    </div>
  );
}
