import type { ReactNode } from "react";
import type { ResolvedBrand } from "../../domain/render-props";
import { fitFontSize } from "../design/layout";
import { useLayout, useSceneEnvironment, useTokens } from "../design/SceneContext";
import { Reveal } from "./Reveal";
import { Wordmark } from "./Wordmark";

export interface CallToActionProps {
  brand: ResolvedBrand;
  headline: string;
  action: string;
  url: string;
}

/** One ask, one address. The action reads as a button; the URL is set to be typed. */
export function CallToAction({ brand, headline, action, url }: CallToActionProps): ReactNode {
  const tokens = useTokens();
  const { u, pick, zones } = useLayout();
  const { timing, fps } = useSceneEnvironment();
  const step = Math.round(fps * 0.16);
  const start = timing.leadFrames;
  const maxWidth = Math.min(zones.content.width, u(pick(1400, 866)));
  const headlineSize = fitFontSize({
    text: headline,
    maxWidth,
    maxLines: pick(2, 4),
    size: pick(tokens.type.display.fontSize, tokens.type.h1.fontSize),
    minSize: u(56),
  });
  const buttonHeight = u(100);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: tokens.space[12],
      }}
    >
      <Reveal at={start}>
        <Wordmark brand={brand} height={u(46)} />
      </Reveal>
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
      <Reveal at={start + step * 3}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: tokens.space[8],
          }}
        >
          <div
            style={{
              height: buttonHeight,
              padding: `0 ${buttonHeight * 0.5}px`,
              display: "flex",
              alignItems: "center",
              gap: buttonHeight * 0.2,
              borderRadius: tokens.radii.pill,
              backgroundColor: tokens.colours.primary,
              color: tokens.colours.onPrimary,
              boxShadow: tokens.shadows.glow,
              fontFamily: tokens.fonts.display,
              fontWeight: 600,
              fontSize: buttonHeight * 0.4,
              letterSpacing: "-0.015em",
              whiteSpace: "nowrap",
            }}
          >
            {action}
            <svg
              width={buttonHeight * 0.3}
              height={buttonHeight * 0.3}
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M4 12h15m-6-6 6 6-6 6"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div
            style={{
              fontFamily: tokens.fonts.mono,
              fontWeight: 500,
              fontSize: u(pick(34, 36)),
              color: tokens.colours.accent,
              overflowWrap: "anywhere",
              maxWidth,
            }}
          >
            {url}
          </div>
        </div>
      </Reveal>
    </div>
  );
}
