import type { ReactNode } from "react";
import { withAlpha } from "../design/colour";
import type { Layout } from "../design/layout";
import { useLayout, useTokens } from "../design/SceneContext";
import type { BrowserFrameSize } from "../lib/product-layout";

export { fitBrowserFrame, type BrowserFrameSize } from "../lib/product-layout";

export function browserBarHeight(layout: Pick<Layout, "u" | "pick">): number {
  return layout.u(layout.pick(48, 46));
}

export interface BrowserFrameProps {
  size: BrowserFrameSize;
  /** Extra shadow layers under the default one; used by the cinematic frame. */
  shadow?: string | undefined;
  /** Address shown in the bar; already stripped of credentials and query strings upstream. */
  displayUrl: string;
  children: ReactNode;
}

/** Neutral browser chrome around a recording: enough to say "this is a web app", no more. */
export function BrowserFrame({ size, displayUrl, shadow, children }: BrowserFrameProps): ReactNode {
  const tokens = useTokens();
  const { u } = useLayout();
  const dot = size.barHeight * 0.22;
  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        borderRadius: tokens.radii.lg,
        backgroundColor: tokens.colours.surface,
        boxShadow: `0 0 0 ${tokens.stroke.hairline}px ${tokens.colours.hairlineStrong}, ${shadow ?? tokens.shadows.raised}`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          height: size.barHeight,
          flexShrink: 0,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: size.barHeight * 0.4,
          padding: `0 ${size.barHeight * 0.4}px`,
          backgroundColor: tokens.colours.surfaceRaised,
          borderBottom: `${tokens.stroke.hairline}px solid ${tokens.colours.hairline}`,
        }}
      >
        <div style={{ display: "flex", gap: dot * 0.7 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: dot,
                height: dot,
                borderRadius: tokens.radii.pill,
                backgroundColor: withAlpha(tokens.colours.text, 0.18),
              }}
            />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            height: size.barHeight * 0.62,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: u(8),
            borderRadius: tokens.radii.sm,
            backgroundColor: withAlpha(tokens.colours.background, 0.7),
            color: tokens.colours.textMuted,
            fontFamily: tokens.fonts.mono,
            fontSize: size.barHeight * 0.34,
            padding: `0 ${u(14)}px`,
          }}
        >
          <svg
            width={size.barHeight * 0.28}
            height={size.barHeight * 0.28}
            viewBox="0 0 24 24"
            fill="none"
            style={{ flexShrink: 0 }}
          >
            <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" />
          </svg>
          <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {displayUrl}
          </div>
        </div>
        <div style={{ width: dot * 4.4, flexShrink: 0 }} />
      </div>
      <div
        style={{
          position: "relative",
          width: size.width,
          height: size.viewportHeight,
          overflow: "hidden",
          backgroundColor: tokens.colours.background,
        }}
      >
        {children}
      </div>
    </div>
  );
}
