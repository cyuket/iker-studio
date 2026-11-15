import type { CSSProperties } from "react";
import type { Brand } from "../../domain/brand";
import type {
  CHARACTER_HAIR_COLOUR,
  CHARACTER_OUTFIT,
  CHARACTER_SKIN,
  Tone,
} from "../../domain/storyboard";
import { mixHex, withAlpha } from "./colour";
import type { Layout } from "./layout";

export interface TypeStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  fontWeight: number;
  letterSpacing: string;
}

export type TypeRole =
  "display" | "h1" | "h2" | "h3" | "bodyLg" | "body" | "small" | "label" | "code";

export interface Tokens {
  colours: Brand["colours"] & {
    /** Hairlines that must stay visible on the dark canvas. */
    hairline: string;
    hairlineStrong: string;
    textSoft: string;
    scrim: string;
  };
  /**
   * Hues for abstract face glyphs, all derived from the brand's primary. They stay between
   * blue and pink on the colour wheel, clear of the green, amber and red that mean
   * verified, flagged and declined.
   */
  glyphs: {
    violet: string;
    blue: string;
    cyan: string;
    pink: string;
    slate: string;
    lilac: string;
  };
  /**
   * Palette of the cartoon characters. Outfits and the brand hair colour are the glyph hues,
   * so a character and a face glyph belong to one film. Skin and natural hair are the only
   * colours here that the brand cannot supply: a short, warm, fixed list. Nothing uses the
   * green, amber or red that mean verified, flagged and declined.
   */
  characters: {
    skin: Record<(typeof CHARACTER_SKIN)[number], string>;
    hair: Record<(typeof CHARACTER_HAIR_COLOUR)[number], string>;
    outfit: Record<(typeof CHARACTER_OUTFIT)[number], string>;
    /** Eyes, brows and mouths: the canvas colour, so features read as cut out of the face. */
    ink: string;
    /** Somebody whose identity is not known: one flat, featureless colour. */
    hidden: string;
    /** The niche a character stands in, before it is tinted with their outfit. */
    backdrop: string;
  };
  fonts: { display: string; sans: string; mono: string };
  type: Record<TypeRole, TypeStyle>;
  /** Spacing scale in output pixels, keyed by step. */
  space: Record<1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16, number>;
  radii: { sm: number; md: number; lg: number; xl: number; pill: number };
  shadows: { panel: string; raised: string; glow: string };
  stroke: { hairline: number; regular: number; strong: number };
}

/**
 * The motion vocabulary. Seconds and design pixels, so it holds at any frame rate and size.
 * Components take every duration, curve, spring and distance from here: a number that is
 * not in this table does not belong in a component.
 */
export const MOTION = {
  /** How long each kind of change takes, in seconds. */
  duration: {
    /** A state flipping in place: a colour, a mark. */
    quick: 0.2,
    /** Something arriving on screen. */
    enter: 0.6,
    /** The scene's content leaving. */
    exit: 1 / 3,
    /** Picking something out: a differing field, a chosen path. */
    emphasis: 0.4,
    /** An object travelling between two resting places. */
    move: 0.8,
    /** A connector drawing itself from one end to the other. */
    draw: 0.7,
    /** A pulse travelling along a connector. */
    signal: 0.9,
    /** Everything but the subject stepping back. */
    focus: 0.45,
    /** The rest coming forward again. */
    release: 0.3,
    /** One camera move over product footage. */
    camera: 1.2,
    /** No camera move is shorter than this: anything faster reads as a jolt. */
    cameraMin: 0.6,
    /** The transition: a motion graphic handing over to footage. */
    handoff: 0.9,
  },
  /** Cubic bezier curves. Four, each with one job. */
  easing: {
    /** Decelerating: for everything that arrives. */
    enter: [0.16, 1, 0.3, 1],
    /** Symmetric: for moves between two resting states. */
    move: [0.65, 0, 0.35, 1],
    /** Accelerating: for everything that leaves. */
    exit: [0.4, 0, 1, 1],
    /** Slow start, long settle: for the camera, so a move never snaps to a stop. */
    camera: [0.45, 0, 0.15, 1],
  },
  /** Spring configurations for things with mass. None of them bounces visibly. */
  spring: {
    /** Critically damped: cards and panels coming to rest. */
    settle: { mass: 1, damping: 26, stiffness: 170 },
    /** Quick, with a barely visible overshoot: a status mark being stamped. */
    snap: { mass: 0.6, damping: 19, stiffness: 240 },
    /** Overdamped and slow: large things changing size. */
    glide: { mass: 1, damping: 40, stiffness: 90 },
  },
  /** Gaps between things that arrive one after another, in seconds. */
  stagger: {
    /** Items of one list. */
    item: 0.12,
    /** Fields of one card. */
    field: 0.09,
    /** Steps with no cue of their own, placed after the last cued step. */
    auto: 0.5,
  },
  /** Travel distances in design pixels. */
  distance: { rise: 20, nudge: 10 },
  /** Scale ranges. Nothing grows or shrinks beyond these. */
  scale: {
    /** Size something starts at when it scales in. */
    enterFrom: 0.94,
    /** Size of something picked out. */
    emphasis: 1.08,
    /** A camera move that would zoom less than this is not worth making. */
    cameraMin: 1.2,
    /** A portrait detail panel exists to magnify, so it follows the camera from this zoom up. */
    detailMin: 1.04,
    /** Default ceiling for camera zoom. */
    cameraMax: 2,
    /** Footage is never enlarged beyond this many output pixels per recorded pixel. */
    upscaleLimit: 2,
  },
  /** Focus and isolation. */
  focus: {
    /** Opacity of the scrim over footage outside the focus region. */
    dim: 0.56,
    /** Opacity illustration elements fall back to when they are not the subject. */
    recede: 0.3,
  },
  /** Virtual camera behaviour over footage. Seconds and viewport fractions. */
  camera: {
    /** The camera arrives this long before the action it is moving to. */
    leadSeconds: 0.35,
    /** A framing is held at least this long before the camera moves again. */
    holdSeconds: 0.8,
    /** Space kept around the focus region, as a fraction of the region. */
    padding: 0.32,
    /** Consecutive actions are framed together while one framing can still zoom this far. */
    groupMinZoom: 1.35,
    /** Centres further apart than this are "far": the camera pulls back between them. */
    farDistance: 0.42,
    /** Framings closer than this are the same framing. */
    mergeDistance: 0.05,
  },
  /**
   * Cartoon characters. Idle life is small, slow and frame-based, and it is at rest on a
   * scene's first and last frame so a held cut still matches.
   */
  character: {
    /** One breath in and out. */
    breathSeconds: 4.2,
    /** How far the shoulders rise on a breath, in design pixels. */
    breathDistance: 3,
    /** How long the eyes are closed in a blink. */
    blinkSeconds: 0.14,
    /** Shortest time between two blinks; each character adds up to half as much again. */
    blinkEverySeconds: 3.2,
    /** No idle movement this close to either end of a scene. */
    restSeconds: 0.6,
    /** A waving hand: how many times it swings, how long each takes and how far it turns. */
    waveSwings: 3,
    waveSeconds: 0.42,
    waveDegrees: 13,
  },
  /**
   * Motion blur is off. The only native option (@remotion/motion-blur) renders every frame
   * several times and smears text in footage; nothing here moves fast enough to need it.
   */
  motionBlur: "off",

  // The names below predate the table above and are kept for the original components.
  enterSeconds: 0.6,
  exitSeconds: 1 / 3,
  /** First content appears this long after the bare first frame. */
  leadSeconds: 2 / 30,
  riseDistance: 20,
  staggerSeconds: 0.12,
  zoomSeconds: 1.4,
  /** Decelerating curve used for everything that enters. */
  enterBezier: [0.16, 1, 0.3, 1],
  /** Symmetric curve for moves between two resting states. */
  moveBezier: [0.65, 0, 0.35, 1],
} as const;

export type MotionDuration = keyof typeof MOTION.duration;
export type MotionEasing = keyof typeof MOTION.easing;
export type MotionSpring = keyof typeof MOTION.spring;

/**
 * Supporting hues for glyphs and outfits, from the Iker chart palette (brand/tokens), lifted
 * so they read on the obsidian canvas. Terracotta stays the one accent; these never carry
 * meaning, and they sit apart from the green, amber and red used for status.
 * The glyph keys (violet, blue, cyan, pink) are storyboard enum names kept from the
 * original studio: `violet` is the brand primary (terracotta), `cyan` is palm sage.
 */
const SUPPORTING = { blue: "#7d97c9", sage: "#89a898", plum: "#b585ae" } as const;

/** Warm skin tones, muted enough to sit on the dark canvas beside the brand's terracotta. */
const SKIN = { deep: "#7b4b36", brown: "#a66c4a", tan: "#cb956a", light: "#ebc19d" } as const;
/** Natural hair. `ink` is lifted off pure black so it still reads against a dark niche. */
const HAIR = { ink: "#17131f", brown: "#4b2f29", auburn: "#8c4a39", silver: "#c6c8d6" } as const;

const fallbackSans = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const fallbackMono = 'ui-monospace, "SF Mono", Menlo, monospace';

export function buildTokens(brand: Brand, layout: Layout): Tokens {
  const { u, pick } = layout;
  const fonts = {
    display: `"${brand.fonts.display}", ${fallbackSans}`,
    sans: `"${brand.fonts.sans}", ${fallbackSans}`,
    mono: `"${brand.fonts.mono}", ${fallbackMono}`,
  };
  const display = (
    size: number,
    lineHeight: number,
    tracking: number,
    weight = 600,
  ): TypeStyle => ({
    fontFamily: fonts.display,
    fontSize: u(size),
    lineHeight,
    fontWeight: weight,
    letterSpacing: `${tracking}em`,
  });
  const sans = (size: number, lineHeight: number, weight = 400): TypeStyle => ({
    fontFamily: fonts.sans,
    fontSize: u(size),
    lineHeight,
    fontWeight: weight,
    letterSpacing: "-0.005em",
  });
  const mono = (size: number, lineHeight: number, tracking: number): TypeStyle => ({
    fontFamily: fonts.mono,
    fontSize: u(size),
    lineHeight,
    fontWeight: 500,
    letterSpacing: `${tracking}em`,
  });

  // Tracking is set for Plus Jakarta Sans: its word space is narrow, so tighter values
  // than these close the gaps between words in headlines.
  return {
    colours: {
      ...brand.colours,
      hairline: withAlpha(brand.colours.text, 0.09),
      hairlineStrong: withAlpha(brand.colours.text, 0.16),
      textSoft: withAlpha(brand.colours.text, 0.74),
      scrim: withAlpha(brand.colours.background, 0.62),
    },
    glyphs: {
      violet: brand.colours.primary,
      blue: SUPPORTING.blue,
      cyan: SUPPORTING.sage,
      pink: SUPPORTING.plum,
      slate: brand.colours.textMuted,
      lilac: brand.colours.accent,
    },
    characters: {
      skin: SKIN,
      hair: { ...HAIR, violet: brand.colours.accent },
      outfit: {
        violet: brand.colours.primary,
        blue: SUPPORTING.blue,
        cyan: SUPPORTING.sage,
        pink: SUPPORTING.plum,
        lilac: brand.colours.accent,
        slate: brand.colours.textMuted,
        cream: brand.colours.text,
      },
      ink: brand.colours.background,
      hidden: mixHex(brand.colours.surfaceRaised, brand.colours.textMuted, 0.42),
      backdrop: brand.colours.surfaceRaised,
    },
    fonts,
    type: {
      display: display(pick(124, 104), 1.0, -0.022),
      h1: display(pick(88, 82), 1.04, -0.02),
      h2: display(pick(60, 62), 1.08, -0.016),
      h3: display(pick(38, 44), 1.18, -0.008, 500),
      bodyLg: sans(pick(38, 42), 1.36),
      body: sans(pick(30, 36), 1.4),
      small: sans(pick(24, 30), 1.4),
      label: mono(pick(20, 25), 1.2, 0.14),
      code: mono(pick(26, 26), 1.6, 0),
    },
    space: {
      1: u(4),
      2: u(8),
      3: u(12),
      4: u(16),
      5: u(20),
      6: u(24),
      8: u(32),
      10: u(40),
      12: u(48),
      16: u(64),
    },
    radii: { sm: u(8), md: u(14), lg: u(20), xl: u(28), pill: u(999) },
    shadows: {
      panel: `0 ${u(1)}px 0 ${withAlpha(brand.colours.text, 0.05)} inset, 0 ${u(24)}px ${u(64)}px ${withAlpha("#000000", 0.45)}`,
      raised: `0 ${u(1)}px 0 ${withAlpha(brand.colours.text, 0.07)} inset, 0 ${u(40)}px ${u(96)}px ${withAlpha("#000000", 0.55)}`,
      glow: `0 0 0 ${u(1)}px ${withAlpha(brand.colours.primary, 0.5)}, 0 ${u(12)}px ${u(48)}px ${withAlpha(brand.colours.primary, 0.28)}`,
    },
    stroke: { hairline: Math.max(1, u(1)), regular: Math.max(1, u(2)), strong: Math.max(2, u(3)) },
  };
}

export function toneColour(tokens: Tokens, tone: Tone): string {
  switch (tone) {
    case "primary":
      return tokens.colours.primary;
    case "positive":
      return tokens.colours.positive;
    case "warning":
      return tokens.colours.warning;
    case "danger":
      return tokens.colours.danger;
    case "neutral":
      return tokens.colours.textMuted;
  }
}

/** Uppercase mono label used for eyebrows, kickers and tags. */
export function labelStyle(tokens: Tokens, colour: string): CSSProperties {
  return { ...tokens.type.label, color: colour, textTransform: "uppercase" };
}
