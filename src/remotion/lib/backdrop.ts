/**
 * Geometry of the animated background: a pure function of time since the start of the cut.
 * The component only draws what this returns. Nothing here depends on a scene, so two
 * consecutive frames either side of a hard join differ by one frame of slow drift, exactly as
 * two consecutive frames inside a scene do.
 */

export interface BackdropMotion {
  gridDriftPerSecond: number;
  glowOrbitSeconds: readonly number[];
  glowTravel: number;
  glowBreathSeconds: number;
  dotRisePerSecond: number;
}

export interface BackdropGlow {
  /** Centre in pixels. */
  x: number;
  y: number;
  /** Radius in pixels. */
  radius: number;
  /** 0 to 1, multiplied into the glow's colour. */
  strength: number;
  tone: "primary" | "accent";
}

export interface BackdropDot {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  ring: boolean;
}

export interface BackdropFrame {
  /** Grid offset in pixels along both axes, already wrapped to one grid cell. */
  gridOffset: number;
  gridSize: number;
  glows: BackdropGlow[];
  dots: BackdropDot[];
}

export interface BackdropInput {
  seconds: number;
  width: number;
  height: number;
  /** Output pixels per design pixel. */
  unit: number;
  portrait: boolean;
  /** Width of the frame's left and right margins outside the safe area, in pixels. */
  margins: { left: number; right: number };
  motion: BackdropMotion;
}

/** Glow homes as fractions of the frame, with phase offsets so they start apart. */
const GLOWS: readonly {
  x: number;
  y: number;
  radius: number;
  phase: number;
  tone: "primary" | "accent";
}[] = [
  { x: 0.22, y: 0.18, radius: 0.62, phase: 0, tone: "primary" },
  { x: 0.8, y: 0.72, radius: 0.54, phase: 2.1, tone: "primary" },
  { x: 0.55, y: 1.05, radius: 0.5, phase: 4.2, tone: "accent" },
];

/**
 * Edge dots: the brand kit's booking dot used as texture. They live in the outer bands of
 * the frame only, never behind the middle where text and footage sit.
 */
const DOTS: readonly { band: number; y: number; size: number; speed: number; ring: boolean }[] = [
  { band: 0.15, y: 0.1, size: 7, speed: 1, ring: false },
  { band: 0.55, y: 0.42, size: 12, speed: 0.7, ring: true },
  { band: 0.85, y: 0.78, size: 5, speed: 1.3, ring: false },
  { band: 0.35, y: 0.63, size: 9, speed: 0.85, ring: true },
  { band: 0.7, y: 0.25, size: 6, speed: 1.15, ring: false },
];

function wrap(value: number, period: number): number {
  return ((value % period) + period) % period;
}

export function backdropFrame(input: BackdropInput): BackdropFrame {
  const { seconds, width, height, unit, portrait, margins, motion } = input;
  const shortEdge = Math.min(width, height);
  const gridSize = unit * (portrait ? 90 : 96);
  const gridOffset = wrap(seconds * motion.gridDriftPerSecond * unit, gridSize);

  const breath = 0.5 + 0.5 * Math.sin((2 * Math.PI * seconds) / motion.glowBreathSeconds);
  const glows = GLOWS.map((home, index): BackdropGlow => {
    const orbit = motion.glowOrbitSeconds[index % motion.glowOrbitSeconds.length] ?? 20;
    const angle = (2 * Math.PI * seconds) / orbit + home.phase;
    const travel = motion.glowTravel * shortEdge;
    return {
      x: home.x * width + Math.cos(angle) * travel,
      y: home.y * height + Math.sin(angle * 0.8) * travel,
      radius: home.radius * Math.max(width, height),
      strength: 0.75 + 0.25 * (index % 2 === 0 ? breath : 1 - breath),
      tone: home.tone,
    };
  });

  const margin = unit * 40;
  const travelSpan = height + 2 * margin;
  const dots = DOTS.flatMap((dot, index) =>
    [0, 1].map((side): BackdropDot => {
      const radius = unit * dot.size;
      // Inside the margin outside the safe area, so a dot never sits behind text or footage.
      const band = side === 0 ? margins.left : margins.right;
      const inBand = radius + dot.band * Math.max(0, band - 2 * radius);
      const x = side === 0 ? inBand : width - inBand;
      // Each side starts at a different height so the two edges do not mirror each other.
      const start = (dot.y + side * 0.5 + index * 0.13) * travelSpan;
      const risen = seconds * motion.dotRisePerSecond * dot.speed * unit;
      const y = travelSpan - wrap(start + risen, travelSpan) - margin;
      // Fade in from the bottom edge and out towards the top, measured on the visible frame,
      // so a dot is fully transparent wherever it wraps and never pops.
      const along = y / height;
      const opacity = Math.max(0, Math.min(1, along * 4, (1 - along) * 4));
      return { x, y, radius, opacity, ring: dot.ring };
    }),
  );

  return { gridOffset, gridSize, glows, dots };
}
