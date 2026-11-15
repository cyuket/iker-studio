import type { ReactNode } from "react";
import { fitFontSize } from "../design/layout";
import { useLayout, useSceneEnvironment, useTokens } from "../design/SceneContext";
import { useEnterProgress } from "../design/useReveal";
import { Reveal } from "./Reveal";

export interface ChapterTransitionProps {
  title: string;
}

/** A beat between sections: chapter number, a rule that draws in, and the title. */
export function ChapterTransition({ title }: ChapterTransitionProps): ReactNode {
  const tokens = useTokens();
  const { u, pick, zones } = useLayout();
  const { timing, fps, reducedMotion } = useSceneEnvironment();
  const start = timing.leadFrames;
  const step = Math.round(fps * 0.16);
  const rule = useEnterProgress(start + step, Math.round(fps * 1.1));
  const maxWidth = Math.min(zones.content.width, u(pick(1400, 866)));
  const titleSize = fitFontSize({
    text: title,
    maxWidth,
    maxLines: pick(2, 4),
    size: tokens.type.display.fontSize,
    minSize: u(60),
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: tokens.space[10],
      }}
    >
      <div
        style={{
          width: reducedMotion ? "100%" : `${rule * 100}%`,
          opacity: reducedMotion ? rule : 1,
          height: tokens.stroke.hairline,
          background: `linear-gradient(90deg, ${tokens.colours.primary}, ${tokens.colours.hairline})`,
        }}
      />
      <Reveal at={start + step * 2}>
        <div
          style={{
            ...tokens.type.display,
            fontSize: titleSize,
            color: tokens.colours.text,
            maxWidth,
            textWrap: "balance",
          }}
        >
          {title}
        </div>
      </Reveal>
    </div>
  );
}
