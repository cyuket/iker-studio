import type { ReactNode } from "react";
import type { ResolvedBrand } from "../../domain/render-props";
import { fitFontSize } from "../design/layout";
import { useLayout, useSceneEnvironment, useTokens } from "../design/SceneContext";
import { Reveal } from "./Reveal";
import { Wordmark } from "./Wordmark";

export interface IntroSequenceProps {
  brand: ResolvedBrand;
  headline: string;
  subhead?: string | undefined;
}

/** Opening title card: wordmark, then the headline carrying the frame on its own. */
export function IntroSequence({ brand, headline, subhead }: IntroSequenceProps): ReactNode {
  const tokens = useTokens();
  const { u, pick, zones } = useLayout();
  const { timing, fps } = useSceneEnvironment();
  const step = Math.round(fps * 0.14);
  const start = timing.leadFrames;
  const maxWidth = Math.min(zones.content.width, u(pick(1500, 866)));
  const headlineSize = fitFontSize({
    text: headline,
    maxWidth,
    maxLines: pick(3, 5),
    size: tokens.type.display.fontSize,
    minSize: u(pick(64, 60)),
  });

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <Reveal at={start}>
        <Wordmark brand={brand} height={u(pick(46, 50))} />
      </Reveal>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: tokens.space[8],
          paddingBottom: u(pick(40, 46)),
        }}
      >
        <Reveal at={start + step * 2}>
          <div
            style={{
              ...tokens.type.display,
              fontSize: headlineSize,
              color: tokens.colours.text,
              maxWidth,
              textWrap: "balance",
            }}
          >
            {headline}
          </div>
        </Reveal>
        {subhead ? (
          <Reveal at={start + step * 4}>
            <div
              style={{
                ...tokens.type.bodyLg,
                color: tokens.colours.textMuted,
                maxWidth: Math.min(maxWidth, u(pick(1040, 866))),
                textWrap: "pretty",
              }}
            >
              {subhead}
            </div>
          </Reveal>
        ) : null}
      </div>
    </div>
  );
}
