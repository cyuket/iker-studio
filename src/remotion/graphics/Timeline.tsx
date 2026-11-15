import type { ReactNode } from "react";
import { interpolateColors } from "remotion";
import type { TimelineVisualData } from "../../domain/storyboard";
import type { Rect } from "../design/layout";
import { isSettled, mix } from "../design/motion";
import { useLayout, useTokens } from "../design/SceneContext";
import { MOTION, toneColour } from "../design/tokens";
import { useMotion } from "../design/useBeat";
import { layoutRail } from "../lib/rail";
import { Connector, ConnectorLayer } from "../primitives/Connector";
import { GraphicLayout } from "./GraphicLayout";

export interface TimelineProps {
  visual: TimelineVisualData;
}

/** The geometry of a timeline in a given body, shared by the component and tests. */
export function timelineLayout(
  visual: TimelineVisualData,
  body: Rect,
  portrait: boolean,
  unit: number,
) {
  return layoutRail({ body, portrait, unit, events: visual.events.length });
}

/**
 * Events in the order they happened. The rail grows to each event as it is mentioned, so
 * time visibly passes; then the flagged events are ringed and the rest step back, which
 * turns a list of ordinary events into a pattern.
 */
export function Timeline({ visual }: TimelineProps): ReactNode {
  return (
    <GraphicLayout heading={visual.heading}>
      {(body) => <TimelineBody visual={visual} body={body} />}
    </GraphicLayout>
  );
}

function TimelineBody({ visual, body }: { visual: TimelineVisualData; body: Rect }) {
  const tokens = useTokens();
  const { u, isPortrait } = useLayout();
  const m = useMotion();
  const layout = timelineLayout(visual, body, isPortrait, u(1));
  const k = u(1);
  const starts = m.schedule(
    [
      ...visual.events.map((event, i) => ({ key: `event:${i}`, cue: event.cue })),
      ...(visual.flag ? [{ key: "flag", cue: visual.flag.cue }] : []),
    ],
    visual.settled,
  );
  const flag = visual.flag ? m.tween(starts.flag ?? m.start, "focus", "move") : 0;
  const warn = tokens.colours.warning;
  const count = visual.events.length;
  // The rail reaches each event as that event arrives, and runs on to the end with the last.
  const reach = visual.events.reduce((length, _, i) => {
    const start = starts[`event:${i}`] ?? m.start;
    const target = i === count - 1 ? 1 : (i + 1) / count;
    const previous = i === 0 ? 0 : i / count;
    const p = isSettled(start) ? 1 : m.tween(start - m.frames("draw"), "draw", "move");
    return Math.max(length, mix(previous, target, p) * (p > 0 ? 1 : 0));
  }, 0);
  const line = Math.max(2, 4 * k);

  return (
    <>
      <ConnectorLayer width={body.width} height={body.height}>
        <Connector
          path={{ kind: "line", from: layout.from, to: layout.to }}
          progress={reach}
          colour={tokens.colours.hairlineStrong}
          width={line}
        />
      </ConnectorLayer>
      {visual.events.map((event, i) => {
        const point = layout.points[i];
        const time = layout.times[i];
        const label = layout.labels[i];
        if (!point || !time || !label) return null;
        const start = starts[`event:${i}`] ?? m.start;
        const enter = m.tween(start, "enter");
        const pop = m.spring(start, "snap");
        const picked = event.flagged ? flag : 0;
        const base =
          event.tone === "neutral" ? tokens.colours.textMuted : toneColour(tokens, event.tone);
        const colour = interpolateColors(picked, [0, 1], [base, warn]);
        const dim = event.flagged ? 1 : mix(1, MOTION.focus.recede, flag);
        const radius = layout.dot * mix(1, 1.45, picked);
        return (
          <div key={i} style={{ opacity: enter * dim }}>
            <div
              style={{
                position: "absolute",
                left: point.x - radius,
                top: point.y - radius,
                width: radius * 2,
                height: radius * 2,
                boxSizing: "border-box",
                borderRadius: tokens.radii.pill,
                backgroundColor: colour,
                border: `${line}px solid ${tokens.colours.background}`,
                scale: m.reducedMotion ? "1" : String(Math.max(0, pop)),
              }}
            />
            {picked > 0 ? (
              <div
                style={{
                  position: "absolute",
                  left: point.x - layout.dot * 2.3,
                  top: point.y - layout.dot * 2.3,
                  width: layout.dot * 4.6,
                  height: layout.dot * 4.6,
                  boxSizing: "border-box",
                  borderRadius: tokens.radii.pill,
                  border: `${Math.max(1.5, 3 * k)}px solid ${warn}`,
                  opacity: picked,
                  scale: m.reducedMotion
                    ? "1"
                    : String(mix(MOTION.scale.emphasis + 0.2, 1, picked)),
                }}
              />
            ) : null}
            {event.time ? (
              <div
                style={{
                  position: "absolute",
                  left: time.x,
                  top: time.y,
                  width: time.width,
                  height: time.height,
                  display: "flex",
                  alignItems: isPortrait ? "center" : "flex-end",
                  justifyContent: isPortrait ? "flex-end" : "center",
                  textAlign: isPortrait ? "right" : "center",
                  fontFamily: tokens.fonts.sans,
                  fontWeight: 500,
                  fontSize: (isPortrait ? 34 : 36) * k,
                  lineHeight: 1.15,
                  color: interpolateColors(picked, [0, 1], [tokens.colours.textMuted, warn]),
                }}
              >
                {event.time}
              </div>
            ) : null}
            <div
              style={{
                position: "absolute",
                left: label.x,
                top: label.y,
                width: label.width,
                height: label.height,
                display: "flex",
                flexDirection: "column",
                justifyContent: isPortrait ? "center" : "flex-start",
                gap: 8 * k,
                textAlign: isPortrait ? "left" : "center",
              }}
            >
              <div
                style={{
                  fontFamily: tokens.fonts.display,
                  fontWeight: 600,
                  fontSize: (isPortrait ? 44 : 46) * k,
                  lineHeight: 1.14,
                  letterSpacing: "-0.02em",
                  color: interpolateColors(picked, [0, 1], [tokens.colours.text, warn]),
                  textWrap: "balance",
                }}
              >
                {event.label}
              </div>
              {event.flagged && visual.flag?.label ? (
                <div
                  style={{
                    fontFamily: tokens.fonts.sans,
                    fontWeight: 500,
                    fontSize: (isPortrait ? 32 : 32) * k,
                    lineHeight: 1.25,
                    color: tokens.colours.textSoft,
                    opacity: m.tween((starts.flag ?? m.start) + m.frames("focus"), "enter"),
                  }}
                >
                  {visual.flag.label}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </>
  );
}
