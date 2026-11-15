import type { ReactNode } from "react";
import type { ResolvedBrand } from "../../domain/render-props";
import { useLayout, useSceneEnvironment, useTokens } from "../design/SceneContext";
import { useEnterProgress } from "../design/useReveal";
import { Reveal } from "./Reveal";
import { Wordmark } from "./Wordmark";

export interface OutroSequenceProps {
  brand: ResolvedBrand;
  tagline?: string | undefined;
}

/** Closing card: the wordmark, one line, and where to find the product. */
export function OutroSequence({ brand, tagline }: OutroSequenceProps): ReactNode {
  const tokens = useTokens();
  const { u, pick } = useLayout();
  const { timing, fps } = useSceneEnvironment();
  const step = Math.round(fps * 0.16);
  const start = timing.leadFrames;
  const rule = useEnterProgress(start + step, Math.round(fps * 0.9));
  const line = tagline ?? brand.tagline;

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
        gap: tokens.space[10],
      }}
    >
      <Reveal at={start}>
        <Wordmark brand={brand} height={u(pick(104, 88))} />
      </Reveal>
      <div
        style={{
          width: u(pick(96, 96)) * rule,
          height: tokens.stroke.regular,
          backgroundColor: tokens.colours.primary,
          opacity: rule,
        }}
      />
      {line ? (
        <Reveal at={start + step * 2}>
          <div
            style={{
              ...tokens.type.h3,
              color: tokens.colours.textSoft,
              maxWidth: u(pick(1100, 820)),
              textWrap: "balance",
            }}
          >
            {line}
          </div>
        </Reveal>
      ) : null}
      {brand.website && brand.logoSrc.wordmark ? (
        <Reveal at={start + step * 3}>
          <div
            style={{
              ...tokens.type.label,
              fontSize: u(pick(26, 30)),
              letterSpacing: "0.04em",
              color: tokens.colours.accent,
            }}
          >
            {brand.website}
          </div>
        </Reveal>
      ) : null}
    </div>
  );
}
