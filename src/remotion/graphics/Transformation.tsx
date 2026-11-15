import type { ReactNode } from "react";
import { interpolateColors } from "remotion";
import type { TransformationVisualData } from "../../domain/storyboard";
import type { Rect } from "../design/layout";
import { mix } from "../design/motion";
import { useLayout, useTokens } from "../design/SceneContext";
import { MOTION, toneColour } from "../design/tokens";
import { useMotion } from "../design/useBeat";
import { layoutTransformation } from "../lib/transform";
import { Connector, ConnectorLayer } from "../primitives/Connector";
import { StatusMark, statusTone } from "../primitives/StatusMark";
import { GraphicLayout } from "./GraphicLayout";

export interface TransformationProps {
  visual: TransformationVisualData;
}

/** The geometry of a transformation in a given body, shared by the component and tests. */
export function transformationLayout(
  visual: TransformationVisualData,
  body: Rect,
  portrait: boolean,
  unit: number,
) {
  return layoutTransformation({ body, portrait, unit, mode: visual.mode, items: visual.items });
}

/**
 * The same things in two states. Every item starts in its before state; on its cue it
 * becomes its after state. Side by side, a link is drawn across and the before state dims,
 * so the old and the new can be compared. In place, the new state replaces the old one
 * where it stands, so the change itself is what is seen.
 */
export function Transformation({ visual }: TransformationProps): ReactNode {
  return (
    <GraphicLayout heading={visual.heading}>
      {(body) => <TransformationBody visual={visual} body={body} />}
    </GraphicLayout>
  );
}

function TransformationBody({ visual, body }: { visual: TransformationVisualData; body: Rect }) {
  const tokens = useTokens();
  const { u, isPortrait } = useLayout();
  const m = useMotion();
  const layout = transformationLayout(visual, body, isPortrait, u(1));
  const { k, textSize } = layout;
  const split = visual.mode === "side-by-side";
  const starts = m.schedule(
    visual.items.map((item, i) => ({ key: `item:${i}`, cue: item.cue })),
    visual.settled,
  );
  const stagger = Math.round(MOTION.stagger.item * m.fps);
  const changeOf = (i: number): number => starts[`item:${i}`] ?? m.start;
  const firstChange = Math.min(...visual.items.map((_, i) => changeOf(i)));
  const afterTitle = m.tween(firstChange, "enter");
  const titleStyle = {
    fontFamily: tokens.fonts.display,
    fontWeight: 600,
    fontSize: (isPortrait ? 40 : 50) * k,
    letterSpacing: "-0.025em",
    lineHeight: 1.1,
    display: "flex",
    alignItems: "center",
  } as const;
  const title = (rect: Rect, text: string, colour: string, opacity: number, key: string) => (
    <div
      key={key}
      style={{
        ...titleStyle,
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height - 20 * k,
        color: colour,
        opacity,
      }}
    >
      {text}
    </div>
  );
  const panel = (rect: Rect) =>
    ({
      position: "absolute",
      left: rect.x,
      top: rect.y,
      width: rect.width,
      height: rect.height,
      boxSizing: "border-box",
      padding: `0 ${(isPortrait && split ? 22 : 30) * k}px`,
      display: "flex",
      alignItems: "center",
      gap: 20 * k,
      borderRadius: 20 * k,
      fontFamily: tokens.fonts.sans,
      fontWeight: 500,
      fontSize: textSize,
      lineHeight: 1.25,
    }) as const;

  return (
    <>
      {title(
        layout.titles.before,
        visual.before.title,
        tokens.colours.textMuted,
        m.tween(m.start, "enter") * (split ? 1 : 1 - afterTitle),
        "before-title",
      )}
      {title(
        layout.titles.after,
        visual.after.title,
        tokens.colours.text,
        afterTitle,
        "after-title",
      )}

      <ConnectorLayer width={body.width} height={body.height}>
        {layout.rows.map((row, i) =>
          row.link ? (
            <Connector
              key={i}
              path={row.link}
              progress={m.tween(changeOf(i), "draw", "move")}
              colour={tokens.colours.primary}
              width={Math.max(1.5, 3 * k)}
              signal={m.tween(changeOf(i), "draw", "move")}
              signalColour={tokens.colours.text}
              signalRadius={6 * k}
            />
          ) : null,
        )}
      </ConnectorLayer>

      {visual.items.map((item, i) => {
        const row = layout.rows[i];
        if (!row) return null;
        const appear = m.tween(m.start + i * stagger, "enter");
        const change = changeOf(i);
        const arrive = split ? change + Math.round(m.frames("draw") * 0.7) : change;
        const changed = m.tween(arrive, "emphasis", "move");
        const settle = m.spring(arrive, "settle");
        const colour = toneColour(tokens, item.status ? statusTone(item.status) : "primary");
        return (
          <div key={i}>
            <div
              style={{
                ...panel(row.before),
                backgroundColor: tokens.colours.surface,
                boxShadow: `0 0 0 ${tokens.stroke.hairline}px ${tokens.colours.hairlineStrong}`,
                color: tokens.colours.textSoft,
                opacity:
                  appear * (split ? mix(1, MOTION.focus.recede * 1.6, changed) : 1 - changed),
              }}
            >
              <div style={{ textWrap: "balance" }}>{item.before}</div>
            </div>
            <div
              style={{
                ...panel(row.after),
                backgroundColor: tokens.colours.surfaceRaised,
                border: `${Math.max(1.5, 2.5 * k)}px solid ${interpolateColors(changed, [0, 1], [tokens.colours.hairlineStrong, colour])}`,
                color: tokens.colours.text,
                opacity: changed,
                translate:
                  m.reducedMotion || !split
                    ? "0px 0px"
                    : `${(settle - 1) * MOTION.distance.rise * k}px 0px`,
              }}
            >
              {item.status ? (
                <StatusMark
                  status={item.status}
                  size={textSize * 1.3}
                  progress={m.spring(arrive + m.frames("quick"), "snap")}
                />
              ) : null}
              <div style={{ textWrap: "balance" }}>{item.after}</div>
            </div>
          </div>
        );
      })}
    </>
  );
}
