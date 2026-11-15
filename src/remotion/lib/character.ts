import {
  CHARACTER_HAIR,
  CHARACTER_OUTFIT,
  CHARACTER_SKIN,
  type CharacterExpression,
  type CharacterPose,
} from "../../domain/storyboard";
import { hashSeed } from "./face";
import type { Point } from "./geometry";

/**
 * Cartoon characters: the people of an explainer, drawn waist-up in a niche. They are the
 * face glyph's family grown up (the same flat shapes, the same hair, the same hues) with
 * arms that can hold things and a face that can feel something. Everything here is pure:
 * a look from a seed, poses and expressions as numbers that blend, and idle life as a
 * function of the frame.
 */

/** The box one character is drawn in, in design pixels. Poses never leave it. */
export const FIGURE = { width: 400, height: 430 } as const;
/** Where the niche sits in that box: the part that is always filled. */
export const NICHE = { x: 50, y: 20, width: 300 } as const;

export interface CharacterLook {
  skin: (typeof CHARACTER_SKIN)[number];
  hair: (typeof CHARACTER_HAIR)[number];
  hairColour: "ink" | "brown" | "auburn" | "silver" | "violet";
  outfit: (typeof CHARACTER_OUTFIT)[number];
  /** A V neckline instead of a round one. */
  collar: boolean;
  hidden: boolean;
}

/** Hair colours a seed may pick. The brand's violet is only ever chosen on purpose. */
const SEEDED_HAIR_COLOUR = ["ink", "ink", "brown", "auburn"] as const;
/** Outfits a seed may pick: slate and cream are left for deliberate, quieter characters. */
const SEEDED_OUTFIT = CHARACTER_OUTFIT.filter((outfit) => outfit !== "slate");
const SEEDED_HAIR = CHARACTER_HAIR.filter((hair) => hair !== "none");

/** The look for a seed. Equal seeds give equal people; anything stated outright wins. */
export function characterLook(
  seed: string,
  chosen: Partial<Omit<CharacterLook, "collar">> = {},
): CharacterLook {
  let rest = hashSeed(seed.trim().toLowerCase());
  const take = <T>(options: readonly T[], fallback: T): T => {
    const value = options[rest % options.length] ?? fallback;
    rest = Math.floor(rest / options.length);
    return value;
  };
  const outfit = take(SEEDED_OUTFIT, "violet");
  const hair = take(SEEDED_HAIR, "crop");
  const skin = take(CHARACTER_SKIN, "brown");
  const hairColour = take(SEEDED_HAIR_COLOUR, "ink");
  const collar = take([true, false], false);
  return {
    skin: chosen.skin ?? skin,
    hair: chosen.hair ?? hair,
    hairColour: chosen.hairColour ?? hairColour,
    outfit: chosen.outfit ?? outfit,
    collar,
    hidden: chosen.hidden ?? false,
  };
}

/** What a pose puts in the character's hand. */
export type HeldItem = "phone" | "id-card" | "camera-phone" | "laptop";

export interface Arm {
  elbow: Point;
  hand: Point;
}

export interface PoseFrame {
  /** The arm on the viewer's left, and the one on the viewer's right. */
  left: Arm;
  right: Arm;
  /** Where the eyes look, as an offset of the pupils in design pixels. */
  gaze: Point;
}

interface PoseSpec extends PoseFrame {
  held: HeldItem | null;
  /** An index finger, for a pose that singles something out. */
  points: boolean;
}

const SHOULDER = { left: { x: 104, y: 292 }, right: { x: 296, y: 292 } } as const;
const REST_LEFT: Arm = { elbow: { x: 92, y: 362 }, hand: { x: 100, y: 416 } };
const REST_RIGHT: Arm = { elbow: { x: 308, y: 362 }, hand: { x: 300, y: 416 } };
const AHEAD: Point = { x: 0, y: 0 };

/**
 * Every pose, with the busy arm on the viewer's right. A character standing on the right
 * of the stage uses the mirror image, so the gesture is made towards the others.
 */
const POSES: Record<CharacterPose, PoseSpec> = {
  idle: { left: REST_LEFT, right: REST_RIGHT, gaze: AHEAD, held: null, points: false },
  wave: {
    left: REST_LEFT,
    right: { elbow: { x: 338, y: 326 }, hand: { x: 346, y: 232 } },
    gaze: AHEAD,
    held: null,
    points: false,
  },
  think: {
    left: REST_LEFT,
    right: { elbow: { x: 306, y: 384 }, hand: { x: 244, y: 236 } },
    gaze: { x: -3, y: -4 },
    held: null,
    points: false,
  },
  point: {
    left: REST_LEFT,
    right: { elbow: { x: 330, y: 338 }, hand: { x: 370, y: 284 } },
    gaze: { x: 4, y: 0 },
    held: null,
    points: true,
  },
  shrug: {
    left: { elbow: { x: 64, y: 352 }, hand: { x: 52, y: 286 } },
    right: { elbow: { x: 336, y: 352 }, hand: { x: 348, y: 286 } },
    gaze: AHEAD,
    held: null,
    points: false,
  },
  "hold-phone": {
    left: REST_LEFT,
    right: { elbow: { x: 322, y: 376 }, hand: { x: 262, y: 344 } },
    gaze: { x: 2, y: 5 },
    held: "phone",
    points: false,
  },
  "hold-id": {
    left: REST_LEFT,
    right: { elbow: { x: 346, y: 348 }, hand: { x: 328, y: 300 } },
    gaze: { x: 3, y: 0 },
    held: "id-card",
    points: false,
  },
  selfie: {
    left: REST_LEFT,
    right: { elbow: { x: 340, y: 306 }, hand: { x: 352, y: 204 } },
    gaze: { x: 4, y: -2 },
    held: "camera-phone",
    points: false,
  },
  "at-laptop": {
    left: { elbow: { x: 96, y: 374 }, hand: { x: 150, y: 404 } },
    right: { elbow: { x: 304, y: 374 }, hand: { x: 250, y: 404 } },
    gaze: { x: 0, y: 5 },
    held: "laptop",
    points: false,
  },
};

/** Where an arm starts, on the viewer's left or right. */
export function shoulder(side: "left" | "right"): Point {
  return SHOULDER[side];
}

const flip = (point: Point): Point => ({ x: FIGURE.width - point.x, y: point.y });
const flipArm = (arm: Arm): Arm => ({ elbow: flip(arm.elbow), hand: flip(arm.hand) });

/** The arms and gaze of a pose. Mirrored, the busy arm is on the viewer's left. */
export function poseFrame(pose: CharacterPose, mirrored: boolean): PoseFrame {
  const spec = POSES[pose];
  if (!mirrored) return { left: spec.left, right: spec.right, gaze: spec.gaze };
  return {
    left: flipArm(spec.right),
    right: flipArm(spec.left),
    gaze: { x: -spec.gaze.x, y: spec.gaze.y },
  };
}

export function heldItem(pose: CharacterPose): HeldItem | null {
  return POSES[pose].held;
}

export function posePoints(pose: CharacterPose): boolean {
  return POSES[pose].points;
}

/**
 * A number part of the way between two others. Exactly `from` at 0 and exactly `to` at 1,
 * with no rounding: a scene that opens settled must draw what the last one ended on.
 */
export function between(from: number, to: number, progress: number): number {
  if (progress <= 0) return from;
  if (progress >= 1) return to;
  return from + (to - from) * progress;
}

const betweenPoints = (a: Point, b: Point, t: number): Point => ({
  x: between(a.x, b.x, t),
  y: between(a.y, b.y, t),
});
const betweenArms = (a: Arm, b: Arm, t: number): Arm => ({
  elbow: betweenPoints(a.elbow, b.elbow, t),
  hand: betweenPoints(a.hand, b.hand, t),
});

/** A pose part of the way to another: every joint travels in a straight line. */
export function blendPose(from: PoseFrame, to: PoseFrame, progress: number): PoseFrame {
  return {
    left: betweenArms(from.left, to.left, progress),
    right: betweenArms(from.right, to.right, progress),
    gaze: betweenPoints(from.gaze, to.gaze, progress),
  };
}

/** A hand turned about its elbow by `degrees`: a wave is the forearm swinging. */
export function swingArm(arm: Arm, degrees: number): Arm {
  if (degrees === 0) return arm;
  const angle = (degrees * Math.PI) / 180;
  const dx = arm.hand.x - arm.elbow.x;
  const dy = arm.hand.y - arm.elbow.y;
  return {
    elbow: arm.elbow,
    hand: {
      x: arm.elbow.x + dx * Math.cos(angle) - dy * Math.sin(angle),
      y: arm.elbow.y + dx * Math.sin(angle) + dy * Math.cos(angle),
    },
  };
}

/** A face as numbers, so one feeling can turn into another. */
export interface ExpressionFrame {
  /** Curve of the mouth: 1 is a full smile, -1 a full frown. */
  smile: number;
  /** Half the width of the mouth. */
  width: number;
  /** How far the mouth is open, 0 to 1. */
  open: number;
  /** Brows moved up (negative) or down. */
  browLift: number;
  /** Inner ends of the brows raised: concern. */
  browTilt: number;
  /** One brow raised further than the other: a question. */
  browRaise: number;
  /** Size of the eyes; 1 is at rest. */
  eyes: number;
}

const EXPRESSIONS: Record<CharacterExpression, ExpressionFrame> = {
  neutral: { smile: 0.45, width: 19, open: 0, browLift: 0, browTilt: 0, browRaise: 0, eyes: 1 },
  happy: { smile: 1, width: 27, open: 0.6, browLift: -3, browTilt: 0, browRaise: 0, eyes: 1 },
  curious: { smile: 0.1, width: 13, open: 0, browLift: -2, browTilt: 0, browRaise: 8, eyes: 1.06 },
  worried: { smile: -0.6, width: 17, open: 0, browLift: -4, browTilt: 9, browRaise: 0, eyes: 1.06 },
  surprised: { smile: 0, width: 11, open: 1, browLift: -10, browTilt: 0, browRaise: 0, eyes: 1.2 },
};

export function expressionFrame(expression: CharacterExpression): ExpressionFrame {
  return EXPRESSIONS[expression];
}

export function blendExpression(
  from: ExpressionFrame,
  to: ExpressionFrame,
  progress: number,
): ExpressionFrame {
  return {
    smile: between(from.smile, to.smile, progress),
    width: between(from.width, to.width, progress),
    open: between(from.open, to.open, progress),
    browLift: between(from.browLift, to.browLift, progress),
    browTilt: between(from.browTilt, to.browTilt, progress),
    browRaise: between(from.browRaise, to.browRaise, progress),
    eyes: between(from.eyes, to.eyes, progress),
  };
}

export interface TrackEntry<T> {
  /** Frame the change starts on. */
  start: number;
  value: T;
}

export interface TrackState<T> {
  /** What it was before the change in progress. */
  from: T;
  to: T;
  /** Frame the change in progress started on. */
  start: number;
}

/**
 * The state of something that changes a few times in a scene (a pose, an expression) at
 * `frame`: the last change that has started, and what it replaced. Changes that start on
 * the same frame apply in the order given, so the later one is what is seen.
 */
export function trackAt<T>(entries: readonly TrackEntry<T>[], frame: number): TrackState<T> | null {
  const ordered = entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => a.entry.start - b.entry.start || a.index - b.index)
    .map(({ entry }) => entry);
  const first = ordered[0];
  if (!first) return null;
  let current = 0;
  ordered.forEach((entry, index) => {
    if (entry.start <= frame) current = index;
  });
  const to = ordered[current] ?? first;
  const from = ordered[current - 1] ?? to;
  return { from: from.value, to: to.value, start: to.start };
}

export interface IdleInput {
  frame: number;
  fps: number;
  /** Length of the scene: idle life is at rest on its first and last frame. */
  durationFrames: number;
  /** Seconds without movement at either end of the scene. */
  restSeconds: number;
}

/** 0 at both ends of the scene, 1 in between, ramping over the rest period. */
function idleEnvelope(input: IdleInput): number {
  const rest = Math.max(1, Math.round(input.restSeconds * input.fps));
  const fromStart = input.frame / rest;
  const fromEnd = (input.durationFrames - 1 - input.frame) / rest;
  return Math.min(1, Math.max(0, Math.min(fromStart, fromEnd)));
}

/** How far through a breath the character is: 0 at rest, 1 at the top of the breath. */
export function breathAt(input: IdleInput, breathSeconds: number, seed: string): number {
  const envelope = idleEnvelope(input);
  if (envelope === 0) return 0;
  const period = Math.max(1, breathSeconds * input.fps);
  const offset = (hashSeed(seed) % 1000) / 1000;
  return envelope * (0.5 - 0.5 * Math.cos(2 * Math.PI * (input.frame / period + offset)));
}

/**
 * How closed the eyes are: 0 open, 1 shut. Each character blinks on their own slow clock,
 * and never near either end of the scene.
 */
export function blinkAt(
  input: IdleInput,
  everySeconds: number,
  blinkSeconds: number,
  seed: string,
): number {
  if (idleEnvelope(input) < 1) return 0;
  const hash = hashSeed(seed);
  const every = Math.max(2, Math.round(everySeconds * (1 + (hash % 500) / 1000) * input.fps));
  const length = Math.max(2, Math.round(blinkSeconds * input.fps));
  const phase = (input.frame + (hash % every)) % every;
  if (phase >= length) return 0;
  // Nearly shut through the middle of the blink, half open on its first and last frame.
  return Math.sin((Math.PI * (phase + 0.5)) / length);
}

/**
 * Degrees a waving forearm is turned, `sinceFrames` after the hand was raised. A few
 * swings that die away, and then exactly 0: the hand stays up and still.
 */
export function waveAt(
  sinceFrames: number,
  fps: number,
  swings: number,
  swingSeconds: number,
  degrees: number,
): number {
  const total = Math.max(1, Math.round(swings * swingSeconds * fps));
  if (sinceFrames <= 0 || sinceFrames >= total) return 0;
  const t = sinceFrames / total;
  return Math.sin(2 * Math.PI * swings * t) * degrees * (1 - t * 0.5);
}
