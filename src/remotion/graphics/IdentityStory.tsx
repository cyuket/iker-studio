import type { ReactNode } from "react";
import type { IdentityStoryVisualData } from "../../domain/storyboard";
import type { Rect } from "../design/layout";
import { mix } from "../design/motion";
import { useLayout, useTokens } from "../design/SceneContext";
import { MOTION, toneColour } from "../design/tokens";
import { useMotion } from "../design/useBeat";
import { layoutIdentityStory, matchGroups, matchLinks } from "../lib/identity";
import { Connector, ConnectorLayer } from "../primitives/Connector";
import { IdentityCard } from "../primitives/IdentityCard";
import { GraphicLayout } from "./GraphicLayout";

export interface IdentityStoryProps {
  visual: IdentityStoryVisualData;
}

/** The geometry of an identity story in a given body, shared by the component and tests. */
export function identityStoryLayout(
  visual: IdentityStoryVisualData,
  body: Rect,
  portrait: boolean,
  unit: number,
) {
  return layoutIdentityStory({
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
}

/**
 * Accounts appear one at a time as identity cards. Each card fills in, goes through its
 * steps (sign-up, verification, account open), and the details that differ from the
 * others are picked out. Then the story turns: the cards step back, the faces stay, and a
 * line is drawn between the ones that are the same person.
 */
export function IdentityStory({ visual }: IdentityStoryProps): ReactNode {
  return (
    <GraphicLayout heading={visual.heading}>
      {(body) => <IdentityStoryBody visual={visual} body={body} />}
    </GraphicLayout>
  );
}

function IdentityStoryBody({ visual, body }: { visual: IdentityStoryVisualData; body: Rect }) {
  const tokens = useTokens();
  const { u, isPortrait } = useLayout();
  const m = useMotion();
  const layout = identityStoryLayout(visual, body, isPortrait, u(1));
  const { metrics } = layout;
  const { k } = metrics;
  const { settled, match } = visual;

  const sequence = visual.accounts.flatMap((account) => {
    const gap = visual.gaps.find((entry) => entry.after === account.id);
    return [
      { key: `card:${account.id}`, cue: account.cue },
      ...(gap ? [{ key: `gap:${account.id}`, cue: gap.cue }] : []),
    ];
  });
  const starts = m.schedule(
    match ? [...sequence, { key: "match", cue: match.cue }] : sequence,
    settled,
  );

  const groups = match ? matchGroups(visual.accounts, match.accounts) : [];
  const matched = new Set(groups.flat());
  const matchStart = starts.match;
  const matchColour = toneColour(tokens, match?.tone ?? "primary");
  const recede =
    match && matchStart !== undefined && match.isolate ? m.tween(matchStart, "focus", "move") : 0;
  const ringStart = (matchStart ?? 0) + Math.round(m.frames("focus") / 2);
  const linkStart = (matchStart ?? 0) + m.frames("focus");
  const ring = match && matchStart !== undefined ? m.spring(ringStart, "settle") : 0;
  const link = match && matchStart !== undefined ? m.tween(linkStart, "draw", "move") : 0;
  const label =
    match && matchStart !== undefined ? m.tween(linkStart + m.frames("draw"), "enter") : 0;
  const links = groups.flatMap((group) => matchLinks(layout, group, 12 * k));
  const firstLink = links[0];
  const stroke = Math.max(2, 5 * k);

  return (
    <>
      {visual.gaps.map((gap) => {
        const slot = layout.gaps.find((entry) => entry.after === gap.after);
        const start = starts[`gap:${gap.after}`];
        if (!slot || start === undefined) return null;
        const shown = m.tween(start, "enter");
        // In portrait the match label takes this place, so the time label gives way to it.
        const fade = isPortrait ? 1 - recede : mix(1, MOTION.focus.recede, recede);
        return (
          <div
            key={`gap-${gap.after}`}
            style={{
              position: "absolute",
              left: slot.centre.x,
              top: isPortrait ? slot.centre.y : slot.centre.y - 14 * k,
              width: isPortrait ? layout.metrics.width * 0.8 : slot.length - 40 * k,
              translate: isPortrait ? "-50% -50%" : "-50% -100%",
              textAlign: "center",
              fontFamily: tokens.fonts.sans,
              fontWeight: 500,
              fontSize: 30 * k,
              lineHeight: 1.25,
              color: tokens.colours.textMuted,
              opacity: shown * fade,
            }}
          >
            {gap.label}
          </div>
        );
      })}

      {visual.accounts.map((account) => {
        const slot = layout.cards.find((entry) => entry.id === account.id);
        const start = starts[`card:${account.id}`];
        if (!slot || start === undefined) return null;
        const enter = m.tween(start, "enter");
        const settle = m.spring(start, "settle");
        const isMatched = matched.has(account.id);
        const nameStart = m.child(account.nameCue, settled, start, m.frames("quick"));
        const fields = account.fields.map((field, i) => {
          const at = m.child(
            field.cue,
            settled,
            start,
            m.frames("emphasis") + Math.round((i + 1) * MOTION.stagger.field * m.fps),
          );
          return {
            icon: field.icon,
            value: field.value,
            reveal: m.tween(at, "emphasis"),
            emphasis: field.differs ? m.tween(at + m.frames("quick"), "emphasis", "move") : 0,
          };
        });
        const steps = account.steps.map((step, i) => ({
          label: step.label,
          status: step.status,
          progress: m.spring(
            m.child(
              step.cue,
              settled,
              start,
              m.frames("enter") + Math.round(i * MOTION.stagger.auto * m.fps),
            ),
            step.status ? "snap" : "settle",
          ),
        }));
        return (
          <div
            key={account.id}
            style={{
              position: "absolute",
              left: slot.rect.x,
              top: slot.rect.y,
              opacity: enter,
              translate: m.reducedMotion
                ? "0px 0px"
                : `0px ${(1 - settle) * MOTION.distance.rise * k}px`,
            }}
          >
            <IdentityCard
              metrics={metrics}
              name={account.name}
              nameReveal={m.tween(nameStart, "emphasis")}
              nameEmphasis={
                account.nameDiffers ? m.tween(nameStart + m.frames("quick"), "emphasis", "move") : 0
              }
              face={account.face}
              faceScale={isMatched && !m.reducedMotion ? mix(1, MOTION.scale.emphasis, ring) : 1}
              faceRing={isMatched ? ring : 0}
              ringColour={matchColour}
              faceOpacity={isMatched ? 1 : mix(1, MOTION.focus.recede, recede)}
              fields={fields}
              steps={steps}
              contentOpacity={mix(1, MOTION.focus.recede, recede)}
            />
          </div>
        );
      })}

      <ConnectorLayer width={body.width} height={body.height}>
        {isPortrait
          ? null
          : visual.gaps.map((gap) => {
              // Time runs from one card to the next: an arrow under the words says which way.
              const slot = layout.gaps.find((entry) => entry.after === gap.after);
              const start = starts[`gap:${gap.after}`];
              if (!slot || start === undefined) return null;
              const from = slot.centre.x - slot.length / 2 + 30 * k;
              const to = slot.centre.x + slot.length / 2 - 30 * k;
              const y = slot.centre.y + 8 * k;
              const head = 11 * k;
              return (
                <Connector
                  key={`gap-line-${gap.after}`}
                  path={{
                    kind: "poly",
                    points: [
                      { x: from, y },
                      { x: to, y },
                      { x: to - head, y: y - head },
                      { x: to, y },
                      { x: to - head, y: y + head },
                    ],
                  }}
                  progress={m.tween(start, "draw", "move")}
                  colour={tokens.colours.textMuted}
                  width={Math.max(1.5, 2.5 * k)}
                  opacity={mix(1, MOTION.focus.recede, recede)}
                />
              );
            })}
        {links.map((path, i) => (
          <Connector
            key={i}
            path={path}
            progress={link}
            colour={matchColour}
            width={stroke}
            signal={link < 1 ? link : null}
            signalColour={tokens.colours.text}
            signalRadius={stroke * 1.5}
          />
        ))}
      </ConnectorLayer>

      {match && label > 0 && firstLink?.kind === "line" ? (
        <div
          style={{
            position: "absolute",
            left: isPortrait ? firstLink.from.x + 26 * k : (firstLink.from.x + firstLink.to.x) / 2,
            top: isPortrait
              ? (layout.gaps.find((gap) => gap.after === groups[0]?.[0])?.centre.y ??
                (firstLink.from.y + firstLink.to.y) / 2)
              : firstLink.from.y - 18 * k,
            translate: isPortrait ? "0% -50%" : "-50% -100%",
            fontFamily: tokens.fonts.display,
            fontWeight: 600,
            fontSize: 36 * k,
            letterSpacing: "-0.02em",
            whiteSpace: "nowrap",
            color: matchColour,
            opacity: label,
          }}
        >
          {match.label}
        </div>
      ) : null}
    </>
  );
}
