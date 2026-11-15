import type { ReactNode } from "react";
import type { CharacterSceneVisualData } from "../../domain/storyboard";
import { withAlpha } from "../design/colour";
import type { Rect } from "../design/layout";
import { mix } from "../design/motion";
import { useLayout, useSceneEnvironment, useTokens } from "../design/SceneContext";
import { MOTION } from "../design/tokens";
import { useMotion } from "../design/useBeat";
import {
  blendExpression,
  blendPose,
  blinkAt,
  breathAt,
  characterLook,
  expressionFrame,
  heldItem,
  poseFrame,
  posePoints,
  swingArm,
  trackAt,
  waveAt,
  type HeldItem,
} from "../lib/character";
import { layoutCharacterScene, STAGE } from "../lib/character-scene";
import { pointAt } from "../lib/geometry";
import { Character } from "../primitives/Character";
import { Connector, ConnectorLayer } from "../primitives/Connector";
import { Icon } from "../primitives/Icon";
import { StatusMark } from "../primitives/StatusMark";
import { GraphicLayout } from "./GraphicLayout";
import { StageProp, TILE_ICON } from "./StageProp";

export interface CharacterSceneProps {
  visual: CharacterSceneVisualData;
}

/** The geometry of a character scene in a given body, shared by the component and tests. */
export function characterSceneLayout(
  visual: CharacterSceneVisualData,
  body: Rect,
  portrait: boolean,
  unit: number,
) {
  return layoutCharacterScene({ body, portrait, unit, visual });
}

/**
 * A story told with people. A small cast stands on a stage; each action changes what one
 * of them is doing, feeling or saying on its cue, props appear beside them, and things are
 * handed from one to another. Nobody moves unless the narration says something happened.
 */
export function CharacterScene({ visual }: CharacterSceneProps): ReactNode {
  return (
    <GraphicLayout heading={visual.heading}>
      {(body) => <CharacterSceneBody visual={visual} body={body} />}
    </GraphicLayout>
  );
}

function CharacterSceneBody({ visual, body }: { visual: CharacterSceneVisualData; body: Rect }) {
  const tokens = useTokens();
  const { u, isPortrait } = useLayout();
  const { durationFrames } = useSceneEnvironment();
  const m = useMotion();
  const layout = characterSceneLayout(visual, body, isPortrait, u(1));
  const { k } = layout;
  const { settled } = visual;
  const stagger = (index: number): number => Math.round(index * MOTION.stagger.item * m.fps);

  // The cast and the props are there from the start unless a cue brings them on; what the
  // characters then do is a sequence, paced by its cues like any other graphic's.
  const arrivals = new Map<string, number>([
    ...visual.cast.map((character, i) => {
      return [character.id, m.child(character.cue, settled, m.start, stagger(i))] as const;
    }),
    ...visual.props.map((prop, i) => {
      const at = m.child(prop.cue, settled, m.start, stagger(visual.cast.length + i));
      return [prop.id, at] as const;
    }),
  ]);
  const starts = m.schedule(
    [
      ...visual.actions.map((action, i) => ({ key: `action:${i}`, cue: action.cue })),
      ...visual.sends.map((send, i) => ({ key: `send:${i}`, cue: send.cue })),
    ],
    settled,
  );
  const actions = visual.actions.map((action, i) => ({
    ...action,
    start: starts[`action:${i}`] ?? m.start,
  }));
  const idle = {
    frame: m.frame,
    fps: m.fps,
    durationFrames,
    restSeconds: MOTION.character.restSeconds,
  };

  return (
    <>
      <ConnectorLayer width={body.width} height={body.height}>
        {visual.sends.map((_, i) => {
          const slot = layout.sends[i];
          const start = starts[`send:${i}`];
          if (!slot || start === undefined) return null;
          return (
            <Connector
              key={i}
              path={slot.path}
              progress={m.tween(start, "move", "move")}
              colour={tokens.colours.primary}
              width={Math.max(2, 5 * k)}
              dashed
            />
          );
        })}
      </ConnectorLayer>

      {visual.props.map((prop) => {
        const slot = layout.props.find((entry) => entry.id === prop.id);
        if (!slot) return null;
        return (
          <StageProp
            key={prop.id}
            prop={prop}
            rect={slot.rect}
            k={k}
            start={arrivals.get(prop.id) ?? m.start}
            settled={settled}
            portrait={isPortrait}
            attached={slot.attached}
          />
        );
      })}

      {visual.cast.map((character) => {
        const slot = layout.figures.find((entry) => entry.id === character.id);
        const arrive = arrivals.get(character.id);
        if (!slot || arrive === undefined) return null;
        const mine = actions.filter((action) => action.who === character.id);
        const enter = m.tween(arrive, "enter");
        const settle = m.spring(arrive, "settle");
        const leaving = mine.find((action) => action.leave);
        const present = enter * (leaving ? 1 - m.tween(leaving.start, "exit", "exit") : 1);

        const posed = trackAt(
          [
            { start: arrive, value: character.pose },
            ...mine.flatMap((action) =>
              action.pose ? [{ start: action.start, value: action.pose }] : [],
            ),
          ],
          m.frame,
        );
        const felt = trackAt(
          [
            { start: arrive, value: character.expression },
            ...mine.flatMap((action) =>
              action.expression ? [{ start: action.start, value: action.expression }] : [],
            ),
          ],
          m.frame,
        );
        if (!posed || !felt) return null;
        const moved = m.reducedMotion ? 1 : m.tween(posed.start, "move", "move");
        const blended = blendPose(
          poseFrame(posed.from, slot.mirrored),
          poseFrame(posed.to, slot.mirrored),
          moved,
        );
        const swing =
          posed.to === "wave" && !m.reducedMotion
            ? waveAt(
                m.frame - posed.start - m.frames("move"),
                m.fps,
                MOTION.character.waveSwings,
                MOTION.character.waveSeconds,
                MOTION.character.waveDegrees,
              )
            : 0;
        const pose = slot.mirrored
          ? { ...blended, left: swingArm(blended.left, -swing) }
          : { ...blended, right: swingArm(blended.right, swing) };
        const holding: [HeldItem | null, HeldItem | null] = [
          heldItem(posed.from),
          heldItem(posed.to),
        ];
        const held = holding.flatMap((item, i) => {
          if (item === null || (i === 0 && item === holding[1])) return [];
          const kept = holding[0] === holding[1];
          return [{ item, opacity: kept ? 1 : i === 0 ? 1 - moved : moved }];
        });
        const pointing = Math.max(
          posePoints(posed.to) ? moved : 0,
          posePoints(posed.from) ? 1 - moved : 0,
        );
        const expression = blendExpression(
          expressionFrame(felt.from),
          expressionFrame(felt.to),
          m.tween(felt.start, "emphasis", "move"),
        );

        const judged = mine.filter((action) => action.status && m.after(action.start)).at(-1);
        const bubbles = mine.filter((action) => action.say ?? action.think);
        const mark = STAGE.status * k;

        return (
          <div key={character.id} style={{ opacity: present }}>
            <div
              style={{
                position: "absolute",
                left: slot.rect.x,
                top: slot.rect.y,
                translate: m.reducedMotion
                  ? "0px 0px"
                  : `0px ${(1 - settle) * MOTION.distance.rise * k}px`,
              }}
            >
              <Character
                look={characterLook(character.seed ?? character.id, {
                  ...(character.skin ? { skin: character.skin } : {}),
                  ...(character.hair ? { hair: character.hair } : {}),
                  ...(character.hairColour ? { hairColour: character.hairColour } : {}),
                  ...(character.outfit ? { outfit: character.outfit } : {}),
                  hidden: character.hidden,
                })}
                width={slot.rect.width}
                pose={pose}
                expression={expression}
                mirrored={slot.mirrored}
                held={held}
                pointing={pointing}
                blink={
                  m.reducedMotion
                    ? 0
                    : blinkAt(
                        idle,
                        MOTION.character.blinkEverySeconds,
                        MOTION.character.blinkSeconds,
                        character.id,
                      )
                }
                rise={
                  m.reducedMotion
                    ? 0
                    : breathAt(idle, MOTION.character.breathSeconds, character.id) *
                      MOTION.character.breathDistance
                }
              />
              {judged?.status ? (
                <div
                  style={{
                    position: "absolute",
                    // On the side of the resting arm, clear of whatever the busy hand holds up.
                    left: slot.mirrored ? slot.rect.width - mark - 30 * k : 30 * k,
                    top: 34 * k,
                    borderRadius: tokens.radii.pill,
                    backgroundColor: tokens.colours.background,
                  }}
                >
                  <StatusMark
                    status={judged.status}
                    size={mark}
                    progress={m.spring(judged.start, "snap")}
                  />
                </div>
              ) : null}
            </div>

            {character.name && slot.name ? (
              <div
                style={{
                  position: "absolute",
                  left: slot.name.x,
                  top: slot.name.y,
                  width: slot.name.width,
                  height: slot.name.height,
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  fontFamily: tokens.fonts.display,
                  fontWeight: 600,
                  fontSize: STAGE.nameSize * k,
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  whiteSpace: "nowrap",
                  color: tokens.colours.text,
                }}
              >
                {character.name}
              </div>
            ) : null}

            {slot.bubble
              ? bubbles.map((bubble, i) => {
                  const box = slot.bubble;
                  if (!box) return null;
                  const next = bubbles[i + 1];
                  const until = bubble.untilCue
                    ? m.child(bubble.untilCue, settled, bubble.start, 0)
                    : null;
                  const shown =
                    m.tween(bubble.start, "enter") *
                    (until === null ? 1 : 1 - m.tween(until, "quick", "exit")) *
                    (next ? 1 - m.tween(next.start, "quick", "exit") : 1);
                  if (shown <= 0) return null;
                  const down = slot.bubbleTail === "down";
                  const b = STAGE.bubble;
                  const fill = tokens.colours.surfaceRaised;
                  const thought = bubble.think !== undefined;
                  const tail = b.tail * k;
                  return (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        left: box.x,
                        top: box.y,
                        width: box.width,
                        height: box.height,
                        display: "flex",
                        alignItems: down ? "flex-end" : "flex-start",
                        justifyContent: down ? "center" : "flex-start",
                        opacity: shown,
                        scale: m.reducedMotion
                          ? "1"
                          : String(
                              mix(MOTION.scale.enterFrom, 1, m.spring(bubble.start, "settle")),
                            ),
                        transformOrigin: down ? "50% 100%" : "0% 30%",
                      }}
                    >
                      <div
                        style={{
                          position: "relative",
                          boxSizing: "border-box",
                          maxWidth: box.width,
                          padding: `${b.padY * k}px ${b.padX * k}px`,
                          borderRadius: (thought ? 46 : 30) * k,
                          backgroundColor: fill,
                          boxShadow: `0 0 0 ${tokens.stroke.hairline}px ${withAlpha(tokens.colours.text, 0.14)}`,
                          fontFamily: tokens.fonts.sans,
                          fontWeight: 500,
                          fontSize: b.size * k,
                          lineHeight: b.lineHeight,
                          textAlign: "center",
                          textWrap: "balance",
                          color: tokens.colours.text,
                        }}
                      >
                        {thought ? (
                          <>
                            <div
                              style={{
                                position: "absolute",
                                width: tail,
                                height: tail,
                                borderRadius: tokens.radii.pill,
                                backgroundColor: fill,
                                ...(down
                                  ? { left: "50%", bottom: -tail * 0.7, translate: "-120% 0" }
                                  : { left: -tail * 0.6, top: 34 * k }),
                              }}
                            />
                            <div
                              style={{
                                position: "absolute",
                                width: tail * 0.5,
                                height: tail * 0.5,
                                borderRadius: tokens.radii.pill,
                                backgroundColor: fill,
                                ...(down
                                  ? { left: "50%", bottom: -tail * 1.3, translate: "-20% 0" }
                                  : { left: -tail * 1.2, top: 60 * k }),
                              }}
                            />
                          </>
                        ) : (
                          <div
                            style={{
                              position: "absolute",
                              width: tail,
                              height: tail,
                              borderRadius: 5 * k,
                              backgroundColor: fill,
                              rotate: "45deg",
                              ...(down
                                ? { left: "50%", bottom: -tail * 0.42, marginLeft: -tail / 2 }
                                : { left: -tail * 0.42, top: 30 * k }),
                            }}
                          />
                        )}
                        <span style={{ position: "relative" }}>{bubble.say ?? bubble.think}</span>
                      </div>
                    </div>
                  );
                })
              : null}
          </div>
        );
      })}

      {visual.sends.map((send, i) => {
        const slot = layout.sends[i];
        const start = starts[`send:${i}`];
        if (!slot || start === undefined) return null;
        const travelled = m.reducedMotion ? 1 : m.tween(start, "move", "move");
        const at = pointAt(slot.path, travelled);
        const named = m.tween(start + m.frames("move"), "enter");
        return (
          <div key={i}>
            <div
              style={{
                position: "absolute",
                left: at.x - slot.tile.width / 2,
                top: at.y - slot.tile.height / 2,
                width: slot.tile.width,
                height: slot.tile.height,
                boxSizing: "border-box",
                borderRadius: slot.tile.width * 0.28,
                backgroundColor: tokens.colours.surfaceRaised,
                border: `${Math.max(2, 4 * k)}px solid ${tokens.colours.primary}`,
                boxShadow: `0 0 0 ${6 * k}px ${withAlpha(tokens.colours.background, 0.9)}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: m.tween(start, "quick"),
              }}
            >
              <Icon
                name={TILE_ICON[send.object]}
                size={slot.tile.width * 0.5}
                colour={tokens.colours.text}
              />
            </div>
            {send.label ? (
              <div
                style={{
                  position: "absolute",
                  left: slot.label.x,
                  top: slot.label.y,
                  width: slot.label.width,
                  height: slot.label.height,
                  display: "flex",
                  alignItems: isPortrait ? "center" : "flex-start",
                  justifyContent: isPortrait ? "flex-start" : "center",
                  textAlign: isPortrait ? "left" : "center",
                  fontFamily: tokens.fonts.sans,
                  fontWeight: 500,
                  fontSize: STAGE.tile.labelSize * k,
                  lineHeight: 1.2,
                  textWrap: "balance",
                  color: tokens.colours.textSoft,
                  opacity: named,
                }}
              >
                {send.label}
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
