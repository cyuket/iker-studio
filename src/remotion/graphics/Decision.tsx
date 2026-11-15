import type { ReactNode } from "react";
import { interpolateColors } from "remotion";
import type { DecisionVisualData } from "../../domain/storyboard";
import { withAlpha } from "../design/colour";
import type { Rect } from "../design/layout";
import { mix } from "../design/motion";
import { useLayout, useTokens } from "../design/SceneContext";
import { MOTION, toneColour, type Tokens } from "../design/tokens";
import { useMotion } from "../design/useBeat";
import { layoutDecision } from "../lib/decision";
import { ranksWithinCue } from "../lib/graph";
import { Connector, ConnectorLayer } from "../primitives/Connector";
import { Icon } from "../primitives/Icon";
import { ScoreBar } from "../primitives/ScoreBar";
import { StatusMark, statusTone } from "../primitives/StatusMark";
import { GraphicLayout } from "./GraphicLayout";

export interface DecisionProps {
  visual: DecisionVisualData;
}

/** The geometry of a decision graph in a given body, shared by the component and tests. */
export function decisionLayout(
  visual: DecisionVisualData,
  body: Rect,
  portrait: boolean,
  unit: number,
) {
  return layoutDecision({
    body,
    portrait,
    unit,
    signals: visual.signals.length,
    outcomes: visual.outcomes.length,
    hasDetails:
      visual.signals.some((signal) => signal.detail) || visual.outcomes.some((o) => o.detail),
    hasScore: visual.score !== undefined,
  });
}

function cardText(
  tokens: Tokens,
  k: number,
  title: string,
  detail: string | undefined,
  colour: string,
) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 * k, minWidth: 0 }}>
      <div
        style={{
          fontFamily: tokens.fonts.display,
          fontWeight: 600,
          fontSize: 34 * k,
          lineHeight: 1.12,
          letterSpacing: "-0.02em",
          color: colour,
          textWrap: "balance",
        }}
      >
        {title}
      </div>
      {detail ? (
        <div
          style={{
            fontFamily: tokens.fonts.sans,
            fontSize: 25 * k,
            lineHeight: 1.25,
            color: tokens.colours.textMuted,
          }}
        >
          {detail}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Signals feed a rule, and the rule routes to an outcome. Each signal's connector carries a
 * pulse into the rule; when a route fires, the path from its signal through the rule to its
 * outcome lights up in the outcome's colour and the outcome is stamped. Outcomes nothing
 * leads to step back. Cause on one side, consequence on the other, the reason in between.
 */
export function Decision({ visual }: DecisionProps): ReactNode {
  return (
    <GraphicLayout heading={visual.heading}>
      {(body) => <DecisionBody visual={visual} body={body} />}
    </GraphicLayout>
  );
}

function DecisionBody({ visual, body }: { visual: DecisionVisualData; body: Rect }) {
  const tokens = useTokens();
  const { u, isPortrait } = useLayout();
  const m = useMotion();
  const layout = decisionLayout(visual, body, isPortrait, u(1));
  const { k } = layout;
  const { settled, routes, score } = visual;
  const stagger = Math.round(MOTION.stagger.item * m.fps);

  const starts = m.schedule(
    [
      ...visual.signals.map((signal) => ({ key: `signal:${signal.id}`, cue: signal.cue })),
      { key: "rule", cue: visual.rule.cue },
      ...(score ? [{ key: "score", cue: score.cue }] : []),
      ...visual.outcomes.map((outcome) => ({ key: `outcome:${outcome.id}`, cue: outcome.cue })),
      ...routes.map((route, i) => ({ key: `route:${i}`, cue: route.cue })),
    ],
    settled,
  );
  const signalRanks = ranksWithinCue(visual.signals.map((signal) => signal.cue));
  const outcomeRanks = ranksWithinCue(visual.outcomes.map((outcome) => outcome.cue));
  const ruleStart = starts.rule ?? m.start;
  const routeStart = (i: number): number => starts[`route:${i}`] ?? m.start;
  const hop = m.frames("signal");
  /** 0-1: the pulse of route `i` has reached the rule, then the outcome. */
  const routeIn = (i: number): number => m.tween(routeStart(i), "signal", "move");
  const routeOut = (i: number): number => m.tween(routeStart(i) + hop, "signal", "move");
  const routeDone = (i: number): number => m.spring(routeStart(i) + hop * 2, "snap");
  /** A route gives way to the next one: it stays coloured but is no longer the subject. */
  const routeWeight = (i: number): number => {
    // Routes that fire together are one statement; only a later one takes the lead.
    const next = routes.findIndex((_, r) => r > i && routeStart(r) > routeStart(i));
    return next === -1 ? 1 : mix(1, 0.45, m.tween(routeStart(next), "focus", "move"));
  };
  const anyRoute = Math.max(0, ...routes.map((_, i) => routeOut(i)));
  const line = Math.max(1.5, 3 * k);
  const idle = withAlpha(tokens.colours.text, 0.26);
  const outcomeColour = (id: string): string => {
    const outcome = visual.outcomes.find((entry) => entry.id === id);
    return toneColour(tokens, outcome ? statusTone(outcome.status) : "primary");
  };
  const ruleLit = Math.max(0, ...routes.map((_, i) => routeIn(i)));
  const lastFired = routes.reduce((latest, _, i) => (routeIn(i) > 0 ? i : latest), -1);
  const ruleColour =
    lastFired >= 0
      ? interpolateColors(
          ruleLit,
          [0, 1],
          [tokens.colours.primary, outcomeColour(routes[lastFired]?.to ?? "")],
        )
      : tokens.colours.primary;

  return (
    <>
      <ConnectorLayer width={body.width} height={body.height}>
        {visual.signals.map((signal, i) => {
          const path = layout.inPaths[i];
          if (!path) return null;
          const start =
            Math.max(starts[`signal:${signal.id}`] ?? m.start, ruleStart) +
            (signalRanks[i] ?? 0) * stagger +
            m.frames("quick");
          const fired = routes
            .map((route, r) => ({ route, r }))
            .filter(({ route }) => route.from === undefined || route.from === signal.id);
          const latest = fired.reduce<number | null>(
            (found, { r }) => (routeIn(r) > 0 ? r : found),
            null,
          );
          const colour =
            latest === null
              ? idle
              : interpolateColors(
                  routeIn(latest),
                  [0, 1],
                  [idle, outcomeColour(routes[latest]?.to ?? "")],
                );
          const pulse = latest === null ? m.tween(start, "signal", "move") : routeIn(latest);
          return (
            <Connector
              key={`in-${signal.id}`}
              path={path}
              progress={m.tween(start, "draw", "move")}
              colour={colour}
              width={line * (latest === null ? 1 : mix(1, 1.6, routeIn(latest)))}
              opacity={latest === null ? mix(1, 0.5, anyRoute) : routeWeight(latest)}
              signal={pulse}
              signalColour={tokens.colours.text}
              signalRadius={7 * k}
            />
          );
        })}
        {visual.outcomes.map((outcome, i) => {
          const path = layout.outPaths[i];
          if (!path) return null;
          const start =
            Math.max(starts[`outcome:${outcome.id}`] ?? m.start, ruleStart) +
            (outcomeRanks[i] ?? 0) * stagger;
          const fired = routes
            .map((route, r) => ({ route, r }))
            .filter(({ route }) => route.to === outcome.id);
          const latest = fired.reduce<number | null>(
            (found, { r }) => (routeOut(r) > 0 ? r : found),
            null,
          );
          const colour =
            latest === null
              ? idle
              : interpolateColors(routeOut(latest), [0, 1], [idle, outcomeColour(outcome.id)]);
          return (
            <Connector
              key={`out-${outcome.id}`}
              path={path}
              progress={m.tween(start, "draw", "move")}
              colour={colour}
              width={line * (latest === null ? 1 : mix(1, 1.6, routeOut(latest)))}
              opacity={latest === null ? mix(1, 0.5, anyRoute) : routeWeight(latest)}
              signal={latest === null ? null : routeOut(latest)}
              signalColour={tokens.colours.text}
              signalRadius={7 * k}
            />
          );
        })}
      </ConnectorLayer>

      {visual.signals.map((signal, i) => {
        const rect = layout.signals[i];
        if (!rect) return null;
        const start = (starts[`signal:${signal.id}`] ?? m.start) + (signalRanks[i] ?? 0) * stagger;
        const colour =
          signal.tone === "neutral" ? tokens.colours.textMuted : toneColour(tokens, signal.tone);
        return (
          <div
            key={signal.id}
            style={{
              position: "absolute",
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
              boxSizing: "border-box",
              padding: `0 ${28 * k}px`,
              display: "flex",
              alignItems: "center",
              gap: 20 * k,
              borderRadius: 20 * k,
              backgroundColor: tokens.colours.surface,
              boxShadow: `0 0 0 ${tokens.stroke.hairline}px ${tokens.colours.hairlineStrong}`,
              opacity: m.tween(start, "enter"),
              translate: m.reducedMotion
                ? "0px 0px"
                : isPortrait
                  ? `0px ${(1 - m.spring(start, "settle")) * MOTION.distance.nudge * k}px`
                  : `${(m.spring(start, "settle") - 1) * MOTION.distance.rise * k}px 0px`,
            }}
          >
            <div
              style={{
                width: 12 * k,
                height: 12 * k,
                flexShrink: 0,
                borderRadius: tokens.radii.pill,
                backgroundColor: colour,
              }}
            />
            {cardText(tokens, k, signal.label, signal.detail, tokens.colours.text)}
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: layout.rule.x,
          top: layout.rule.y,
          width: layout.rule.width,
          height: layout.rule.height,
          boxSizing: "border-box",
          padding: `${22 * k}px ${28 * k}px`,
          display: "flex",
          flexDirection: isPortrait ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          gap: (isPortrait ? 24 : 14) * k,
          textAlign: isPortrait ? "left" : "center",
          borderRadius: 26 * k,
          backgroundColor: tokens.colours.surfaceRaised,
          border: `${Math.max(1.5, 2.5 * k)}px solid ${ruleColour}`,
          opacity: m.tween(ruleStart, "enter"),
          scale: m.reducedMotion
            ? "1"
            : String(mix(MOTION.scale.enterFrom, 1, m.spring(ruleStart, "settle"))),
        }}
      >
        <Icon name="rule" size={(isPortrait ? 60 : 52) * k} colour={ruleColour} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 * k, minWidth: 0 }}>
          {cardText(tokens, k, visual.rule.label, visual.rule.detail, tokens.colours.text)}
          {score ? (
            <div
              style={{ display: "flex", flexDirection: "column", gap: 12 * k, marginTop: 6 * k }}
            >
              <ScoreBar
                width={layout.rule.width - (isPortrait ? 170 : 56) * k}
                height={10 * k}
                level={score.level}
                threshold={score.threshold}
                progress={m.tween(starts.score ?? ruleStart, "move", "move")}
                colour={
                  score.threshold !== undefined && score.level >= score.threshold
                    ? tokens.colours.warning
                    : tokens.colours.primary
                }
              />
              <div
                style={{
                  fontFamily: tokens.fonts.sans,
                  fontSize: 25 * k,
                  lineHeight: 1.2,
                  color: tokens.colours.textMuted,
                }}
              >
                {score.label}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {visual.outcomes.map((outcome, i) => {
        const rect = layout.outcomes[i];
        if (!rect) return null;
        const start =
          (starts[`outcome:${outcome.id}`] ?? m.start) +
          (outcomeRanks[i] ?? 0) * stagger +
          Math.round(m.frames("draw") / 2);
        const targeting = routes
          .map((route, r) => ({ route, r }))
          .filter(({ route }) => route.to === outcome.id);
        const chosen = Math.max(0, ...targeting.map(({ r }) => routeDone(r)));
        // Without routes the outcomes are simply the options; each carries its mark from the start.
        const stamped = routes.length === 0 ? m.spring(start + m.frames("quick"), "snap") : chosen;
        const lit = Math.min(1, Math.max(0, stamped));
        const colour = toneColour(tokens, statusTone(outcome.status));
        const recede = routes.length > 0 && targeting.length === 0 ? anyRoute : 0;
        const stacked = isPortrait;
        return (
          <div
            key={outcome.id}
            style={{
              position: "absolute",
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
              boxSizing: "border-box",
              padding: stacked ? `${18 * k}px ${14 * k}px` : `0 ${28 * k}px`,
              display: "flex",
              flexDirection: stacked ? "column" : "row",
              alignItems: "center",
              justifyContent: stacked ? "center" : "flex-start",
              textAlign: stacked ? "center" : "left",
              gap: (stacked ? 14 : 22) * k,
              borderRadius: 20 * k,
              backgroundColor: interpolateColors(
                lit,
                [0, 1],
                [tokens.colours.surface, tokens.colours.surfaceRaised],
              ),
              border: `${Math.max(1.5, 2.5 * k)}px solid ${interpolateColors(lit, [0, 1], [tokens.colours.hairlineStrong, colour])}`,
              opacity: m.tween(start, "enter") * mix(1, MOTION.focus.recede, recede),
            }}
          >
            <StatusMark status={outcome.status} size={52 * k} progress={stamped} />
            {cardText(
              tokens,
              k,
              outcome.label,
              outcome.detail,
              interpolateColors(lit, [0, 1], [tokens.colours.textSoft, tokens.colours.text]),
            )}
          </div>
        );
      })}
    </>
  );
}
