import { estimateLines, fitFontSize, type Rect } from "../design/layout";

/** A hand-held device the footage can be shown in. The browser has its own layout. */
export type DeviceKind = "iphone" | "ipad";

/**
 * Proportions of the generic devices, as fractions of the screen's short edge (bands and
 * cutouts) so a device keeps its shape at any size. Generic shapes only: no maker's
 * artwork, logo or exact outline.
 */
interface DeviceSpec {
  /** Bezel around the glass. */
  bezel: number;
  /** Corner radius of the glass. */
  glassRadius: number;
  /** Portrait phones: a status band above the footage that holds the camera pill. */
  topBand: number;
  /** Portrait phones: a band below the footage that holds the home indicator. */
  bottomBand: number;
}

const SPECS: Record<DeviceKind, DeviceSpec> = {
  iphone: { bezel: 0.042, glassRadius: 0.135, topBand: 0.13, bottomBand: 0.075 },
  ipad: { bezel: 0.042, glassRadius: 0.026, topBand: 0, bottomBand: 0 },
};

/** The viewport each device is recorded at; used when a scene has no recording yet. */
export const DEVICE_VIEWPORT_ASPECT: Record<DeviceKind, number> = {
  iphone: 390 / 844,
  ipad: 1180 / 820,
};

/** Design pixels the side buttons stand out from the body; kept inside the device's box. */
const BUTTON_DEPTH = 4;

export interface DeviceGeometry {
  device: DeviceKind;
  /** Everything below is relative to the top-left corner of the device's outer box. */
  outer: { width: number; height: number };
  /** The body, inset from the outer box by the button depth. */
  body: Rect;
  bodyRadius: number;
  /** Width of the outer rim of the body, drawn lighter than the bezel. */
  rim: number;
  /** The glass: the screen including its status and home bands. */
  glass: Rect;
  glassRadius: number;
  /** The footage, inside the glass. Its aspect is the recording's. */
  screen: Rect;
  /** The camera: a pill on the glass for a portrait phone, a dot on the bezel otherwise. */
  camera: Rect;
  cameraOnGlass: boolean;
  /** Portrait phones: the home indicator in the bottom band. */
  homeIndicator: Rect | null;
  /** Side buttons, drawn behind the body so only their outer edge shows. */
  buttons: Rect[];
}

/**
 * The largest device of the given kind that fits the box and shows footage of the given
 * aspect without cropping or letterboxing. A recording taller than wide gives a portrait
 * device, a wider one a landscape device.
 */
export function fitDevice(
  device: DeviceKind,
  maxWidth: number,
  maxHeight: number,
  aspect: number,
  unit: number,
): DeviceGeometry {
  const spec = SPECS[device];
  const portrait = aspect < 1;
  const depth = BUTTON_DEPTH * unit;
  // In units of the footage width: the short edge, the bands and the bezel.
  const short = Math.min(1, 1 / aspect);
  const bands = portrait ? spec.topBand + spec.bottomBand : 0;
  const bezel = spec.bezel * short;
  const scale = Math.max(
    0,
    Math.min(
      (maxWidth - 2 * depth) / (1 + 2 * bezel),
      (maxHeight - 2 * depth) / (1 / aspect + bands + 2 * bezel),
    ),
  );
  const screenWidth = scale;
  const screenHeight = scale / aspect;
  const shortEdge = Math.min(screenWidth, screenHeight);
  const b = bezel * scale;
  const topBand = portrait ? spec.topBand * scale : 0;
  const bottomBand = portrait ? spec.bottomBand * scale : 0;
  const glassRadius = spec.glassRadius * shortEdge;
  const glass: Rect = {
    x: depth + b,
    y: depth + b,
    width: screenWidth,
    height: screenHeight + topBand + bottomBand,
  };
  const body: Rect = {
    x: depth,
    y: depth,
    width: glass.width + 2 * b,
    height: glass.height + 2 * b,
  };
  const screen: Rect = {
    x: glass.x,
    y: glass.y + topBand,
    width: screenWidth,
    height: screenHeight,
  };
  const onGlass = device === "iphone" && portrait;
  const pill = { width: 0.32 * shortEdge, height: 0.092 * shortEdge };
  const dot = Math.max(unit * 4, b * 0.32);
  const camera: Rect = onGlass
    ? {
        x: glass.x + (glass.width - pill.width) / 2,
        y: glass.y + (topBand - pill.height) / 2,
        width: pill.width,
        height: pill.height,
      }
    : // On the long edge's bezel above the screen, where tablets have it in landscape.
      { x: body.x + (body.width - dot) / 2, y: body.y + (b - dot) / 2, width: dot, height: dot };
  const indicatorWidth = 0.34 * shortEdge;
  const indicatorHeight = Math.max(unit * 3, 0.013 * shortEdge);
  const homeIndicator =
    onGlass && bottomBand > 0
      ? {
          x: glass.x + (glass.width - indicatorWidth) / 2,
          y: screen.y + screen.height + (bottomBand - indicatorHeight) / 2,
          width: indicatorWidth,
          height: indicatorHeight,
        }
      : null;
  // Buttons stand out by `depth` and reach well under the body, which is drawn over them.
  const reach = depth + b;
  const side = (x: number, from: number, to: number): Rect => ({
    x,
    y: body.y + body.height * from,
    width: reach,
    height: body.height * (to - from),
  });
  const top = (from: number, to: number): Rect => ({
    x: body.x + body.width * from,
    y: 0,
    width: body.width * (to - from),
    height: reach,
  });
  const right = body.x + body.width - b;
  const buttons =
    device === "iphone"
      ? portrait
        ? [side(0, 0.16, 0.2), side(0, 0.235, 0.3), side(0, 0.325, 0.39), side(right, 0.25, 0.36)]
        : [top(0.16, 0.2), top(0.235, 0.3), top(0.325, 0.39)]
      : portrait
        ? [top(0.78, 0.86), side(right, 0.12, 0.2), side(right, 0.22, 0.3)]
        : [top(0.82, 0.88), side(right, 0.12, 0.22), side(right, 0.25, 0.35)];
  return {
    device,
    outer: { width: body.width + 2 * depth, height: body.height + 2 * depth },
    body,
    bodyRadius: glassRadius + b,
    rim: Math.max(unit, b * 0.22),
    glass,
    glassRadius,
    screen,
    camera,
    cameraOnGlass: onGlass,
    homeIndicator,
    buttons,
  };
}

export interface DeviceLayoutInput {
  content: { width: number; height: number };
  portrait: boolean;
  u: (designPixels: number) => number;
  device: DeviceKind;
  heading: string | undefined;
  /** The scene sets callout sentences next to the footage, so room is kept for them. */
  hasCallout: boolean;
  /** Width over height of the recorded viewport. */
  aspect: number;
}

export interface DeviceLayout {
  /** The text column (landscape) or the heading block above the device (portrait). */
  text: Rect | null;
  headingSize: number;
  /** Portrait: the height reserved for the callout sentence under the heading. */
  calloutHeight: number;
  /** The device's outer box, buttons included. */
  frame: Rect;
  device: DeviceGeometry;
  /** The footage on screen. */
  viewport: Rect;
}

/** Font size and line height of the callout sentence set beside (or above) the footage. */
export const PRODUCT_CALLOUT = { size: 34, lineHeight: 1.28, lines: 2 } as const;

/**
 * Where everything in a device product scene goes, relative to the content zone. In 16:9
 * the device stands beside a text column, as the browser frame does; in 9:16 the text sits
 * above it and the device takes the rest of the height. A phone-sized recording needs no
 * magnified detail: it is shown at the size it was made for.
 */
export function layoutDevice(input: DeviceLayoutInput): DeviceLayout {
  const { content, portrait, u, heading, aspect, device } = input;
  const { width, height } = content;
  const gap = u(portrait ? 36 : 56);
  const column = portrait ? width : u(440);
  const headingSize = heading
    ? fitFontSize({
        text: heading,
        maxWidth: column,
        maxLines: portrait ? 2 : 5,
        size: u(portrait ? 50 : 54),
        minSize: u(portrait ? 38 : 36),
      })
    : 0;
  const headingHeight = heading
    ? estimateLines(heading, column, headingSize) * headingSize * 1.1
    : 0;
  const hasText = heading !== undefined || input.hasCallout;

  if (!portrait) {
    const available = width - (hasText ? column + gap : 0);
    const geometry = fitDevice(device, available, height, aspect, u(1));
    const rowWidth = geometry.outer.width + (hasText ? column + gap : 0);
    const left = (width - rowWidth) / 2;
    const frame: Rect = {
      x: left + (hasText ? column + gap : 0),
      y: (height - geometry.outer.height) / 2,
      width: geometry.outer.width,
      height: geometry.outer.height,
    };
    // A narrow phone leaves a lot of height: the text column stays at most as tall as the
    // content zone and centred on the device.
    return {
      text: hasText ? { x: left, y: 0, width: column, height } : null,
      headingSize,
      calloutHeight: 0,
      frame,
      device: geometry,
      viewport: offset(geometry.screen, frame),
    };
  }

  const calloutHeight = input.hasCallout
    ? u(PRODUCT_CALLOUT.size) * PRODUCT_CALLOUT.lineHeight * PRODUCT_CALLOUT.lines
    : 0;
  const textHeight = headingHeight + (heading && input.hasCallout ? u(24) : 0) + calloutHeight;
  const textBlock = hasText ? textHeight + gap : 0;
  const geometry = fitDevice(device, width, height - textBlock, aspect, u(1));
  const total = textBlock + geometry.outer.height;
  const top = Math.max(0, (height - total) / 2);
  const frame: Rect = {
    x: (width - geometry.outer.width) / 2,
    y: top + textBlock,
    width: geometry.outer.width,
    height: geometry.outer.height,
  };
  return {
    text: hasText ? { x: 0, y: top, width, height: textHeight } : null,
    headingSize,
    calloutHeight,
    frame,
    device: geometry,
    viewport: offset(geometry.screen, frame),
  };
}

function offset(rect: Rect, by: { x: number; y: number }): Rect {
  return { x: rect.x + by.x, y: rect.y + by.y, width: rect.width, height: rect.height };
}
