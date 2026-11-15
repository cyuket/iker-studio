import type { ReactNode } from "react";
import { useCurrentFrame } from "remotion";
import type { Tone } from "../../domain/storyboard";
import { withAlpha } from "../design/colour";
import { useLayout, useSceneEnvironment, useTokens } from "../design/SceneContext";
import { enterProgress } from "../design/motion";
import { toneColour } from "../design/tokens";
import { staggerSchedule } from "../design/useReveal";
import { edgePath, layoutDiagram } from "../lib/diagram";
import { Reveal } from "./Reveal";

export interface DiagramSceneProps {
  nodes: readonly {
    id: string;
    label: string;
    sublabel?: string | undefined;
    tone: Tone;
    column: number;
  }[];
  edges: readonly { from: string; to: string; label?: string | undefined; tone: Tone }[];
  /** Box the diagram is drawn in, in output pixels. */
  width: number;
  height: number;
  /** Scene frame at which the first rank appears. */
  startFrame: number;
}

/**
 * A flow of labelled nodes. Ranks arrive in order and each connector draws in as the node
 * it leads to appears, so the picture builds in the direction it should be read.
 */
export function DiagramScene({
  nodes,
  edges,
  width,
  height,
  startFrame,
}: DiagramSceneProps): ReactNode {
  const tokens = useTokens();
  const { u, pick, orientation } = useLayout();
  const { fps, durationFrames, timing, reducedMotion, enter } = useSceneEnvironment();
  const frame = useCurrentFrame();

  const layout = layoutDiagram(nodes, width, height, orientation, {
    rankGap: u(pick(120, 84)),
    siblingGap: u(pick(32, 20)),
    maxNodeWidth: u(pick(360, 640)),
    maxNodeHeight: u(pick(190, 170)),
  });
  const rankStarts = staggerSchedule({
    count: layout.rankCount,
    durationFrames,
    fps,
    startFrame,
    maxStepSeconds: 1.8,
    spread: 0.6,
  });
  const startOf = (id: string): number => rankStarts[layout.ranks[id] ?? 0] ?? startFrame;
  const arrow = u(11);

  return (
    <div style={{ position: "relative", width, height }}>
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        {edges.map((edge, i) => {
          const from = layout.boxes[edge.from];
          const to = layout.boxes[edge.to];
          if (!from || !to) return null;
          const path = edgePath(from, to, orientation, arrow * 0.9);
          const colour =
            edge.tone === "neutral"
              ? withAlpha(tokens.colours.text, 0.38)
              : toneColour(tokens, edge.tone);
          const at =
            enter === "none" ? timing.leadFrames : startOf(edge.to) - Math.round(fps * 0.2);
          const progress = enterProgress(frame, at, Math.round(timing.enterFrames * 1.2));
          const drawn = reducedMotion ? 1 : progress;
          const angle = (Math.atan2(path.end.dy, path.end.dx) * 180) / Math.PI;
          return (
            <g
              key={`${edge.from}-${edge.to}-${i}`}
              opacity={reducedMotion ? progress : Math.min(1, progress * 4)}
            >
              <path
                d={path.d}
                fill="none"
                stroke={colour}
                strokeWidth={tokens.stroke.regular}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - drawn}
              />
              <path
                d={`M ${-arrow} ${-arrow * 0.6} L 0 0 L ${-arrow} ${arrow * 0.6}`}
                fill="none"
                stroke={colour}
                strokeWidth={tokens.stroke.regular}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={progress > 0.85 ? 1 : 0}
                transform={`translate(${path.end.x + path.end.dx * arrow * 0.9} ${path.end.y + path.end.dy * arrow * 0.9}) rotate(${angle})`}
              />
            </g>
          );
        })}
      </svg>

      {edges.map((edge, i) => {
        const from = layout.boxes[edge.from];
        const to = layout.boxes[edge.to];
        if (!edge.label || !from || !to) return null;
        const path = edgePath(from, to, orientation, arrow * 0.9);
        // Along a horizontal connector the label rides above the line so the arrow stays visible.
        const lift = path.end.dx === 0 ? 0 : u(26);
        return (
          <div
            key={`label-${edge.from}-${edge.to}-${i}`}
            style={{
              position: "absolute",
              left: path.mid.x,
              top: path.mid.y - lift,
              width: 0,
              height: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Reveal at={startOf(edge.to)} distance={0}>
              <div
                style={{
                  fontFamily: tokens.fonts.mono,
                  fontWeight: 500,
                  fontSize: u(pick(20, 22)),
                  letterSpacing: "0.04em",
                  whiteSpace: "nowrap",
                  color:
                    edge.tone === "neutral"
                      ? tokens.colours.textSoft
                      : toneColour(tokens, edge.tone),
                  backgroundColor: tokens.colours.background,
                  border: `${tokens.stroke.hairline}px solid ${tokens.colours.hairlineStrong}`,
                  borderRadius: tokens.radii.pill,
                  padding: `${u(5)}px ${u(12)}px`,
                }}
              >
                {edge.label}
              </div>
            </Reveal>
          </div>
        );
      })}

      {nodes.map((node) => {
        const box = layout.boxes[node.id];
        if (!box) return null;
        const colour = toneColour(tokens, node.tone);
        const toned = node.tone !== "neutral";
        const narrow = box.width < u(300);
        const labelSize = u(narrow ? pick(27, 28) : pick(31, 40));
        const sublabelSize = u(narrow ? pick(21, 23) : pick(24, 29));
        return (
          <Reveal
            key={node.id}
            at={startOf(node.id)}
            distance={12}
            style={{
              position: "absolute",
              left: box.x,
              top: box.y,
              width: box.width,
              height: box.height,
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: u(6),
                padding: `0 ${u(narrow ? 20 : 28)}px`,
                borderRadius: tokens.radii.lg,
                backgroundColor: toned ? tokens.colours.surfaceRaised : tokens.colours.surface,
                border: `${tokens.stroke.hairline}px solid ${toned ? withAlpha(colour, 0.6) : tokens.colours.hairlineStrong}`,
                boxShadow: tokens.shadows.panel,
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: u(12) }}>
                <div
                  style={{
                    width: u(10),
                    height: u(10),
                    flexShrink: 0,
                    borderRadius: tokens.radii.pill,
                    backgroundColor: colour,
                  }}
                />
                <div
                  style={{
                    fontFamily: tokens.fonts.display,
                    fontWeight: 600,
                    fontSize: labelSize,
                    lineHeight: 1.12,
                    letterSpacing: "-0.02em",
                    color: tokens.colours.text,
                    textWrap: "balance",
                  }}
                >
                  {node.label}
                </div>
              </div>
              {node.sublabel ? (
                <div
                  style={{
                    fontFamily: tokens.fonts.sans,
                    fontSize: sublabelSize,
                    lineHeight: 1.25,
                    color: tokens.colours.textMuted,
                    paddingLeft: u(22),
                  }}
                >
                  {node.sublabel}
                </div>
              ) : null}
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}
