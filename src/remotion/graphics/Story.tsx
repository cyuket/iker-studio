import type { ReactNode } from "react";
import { interpolateColors } from "remotion";
import type { StoryVisualData } from "../../domain/storyboard";
import type { Rect } from "../design/layout";
import { mix } from "../design/motion";
import { useLayout, useTokens } from "../design/SceneContext";
import { MOTION } from "../design/tokens";
import { useMotion } from "../design/useBeat";
import { layoutStory } from "../lib/story";
import { StatusMark } from "../primitives/StatusMark";
import { GraphicLayout } from "./GraphicLayout";

export interface StoryProps {
  visual: StoryVisualData;
}

/** The geometry of a story block in a given body, shared by the component and tests. */
export function storyLayout(visual: StoryVisualData, body: Rect, portrait: boolean, unit: number) {
  return layoutStory({
    body,
    portrait,
    unit,
    lines: visual.lines.map((line) => ({
      text: line.text,
      role: line.role,
      marked: line.status !== undefined || (visual.mode === "outcome" && line.role === "support"),
    })),
  });
}

/**
 * A few lines of type, revealed in step with the voice. What has been read steps back as
 * the next line arrives, so there is always exactly one thing to look at. In `problem`
 * mode the key line turns the lines before it into the setup for a reversal; in `outcome`
 * mode each line is stamped with its status.
 */
export function Story({ visual }: StoryProps): ReactNode {
  return <GraphicLayout>{(body) => <StoryBody visual={visual} body={body} />}</GraphicLayout>;
}

function StoryBody({ visual, body }: { visual: StoryVisualData; body: Rect }) {
  const tokens = useTokens();
  const { u, isPortrait } = useLayout();
  const m = useMotion();
  const boxes = storyLayout(visual, body, isPortrait, u(1));
  const starts = m.schedule(
    visual.lines.map((line, i) => ({ key: `line:${i}`, cue: line.cue })),
    visual.settled,
  );
  const startOf = (i: number): number => starts[`line:${i}`] ?? m.start;
  const keyIndex = visual.lines.findIndex((line) => line.role === "key");

  return (
    <>
      {visual.lines.map((line, i) => {
        const box = boxes[i];
        if (!box) return null;
        const start = startOf(i);
        const enter = m.tween(start, "enter");
        const settle = m.spring(start, "settle");
        const status =
          line.status ??
          (visual.mode === "outcome" && line.role === "support" ? "verified" : undefined);
        // What makes a line step back: the next line, or in problem mode the key line.
        let recede = 0;
        if (visual.recede) {
          if (visual.mode === "problem" && keyIndex > i) {
            recede = m.tween(startOf(keyIndex), "focus", "move");
          } else if (
            line.role === "support" &&
            visual.mode !== "outcome" &&
            i + 1 < visual.lines.length
          ) {
            recede = m.tween(startOf(i + 1), "focus", "move");
          }
        }
        const colour =
          line.role === "support"
            ? tokens.colours.textSoft
            : line.role === "key" && visual.mode === "problem"
              ? interpolateColors(
                  m.tween(start + m.frames("enter"), "emphasis", "move"),
                  [0, 1],
                  [tokens.colours.text, tokens.colours.warning],
                )
              : tokens.colours.text;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: body.x,
              top: box.y,
              width: body.width,
              height: box.height,
              display: "flex",
              alignItems: "flex-start",
              opacity: enter * mix(1, MOTION.focus.recede, recede),
              translate: m.reducedMotion
                ? "0px 0px"
                : `0px ${(1 - settle) * u(MOTION.distance.rise)}px`,
            }}
          >
            {status ? (
              <div style={{ width: box.indent, flexShrink: 0, paddingTop: box.size * 0.06 }}>
                <StatusMark
                  status={status}
                  size={box.size * 0.96}
                  progress={m.spring(start + m.frames("quick"), "snap")}
                />
              </div>
            ) : null}
            <div
              style={{
                fontFamily: line.role === "support" ? tokens.fonts.sans : tokens.fonts.display,
                fontWeight: line.role === "support" ? 400 : 600,
                fontSize: box.size,
                lineHeight: box.lineHeight,
                letterSpacing: line.role === "support" ? "-0.005em" : "-0.04em",
                color: colour,
                textWrap: "balance",
              }}
            >
              {line.text}
            </div>
          </div>
        );
      })}
    </>
  );
}
