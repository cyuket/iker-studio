import { estimateLines, fitFontSize, type Rect } from "../design/layout";

export interface BrowserFrameSize {
  width: number;
  height: number;
  barHeight: number;
  viewportHeight: number;
}

/** Largest frame whose viewport keeps the recording's aspect ratio inside the given box. */
export function fitBrowserFrame(
  maxWidth: number,
  maxHeight: number,
  viewportAspect: number,
  barHeight: number,
): BrowserFrameSize {
  const width = Math.max(0, Math.min(maxWidth, (maxHeight - barHeight) * viewportAspect));
  const viewportHeight = width / viewportAspect;
  return { width, height: viewportHeight + barHeight, barHeight, viewportHeight };
}

export interface ProductLayoutInput {
  content: { width: number; height: number };
  portrait: boolean;
  u: (designPixels: number) => number;
  heading: string | undefined;
  /** The scene shows callout lines beside the footage, so room is kept for them. */
  hasCallout: boolean;
  /** Width over height of the recorded viewport. */
  aspect: number;
  barHeight: number;
  /** Portrait only: a magnified detail panel is wanted under the frame. */
  wantsDetail: boolean;
  /** Height of the caption row above the detail panel. */
  detailHeader: number;
}

export interface ProductGeometry {
  /** The text column (landscape) or heading block (portrait); null when there is no text. */
  text: Rect | null;
  headingSize: number;
  /** The browser frame, bar included. */
  frame: Rect;
  frameSize: BrowserFrameSize;
  /** The footage itself, below the bar. */
  viewport: Rect;
  /** Portrait: the magnified detail panel, caption row included. */
  detail: Rect | null;
}

/**
 * Where everything in a product scene goes, relative to the content zone. In 16:9 the
 * browser frame is the hero with a text column beside it. In 9:16 the frame takes the
 * safe width and, when wanted, a magnified detail of the footage sits below it at a size
 * that reads on a phone. Pure, so a handoff knows exactly where the footage will land.
 */
export function layoutProduct(input: ProductLayoutInput): ProductGeometry {
  const { content, portrait, u, heading, aspect, barHeight } = input;
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

  if (!portrait) {
    const hasText = heading !== undefined || input.hasCallout;
    const frameSize = fitBrowserFrame(
      width - (hasText ? column + gap : 0),
      height,
      aspect,
      barHeight,
    );
    const rowWidth = frameSize.width + (hasText ? column + gap : 0);
    const left = (width - rowWidth) / 2;
    const frame: Rect = {
      x: left + (hasText ? column + gap : 0),
      y: (height - frameSize.height) / 2,
      width: frameSize.width,
      height: frameSize.height,
    };
    return {
      text: hasText ? { x: left, y: frame.y, width: column, height: frame.height } : null,
      headingSize,
      frame,
      frameSize,
      viewport: {
        x: frame.x,
        y: frame.y + barHeight,
        width: frame.width,
        height: frameSize.viewportHeight,
      },
      detail: null,
    };
  }

  const headingBlock = heading ? headingHeight + gap : 0;
  // The magnified detail is what keeps the scene legible on a phone, so when one is asked
  // for the frame gives up height to guarantee it a usable panel.
  const minimumDetail = u(300) + input.detailHeader;
  const budget = height - headingBlock - (input.wantsDetail ? minimumDetail + gap : 0);
  const frameSize = fitBrowserFrame(width, budget, aspect, barHeight);
  const spare = height - headingBlock - frameSize.height - gap;
  const showDetail =
    input.wantsDetail && frameSize.width >= width * 0.6 && spare >= minimumDetail - 1;
  const detailHeight = showDetail ? Math.min(spare, width / 1.45 + input.detailHeader) : 0;
  const total = headingBlock + frameSize.height + (showDetail ? gap + detailHeight : 0);
  const top = Math.max(0, (height - total) / 2);
  const frame: Rect = {
    x: (width - frameSize.width) / 2,
    y: top + headingBlock,
    width: frameSize.width,
    height: frameSize.height,
  };
  return {
    text: heading ? { x: 0, y: top, width, height: headingHeight } : null,
    headingSize,
    frame,
    frameSize,
    viewport: {
      x: frame.x,
      y: frame.y + barHeight,
      width: frame.width,
      height: frameSize.viewportHeight,
    },
    detail: showDetail
      ? { x: 0, y: frame.y + frame.height + gap, width, height: detailHeight }
      : null,
  };
}

/** A region of the recording as a rectangle on screen, given where the viewport is drawn. */
export function regionOnScreen(
  region: { x: number; y: number; width: number; height: number },
  viewport: Rect,
): Rect {
  return {
    x: viewport.x + region.x * viewport.width,
    y: viewport.y + region.y * viewport.height,
    width: region.width * viewport.width,
    height: region.height * viewport.height,
  };
}

export interface HandoffTransform {
  /** Uniform scale of the outgoing graphic, about the centre of its anchor. */
  scale: number;
  translateX: number;
  translateY: number;
  /** Opacity of the outgoing graphic and of the incoming footage. */
  outgoing: number;
  incoming: number;
}

/**
 * A motion graphic handing over to footage. The graphic shrinks until all of it fits the
 * place in the footage where the real thing is, and travels so that its anchor lands on the
 * centre of that place, fading as it arrives,
 * while the footage resolves around that place. Position and scale are continuous; only
 * the picture changes. `progress` is already eased.
 */
export function handoffTransform(
  from: Rect,
  to: Rect,
  progress: number,
  /** Everything the graphic draws; it is scaled so all of it ends up inside the target. */
  bounds: Rect = from,
): HandoffTransform {
  const p = Math.min(1, Math.max(0, progress));
  const fit = Math.min(
    to.width / Math.max(1, bounds.width),
    to.height / Math.max(1, bounds.height),
  );
  // The graphic never grows much: a handoff collapses onto its target, it does not explode.
  const end = Math.min(1.15, Math.max(0.08, fit));
  const ramp = (start: number, finish: number): number =>
    Math.min(1, Math.max(0, (p - start) / (finish - start)));
  return {
    scale: 1 + (end - 1) * p,
    // `|| 0` keeps a resting graphic at 0 rather than -0, so equal states compare equal.
    translateX: (to.x + to.width / 2 - (from.x + from.width / 2)) * p || 0,
    translateY: (to.y + to.height / 2 - (from.y + from.height / 2)) * p || 0,
    outgoing: 1 - ramp(0.35, 0.85),
    incoming: ramp(0.2, 0.75),
  };
}
