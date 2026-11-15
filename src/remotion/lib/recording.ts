import type { RecordingTimeline } from "../../domain/recording";
import type { Region } from "../../domain/storyboard";

export interface ZoomState {
  scale: number;
  /** Translation as a fraction of the viewport, applied after scaling from the top-left. */
  translateX: number;
  translateY: number;
}

export const NO_ZOOM: ZoomState = { scale: 1, translateX: 0, translateY: 0 };

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * A single push-in towards `focus`. At progress 1 the focus region fills most of the
 * viewport (capped so the UI is never blown up into mush) and is centred as far as it can
 * be without exposing anything beyond the edge of the recording.
 */
export function zoomTowards(
  focus: Region | undefined,
  progress: number,
  maxScale = 1.8,
): ZoomState {
  if (!focus || progress <= 0) return NO_ZOOM;
  const p = clamp(progress, 0, 1);
  const target = clamp(0.82 / Math.max(focus.width, focus.height), 1, maxScale);
  const centreX = focus.x + focus.width / 2;
  const centreY = focus.y + focus.height / 2;
  const endX = clamp(0.5 - centreX * target, 1 - target, 0);
  const endY = clamp(0.5 - centreY * target, 1 - target, 0);
  return { scale: 1 + (target - 1) * p, translateX: endX * p, translateY: endY * p };
}

/** Where a region of the recording ends up, in viewport fractions, once zoomed. */
export function mapRegion(region: Region, zoom: ZoomState): Region {
  return {
    x: region.x * zoom.scale + zoom.translateX,
    y: region.y * zoom.scale + zoom.translateY,
    width: region.width * zoom.scale,
    height: region.height * zoom.scale,
  };
}

/** Clips a region to the visible viewport; null when nothing of it is visible. */
export function clipRegion(region: Region): Region | null {
  const x0 = clamp(region.x, 0, 1);
  const y0 = clamp(region.y, 0, 1);
  const x1 = clamp(region.x + region.width, 0, 1);
  const y1 = clamp(region.y + region.height, 0, 1);
  if (x1 - x0 <= 0 || y1 - y0 <= 0) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export function isAnnotationVisible(
  annotation: { fromSeconds: number; toSeconds?: number | undefined },
  seconds: number,
): boolean {
  return (
    seconds >= annotation.fromSeconds &&
    (annotation.toSeconds === undefined || seconds < annotation.toSeconds)
  );
}

/** Grows the focus region by a margin and reshapes it to `aspect`, staying inside the viewport. */
export function detailCrop(
  focus: Region,
  aspect: number,
  viewportAspect: number,
  margin = 0.12,
): Region {
  // Work in a space where both axes share one unit (viewport height = 1).
  const focusWidth = focus.width * viewportAspect * (1 + margin * 2);
  const focusHeight = focus.height * (1 + margin * 2);
  let height = Math.max(focusHeight, focusWidth / aspect);
  let width = height * aspect;
  if (width > viewportAspect) {
    width = viewportAspect;
    height = width / aspect;
  }
  if (height > 1) {
    height = 1;
    width = height * aspect;
  }
  const fracWidth = width / viewportAspect;
  const centreX = focus.x + focus.width / 2;
  const centreY = focus.y + focus.height / 2;
  return {
    x: clamp(centreX - fracWidth / 2, 0, 1 - fracWidth),
    y: clamp(centreY - height / 2, 0, 1 - height),
    width: fracWidth,
    height,
  };
}

export interface CursorState {
  /** Position in viewport fractions. */
  x: number;
  y: number;
  /** 0-1 progress of the click ripple, or null when no click is in flight. */
  click: number | null;
}

interface CursorStop {
  x: number;
  y: number;
  at: number;
  until: number;
  isClick: boolean;
}

const TRAVEL_SECONDS = 0.7;
const CLICK_SECONDS = 0.45;

function cursorStops(events: RecordingTimeline["events"]): CursorStop[] {
  return events
    .flatMap((event) =>
      event.region
        ? [
            {
              x: event.region.x + event.region.width / 2,
              y: event.region.y + event.region.height / 2,
              at: event.startSeconds,
              until: event.endSeconds,
              isClick: event.action === "click",
            },
          ]
        : [],
    )
    .sort((a, b) => a.at - b.at);
}

/**
 * Where a drawn cursor sits at `seconds`: it rests on each event's element and glides to
 * the next one so that it arrives exactly when that event starts. Events without an
 * element are skipped. Returns null when no event has a position.
 */
export function cursorAt(
  events: RecordingTimeline["events"],
  seconds: number,
  ease: (t: number) => number = (t) => t,
): CursorState | null {
  const stops = cursorStops(events);
  const first = stops[0];
  if (!first) return null;

  let x = first.x;
  let y = first.y;
  let click: number | null = null;
  stops.forEach((stop, i) => {
    const previous = stops[i - 1];
    if (previous) {
      const departure = Math.max(previous.at, stop.at - TRAVEL_SECONDS);
      const span = stop.at - departure;
      const t =
        span <= 0 ? (seconds >= stop.at ? 1 : 0) : clamp((seconds - departure) / span, 0, 1);
      if (t > 0) {
        const eased = ease(t);
        x = previous.x + (stop.x - previous.x) * eased;
        y = previous.y + (stop.y - previous.y) * eased;
      }
    }
    if (stop.isClick && seconds >= stop.at && seconds < stop.at + CLICK_SECONDS) {
      click = (seconds - stop.at) / CLICK_SECONDS;
    }
  });
  return { x, y, click };
}

/** The frame a recording is held on once it has run out, so the scene never shows black. */
export function holdFrame(recordingSeconds: number, fps: number): number {
  return Math.max(0, Math.floor(recordingSeconds * fps) - 1);
}
