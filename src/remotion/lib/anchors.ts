import type { MotionGraphicVisual } from "../../domain/storyboard";
import type { Rect } from "../design/layout";
import { layoutCharacterScene } from "./character-scene";
import { layoutDecision } from "./decision";
import { unionRects } from "./geometry";
import { graphicFrame, type GraphicMetrics } from "./graphic";
import { layoutGraph, nodeBox } from "./graph";
import { layoutIdentityStory } from "./identity";
import { layoutPipeline } from "./pipeline";
import { layoutRail } from "./rail";
import { layoutStory } from "./story";
import { layoutTransformation } from "./transform";

export interface AnchorContext {
  content: { width: number; height: number };
  portrait: boolean;
  /** Output pixels per design pixel. */
  unit: number;
  metrics: GraphicMetrics;
}

const shift = (rect: Rect, by: { x: number; y: number }): Rect => ({
  ...rect,
  x: rect.x + by.x,
  y: rect.y + by.y,
});

/**
 * Where an element of a motion graphic sits in the content zone, found from the same pure
 * layout the graphic is drawn with. A handoff uses it to know what to collapse and from
 * where. Without an id, or with one the graphic does not have, it is the whole drawing.
 */
export function motionGraphicAnchor(
  visual: MotionGraphicVisual,
  anchor: string | undefined,
  context: AnchorContext,
): Rect {
  const { portrait, unit } = context;
  const heading = visual.kind === "story" ? undefined : visual.heading;
  const frame = graphicFrame(context.content, heading, context.metrics);
  const body = { x: 0, y: 0, width: frame.body.width, height: frame.body.height };
  const origin = { x: frame.body.x, y: frame.body.y };
  const local = ((): Rect => {
    switch (visual.kind) {
      case "identity-story": {
        const layout = layoutIdentityStory({
          body,
          portrait,
          unit,
          accounts: visual.accounts.map((account) => ({
            id: account.id,
            fields: account.fields.length,
            steps: account.steps.length,
          })),
          hasGaps: visual.gaps.length > 0,
          hasMatch: visual.match !== undefined,
        });
        const card = layout.cards.find((slot) => slot.id === anchor);
        if (!card) return layout.bounds;
        const { cx, cy, r } = card.face;
        return unionRects([card.rect, { x: cx - r, y: cy - r, width: r * 2, height: r * 2 }]);
      }
      case "network": {
        const layout = layoutGraph({
          body,
          portrait,
          unit,
          layout: visual.layout,
          hub: visual.hub,
          nodes: visual.nodes.map((node) => ({
            id: node.id,
            group: node.group,
            outside: node.outside,
          })),
        });
        const centre = anchor === undefined ? undefined : layout.positions[anchor];
        return centre ? nodeBox(layout, centre) : layout.bounds;
      }
      case "pipeline": {
        const layout = layoutPipeline({
          body,
          portrait,
          unit,
          stages: visual.stages.length,
          hasResult: visual.result !== undefined,
        });
        const index = anchor === undefined ? Number.NaN : Number(anchor);
        const stop = layout.stops[index];
        const label = layout.labels[index];
        if (stop && label) {
          const station = {
            x: stop.x - layout.station,
            y: stop.y - layout.station,
            width: layout.station * 2,
            height: layout.station * 2,
          };
          return unionRects([station, { ...label, height: Math.min(label.height, layout.token) }]);
        }
        return body;
      }
      case "decision": {
        const layout = layoutDecision({
          body,
          portrait,
          unit,
          signals: visual.signals.length,
          outcomes: visual.outcomes.length,
          hasDetails:
            visual.signals.some((signal) => signal.detail) || visual.outcomes.some((o) => o.detail),
          hasScore: visual.score !== undefined,
        });
        if (anchor === "rule") return layout.rule;
        const signal = layout.signals[visual.signals.findIndex((entry) => entry.id === anchor)];
        const outcome = layout.outcomes[visual.outcomes.findIndex((entry) => entry.id === anchor)];
        return (
          signal ?? outcome ?? unionRects([...layout.signals, layout.rule, ...layout.outcomes])
        );
      }
      case "timeline": {
        const layout = layoutRail({ body, portrait, unit, events: visual.events.length });
        const index = anchor === undefined ? Number.NaN : Number(anchor);
        const label = layout.labels[index];
        const time = layout.times[index];
        return label && time ? unionRects([label, time]) : body;
      }
      case "story": {
        const boxes = layoutStory({
          body,
          portrait,
          unit,
          lines: visual.lines.map((line) => ({
            text: line.text,
            role: line.role,
            marked: line.status !== undefined,
          })),
        });
        return unionRects(
          boxes.map((box) => ({ x: body.x, y: box.y, width: body.width, height: box.height })),
        );
      }
      case "transformation": {
        const layout = layoutTransformation({
          body,
          portrait,
          unit,
          mode: visual.mode,
          items: visual.items,
        });
        const row = layout.rows[anchor === undefined ? Number.NaN : Number(anchor)];
        return row
          ? row.after
          : unionRects(layout.rows.flatMap((entry) => [entry.before, entry.after]));
      }
      case "character-scene": {
        const layout = layoutCharacterScene({ body, portrait, unit, visual });
        const figure = layout.figures.find((slot) => slot.id === anchor);
        const prop = layout.props.find((slot) => slot.id === anchor);
        return figure?.rect ?? prop?.rect ?? layout.bounds;
      }
    }
  })();
  return shift(local, origin);
}
