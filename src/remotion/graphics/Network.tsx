import type { ReactNode } from "react";
import { interpolateColors } from "remotion";
import type { NetworkVisualData } from "../../domain/storyboard";
import { withAlpha } from "../design/colour";
import type { Rect } from "../design/layout";
import { mix } from "../design/motion";
import { useLayout, useTokens } from "../design/SceneContext";
import { MOTION, toneColour, type Tokens } from "../design/tokens";
import { useMotion } from "../design/useBeat";
import { pointAt } from "../lib/geometry";
import { clusterRect, edgePath, layoutGraph, nodeRadius, ranksWithinCue } from "../lib/graph";
import { Connector, ConnectorLayer } from "../primitives/Connector";
import type { IconName } from "../primitives/Icon";
import { Node } from "../primitives/Node";
import { GraphicLayout } from "./GraphicLayout";

export interface NetworkProps {
  visual: NetworkVisualData;
}

const ICON: Record<NetworkVisualData["nodes"][number]["type"], IconName> = {
  account: "account",
  person: "person",
  face: "face",
  device: "device",
  wallet: "wallet",
  document: "document",
  business: "business",
  list: "list",
  signal: "signal",
};

/** The geometry of a network in a given body, shared by the component and tests. */
const RADIUS_AT_FULL_SIZE = 74;
const CLUSTER_PADDING = 26;
const CLUSTER_TITLE = 54;

export function networkLayout(
  visual: NetworkVisualData,
  body: Rect,
  portrait: boolean,
  unit: number,
) {
  // A boundary is drawn outside the nodes it holds, so the nodes give up room for it.
  const k = (nodeRadius(visual.nodes.length) * unit) / RADIUS_AT_FULL_SIZE;
  const pad = visual.clusters.length > 0 ? CLUSTER_PADDING * k : 0;
  const title = visual.clusters.some((cluster) => cluster.label) ? CLUSTER_TITLE * k : 0;
  return layoutGraph({
    body: {
      x: body.x + pad,
      y: body.y + pad + title,
      width: body.width - pad * 2,
      height: body.height - pad * 2 - title,
    },
    portrait,
    unit,
    layout: visual.layout,
    hub: visual.hub,
    nodes: visual.nodes.map((node) => ({ id: node.id, group: node.group, outside: node.outside })),
  });
}

function edgeColour(tokens: Tokens, tone: NetworkVisualData["edges"][number]["tone"]): string {
  return tone === "neutral" ? withAlpha(tokens.colours.text, 0.34) : toneColour(tokens, tone);
}

/**
 * Things and the relationships between them. Nodes arrive, edges draw themselves from one
 * node to another (optionally carrying a pulse: a comparison, a signal), an edge can then
 * be picked out as the one that matters, and a boundary can close around a cluster while
 * everything outside it steps back.
 */
export function Network({ visual }: NetworkProps): ReactNode {
  return (
    <GraphicLayout heading={visual.heading}>
      {(body) => <NetworkBody visual={visual} body={body} />}
    </GraphicLayout>
  );
}

function NetworkBody({ visual, body }: { visual: NetworkVisualData; body: Rect }) {
  const tokens = useTokens();
  const { u, isPortrait } = useLayout();
  const m = useMotion();
  const layout = networkLayout(visual, body, isPortrait, u(1));
  const k = layout.radius / RADIUS_AT_FULL_SIZE;
  const { settled } = visual;
  const stagger = Math.round(MOTION.stagger.item * m.fps);

  const starts = m.schedule(
    [
      ...visual.nodes.map((node) => ({ key: `node:${node.id}`, cue: node.cue })),
      ...visual.edges.map((edge, i) => ({ key: `edge:${i}`, cue: edge.cue })),
      ...visual.clusters.map((cluster, i) => ({ key: `cluster:${i}`, cue: cluster.cue })),
      ...visual.edges.flatMap((edge, i) =>
        edge.mark ? [{ key: `mark:${i}`, cue: edge.mark.cue }] : [],
      ),
    ],
    settled,
  );
  const nodeRanks = ranksWithinCue(visual.nodes.map((node) => node.cue));
  const edgeRanks = ranksWithinCue(visual.edges.map((edge) => edge.cue));
  const at = (key: string, rank = 0): number => (starts[key] ?? m.start) + rank * stagger;

  const clusters = visual.clusters.map((cluster, i) => ({
    cluster,
    progress: m.tween(at(`cluster:${i}`), "focus", "move"),
    rect: clusterRect(
      layout,
      cluster.nodes,
      CLUSTER_PADDING * k,
      cluster.label ? CLUSTER_TITLE * k : 0,
    ),
  }));
  const marks = visual.edges.map((edge, i) =>
    edge.mark ? m.tween(at(`mark:${i}`), "emphasis", "move") : 0,
  );
  const anyMark = Math.max(0, ...marks);
  const markedNodes = new Map<string, { progress: number; colour: string }>();
  visual.edges.forEach((edge, i) => {
    const progress = marks[i] ?? 0;
    if (!edge.mark || progress <= 0) return;
    const colour = toneColour(tokens, edge.mark.tone);
    markedNodes.set(edge.from, { progress, colour });
    markedNodes.set(edge.to, { progress, colour });
  });
  /** How far a node has stepped back: it is outside a boundary that isolates its members. */
  const recedeOf = (id: string): number =>
    Math.max(
      0,
      ...clusters.map(({ cluster, progress }) =>
        cluster.isolate && !cluster.nodes.includes(id) ? progress : 0,
      ),
    );

  return (
    <>
      {clusters.map(({ cluster, progress, rect }, i) => {
        if (!rect || progress <= 0) return null;
        const colour = toneColour(tokens, cluster.tone);
        return (
          <div
            key={`cluster-${i}`}
            style={{
              position: "absolute",
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
              boxSizing: "border-box",
              borderRadius: 36 * k,
              border: `${Math.max(1.5, 2.5 * k)}px solid ${withAlpha(colour, 0.7)}`,
              backgroundColor: withAlpha(colour, 0.06),
              opacity: progress,
              scale: m.reducedMotion ? "1" : String(mix(1.03, 1, progress)),
            }}
          >
            {cluster.label ? (
              <div
                style={{
                  position: "absolute",
                  left: 30 * k,
                  top: 18 * k,
                  fontFamily: tokens.fonts.display,
                  fontWeight: 600,
                  fontSize: 32 * k,
                  letterSpacing: "-0.02em",
                  whiteSpace: "nowrap",
                  color: colour,
                }}
              >
                {cluster.label}
              </div>
            ) : null}
          </div>
        );
      })}

      <ConnectorLayer width={body.width} height={body.height}>
        {visual.edges.map((edge, i) => {
          const path = edgePath(layout, edge.from, edge.to, 10 * k);
          if (!path) return null;
          const start = at(`edge:${i}`, edgeRanks[i]);
          const mark = marks[i] ?? 0;
          const base = edgeColour(tokens, edge.tone);
          const colour = edge.mark
            ? interpolateColors(mark, [0, 1], [base, toneColour(tokens, edge.mark.tone)])
            : base;
          const recede = Math.max(recedeOf(edge.from), recedeOf(edge.to), edge.mark ? 0 : anyMark);
          return (
            <Connector
              key={`edge-${i}`}
              path={path}
              progress={m.tween(start, "draw", "move")}
              colour={colour}
              width={Math.max(1.5, mix(3, 5.5, mark) * k)}
              dashed={edge.style === "dashed"}
              opacity={mix(1, MOTION.focus.recede, recede)}
              signal={edge.signal ? m.tween(start, "signal", "move") : null}
              signalColour={tokens.colours.text}
              signalRadius={7 * k}
            />
          );
        })}
      </ConnectorLayer>

      {visual.nodes.map((node, i) => {
        const centre = layout.positions[node.id];
        if (!centre) return null;
        const start = at(`node:${node.id}`, nodeRanks[i]);
        const enter = m.tween(start, "enter");
        const settle = m.spring(start, "settle");
        const marked = markedNodes.get(node.id);
        const base =
          node.tone === "neutral" ? tokens.colours.hairlineStrong : toneColour(tokens, node.tone);
        const colour = marked
          ? interpolateColors(marked.progress, [0, 1], [base, marked.colour])
          : base;
        const resting = node.muted ? MOTION.focus.recede * 1.6 : 1;
        return (
          <div
            key={node.id}
            style={{
              position: "absolute",
              left: centre.x - layout.radius,
              top: centre.y - layout.radius,
              opacity: enter * mix(resting, MOTION.focus.recede, recedeOf(node.id)),
              scale: m.reducedMotion ? "1" : String(mix(MOTION.scale.enterFrom, 1, settle)),
            }}
          >
            <Node
              radius={layout.radius}
              icon={ICON[node.type]}
              face={node.face}
              colour={node.tone === "neutral" && !marked ? tokens.colours.hairlineStrong : colour}
              ring={Math.max(1.5, mix(2.5, 5, marked?.progress ?? 0) * k)}
              label={node.label}
              sublabel={node.sublabel}
              labelBox={layout.label}
              status={node.status}
              statusProgress={m.spring(start + m.frames("emphasis"), "snap")}
            />
          </div>
        );
      })}

      {visual.edges.map((edge, i) => {
        const path = edgePath(layout, edge.from, edge.to, 10 * k);
        if (!path || !edge.mark?.label) return null;
        const middle = pointAt(path, 0.7);
        const start = pointAt(path, 0);
        const end = pointAt(path, 1);
        const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
        // The name sits beside the edge, on its upper side, and reads away from it, so it
        // never lands on the line or on the label under the node the edge starts from.
        const flip = end.x - start.x < 0 ? -1 : 1;
        const normal = {
          x: ((end.y - start.y) / length) * flip,
          y: (-(end.x - start.x) / length) * flip,
        };
        const right = normal.x >= 0;
        return (
          <div
            key={`mark-${i}`}
            style={{
              position: "absolute",
              left: middle.x + normal.x * 22 * k,
              top: middle.y + normal.y * 22 * k,
              translate: right ? "0% -50%" : "-100% -50%",
              fontFamily: tokens.fonts.display,
              fontWeight: 600,
              fontSize: 32 * k,
              letterSpacing: "-0.02em",
              whiteSpace: "nowrap",
              color: toneColour(tokens, edge.mark.tone),
              opacity: m.tween(at(`mark:${i}`) + m.frames("emphasis"), "enter"),
            }}
          >
            {edge.mark.label}
          </div>
        );
      })}
    </>
  );
}
