import type { ReactNode } from "react";
import { interpolateColors } from "remotion";
import type { PipelineVisualData } from "../../domain/storyboard";
import { withAlpha } from "../design/colour";
import type { Rect } from "../design/layout";
import { easeMove, isSettled, mix } from "../design/motion";
import { useLayout, useTokens } from "../design/SceneContext";
import { MOTION, toneColour } from "../design/tokens";
import { useMotion } from "../design/useBeat";
import { layoutPipeline, pipelinePosition, trackPoint } from "../lib/pipeline";
import { Connector, ConnectorLayer } from "../primitives/Connector";
import { FaceGlyph } from "../primitives/FaceGlyph";
import { Icon, type IconName } from "../primitives/Icon";
import { StatusMark, statusTone } from "../primitives/StatusMark";
import { GraphicLayout } from "./GraphicLayout";

export interface PipelineProps {
  visual: PipelineVisualData;
}

const ICON: Record<PipelineVisualData["object"]["type"], IconName> = {
  document: "document",
  selfie: "selfie",
  person: "person",
  transaction: "transaction",
  business: "business",
  wallet: "wallet",
  data: "data",
};

/** The geometry of a pipeline in a given body, shared by the component and tests. */
export function pipelineLayout(
  visual: PipelineVisualData,
  body: Rect,
  portrait: boolean,
  unit: number,
) {
  return layoutPipeline({
    body,
    portrait,
    unit,
    stages: visual.stages.length,
    hasResult: visual.result !== undefined,
  });
}

/**
 * One object going through named stages and coming out as a result. The object physically
 * travels the track and reaches each stage on that stage's cue; the stage is decided as it
 * arrives, and the track behind it stays filled, so progress is never in doubt.
 */
export function Pipeline({ visual }: PipelineProps): ReactNode {
  return (
    <GraphicLayout heading={visual.heading}>
      {(body) => <PipelineBody visual={visual} body={body} />}
    </GraphicLayout>
  );
}

function PipelineBody({ visual, body }: { visual: PipelineVisualData; body: Rect }) {
  const tokens = useTokens();
  const { u, isPortrait } = useLayout();
  const m = useMotion();
  const layout = pipelineLayout(visual, body, isPortrait, u(1));
  const k = u(1);
  const { settled, result } = visual;

  const stops = [
    ...visual.stages.map((stage, i) => ({ key: `stage:${i}`, cue: stage.cue })),
    ...(result ? [{ key: "result", cue: result.cue }] : []),
  ];
  const starts = m.schedule(
    [...stops, ...(visual.focus ? [{ key: "focus", cue: visual.focus.cue }] : [])],
    settled,
  );
  const arrivals = stops.map((stop) => starts[stop.key] ?? m.start);
  const allSettled = arrivals.every(isSettled);
  const position = allSettled
    ? stops.length - 1
    : pipelinePosition(
        m.frame,
        arrivals.map((frame) => (isSettled(frame) ? -1 : frame)),
        m.frames("move"),
        m.reducedMotion ? (t) => (t < 1 ? 0 : 1) : easeMove,
      );
  const here = trackPoint(layout, position);
  const appear = allSettled ? 1 : m.tween(m.start, "enter");
  const focus = visual.focus ? m.tween(starts.focus ?? m.start, "focus", "move") : 0;
  const last = layout.stops.at(-1) ?? layout.start;
  const lineWidth = Math.max(2, 4 * k);
  const resultProgress = result ? m.spring(starts.result ?? m.start, "snap") : 0;
  const resultColour = result
    ? toneColour(tokens, statusTone(result.status))
    : tokens.colours.primary;
  const tokenBorder = interpolateColors(
    Math.min(1, Math.max(0, resultProgress)),
    [0, 1],
    [tokens.colours.hairlineStrong, resultColour],
  );
  const centre = { x: here.x + layout.tokenOffset.x, y: here.y + layout.tokenOffset.y };

  return (
    <>
      <ConnectorLayer width={body.width} height={body.height}>
        <Connector
          path={{ kind: "line", from: layout.start, to: last }}
          progress={m.tween(m.start, "draw", "move")}
          colour={tokens.colours.hairlineStrong}
          width={lineWidth}
        />
        <Connector
          path={{ kind: "line", from: layout.start, to: here }}
          progress={position > -1 ? 1 : 0}
          colour={tokens.colours.primary}
          width={lineWidth}
        />
        {/* The stem ties the object to its place on the track. */}
        <Connector
          path={{
            kind: "line",
            from: here,
            to: {
              x: here.x + layout.tokenOffset.x * (isPortrait ? 0.3 : 0),
              y: here.y + layout.tokenOffset.y * (isPortrait ? 0 : 0.3),
            },
          }}
          progress={appear}
          colour={tokens.colours.primary}
          width={lineWidth}
        />
      </ConnectorLayer>

      {stops.map((stop, i) => {
        const point = layout.stops[i];
        const box = layout.labels[i];
        const stage = visual.stages[i];
        const data = stage ?? result;
        if (!point || !box || !data) return null;
        const arrival = arrivals[i] ?? m.start;
        const reached = m.spring(arrival, "snap");
        const lit = Math.min(1, Math.max(0, reached));
        const colour = toneColour(tokens, statusTone(data.status));
        const isFocus = visual.focus?.stage === i;
        const dim = isFocus ? 1 : mix(1, MOTION.focus.recede, focus);
        const isResult = stage === undefined;
        return (
          <div key={stop.key} style={{ opacity: appear * dim }}>
            <div
              style={{
                position: "absolute",
                left: point.x - layout.station,
                top: point.y - layout.station,
                width: layout.station * 2,
                height: layout.station * 2,
                boxSizing: "border-box",
                borderRadius: tokens.radii.pill,
                backgroundColor: tokens.colours.background,
                border: `${lineWidth}px solid ${interpolateColors(lit, [0, 1], [tokens.colours.hairlineStrong, colour])}`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: point.x - layout.station,
                top: point.y - layout.station,
              }}
            >
              <StatusMark status={data.status} size={layout.station * 2} progress={reached} />
            </div>
            <div
              style={{
                position: "absolute",
                left: box.x,
                top: box.y,
                width: box.width,
                height: box.height,
                display: "flex",
                flexDirection: "column",
                justifyContent: isPortrait ? "center" : "flex-start",
                alignItems: isPortrait ? "flex-start" : "center",
                textAlign: isPortrait ? "left" : "center",
                gap: 8 * k,
                opacity: mix(0.42, 1, lit),
              }}
            >
              <div
                style={{
                  fontFamily: tokens.fonts.display,
                  fontWeight: 600,
                  fontSize: (isPortrait ? 42 : 44) * k,
                  lineHeight: 1.12,
                  letterSpacing: "-0.02em",
                  color: isResult
                    ? interpolateColors(lit, [0, 1], [tokens.colours.text, colour])
                    : tokens.colours.text,
                  textWrap: "balance",
                }}
              >
                {data.label}
              </div>
              {data.detail ? (
                <div
                  style={{
                    fontFamily: tokens.fonts.sans,
                    fontSize: (isPortrait ? 32 : 31) * k,
                    lineHeight: 1.28,
                    color: tokens.colours.textMuted,
                    textWrap: "balance",
                  }}
                >
                  {data.detail}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: centre.x - layout.token / 2,
          top: centre.y - layout.token / 2,
          width: layout.token,
          height: layout.token,
          boxSizing: "border-box",
          borderRadius: visual.object.face ? tokens.radii.pill : layout.token * 0.24,
          backgroundColor: tokens.colours.surfaceRaised,
          border: `${lineWidth}px solid ${tokenBorder}`,
          boxShadow: `0 0 0 ${6 * k}px ${withAlpha(tokens.colours.background, 0.9)}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: appear * mix(1, MOTION.focus.recede, focus),
          scale: m.reducedMotion
            ? "1"
            : String(mix(MOTION.scale.enterFrom, 1, m.spring(m.start, "settle"))),
        }}
      >
        {visual.object.face ? (
          <FaceGlyph seed={visual.object.face} size={layout.token - lineWidth * 2} />
        ) : (
          <Icon
            name={ICON[visual.object.type]}
            size={layout.token * 0.5}
            colour={tokens.colours.text}
          />
        )}
      </div>
      {visual.object.label ? (
        <div
          style={{
            position: "absolute",
            left: isPortrait ? body.x : centre.x - layout.token * 1.5,
            top: isPortrait
              ? centre.y + layout.token / 2 + 10 * k
              : centre.y - layout.token / 2 - 58 * k,
            width: isPortrait ? layout.token + 20 * k : layout.token * 3,
            textAlign: "center",
            fontFamily: tokens.fonts.sans,
            fontWeight: 500,
            fontSize: 32 * k,
            lineHeight: 1.2,
            whiteSpace: isPortrait ? "normal" : "nowrap",
            color: tokens.colours.textSoft,
            opacity: appear * mix(1, MOTION.focus.recede, focus),
          }}
        >
          {visual.object.label}
        </div>
      ) : null}
    </>
  );
}
