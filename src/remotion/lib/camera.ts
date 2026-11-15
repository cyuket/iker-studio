import type { RecordingTimeline } from "../../domain/recording";
import type { Region } from "../../domain/storyboard";
import { easeCamera, easeMove } from "../design/motion";
import { MOTION } from "../design/tokens";
import type { Point } from "./geometry";
import type { ZoomState } from "./recording";

/**
 * The virtual camera over product footage. Recordings are captured once, full frame; every
 * push-in, hold and pull-back is decided here and applied in composition. Everything in
 * this module is pure: a path is a list of keyframes, and a frame is a sample of that path.
 */

export interface CameraKeyframe {
  /** Second at which the camera has arrived at this framing. */
  atSeconds: number;
  /** How long the move to this framing takes. 0 for the opening framing. */
  moveSeconds: number;
  /** 1 shows the whole frame. */
  zoom: number;
  /** Centre of the view, in viewport fractions. */
  centre: Point;
  /** What the framing is about; null for the full frame. */
  focus: Region | null;
  /**
   * Zoom the move passes through half way, when it travels far while zoomed in: the camera
   * eases out to show where it is going instead of sliding sideways across the interface.
   */
  dipZoom: number | null;
}

export interface CameraOptions {
  maxZoom: number;
  /**
   * Tight framing, for a view that exists to magnify (the portrait detail panel): less
   * breathing room, and even a modest enlargement counts as worth making.
   */
  tight?: boolean;
}

/** Breathing room and the smallest zoom worth making, for a normal or a tight framing. */
function framingRules(tight: boolean | undefined): { padding: number; minZoom: number } {
  return tight
    ? { padding: MOTION.camera.padding / 4, minZoom: MOTION.scale.detailMin }
    : { padding: MOTION.camera.padding, minZoom: MOTION.scale.cameraMin };
}

export interface CameraViewport {
  /** Width over height of the recorded viewport. */
  aspect: number;
  /** Width the footage is drawn at, in output pixels. */
  displayWidth?: number;
  /** Width of the recording's own pixels. */
  sourceWidth?: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Actions that point at something worth looking at. */
const FOCUS_ACTIONS = new Set(["click", "type", "select", "highlight", "verify"]);
/** Actions after which the whole screen is new. */
const RESET_ACTIONS = new Set(["navigate"]);

function unionRegions(a: Region, b: Region): Region {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

/**
 * The ceiling on zoom for a recording drawn at a given size: the storyboard's own limit, and
 * the point past which recorded pixels would be stretched into mush.
 */
export function zoomCeiling(options: CameraOptions, viewport: CameraViewport): number {
  const sharp =
    viewport.displayWidth && viewport.sourceWidth
      ? (viewport.sourceWidth * MOTION.scale.upscaleLimit) / viewport.displayWidth
      : Number.POSITIVE_INFINITY;
  return Math.max(1, Math.min(options.maxZoom, sharp));
}

/**
 * The tightest framing that shows a region whole, with breathing room around it. The view
 * never leaves the recording, and the region is never cropped: when it sits near an edge
 * the view stops at that edge rather than centring on it.
 */
export function frameRegion(
  region: Region,
  maxZoom: number,
  padding: number = MOTION.camera.padding,
): { zoom: number; centre: Point } {
  const pad = 1 + padding * 2;
  const zoom = clamp(Math.min(1 / (region.width * pad), 1 / (region.height * pad)), 1, maxZoom);
  const half = 0.5 / zoom;
  return {
    zoom,
    centre: {
      x: clamp(region.x + region.width / 2, half, 1 - half),
      y: clamp(region.y + region.height / 2, half, 1 - half),
    },
  };
}

/** The part of the recording a framing shows, in viewport fractions. */
export function viewOf(zoom: number, centre: Point): Region {
  const size = 1 / zoom;
  return {
    x: clamp(centre.x - size / 2, 0, 1 - size),
    y: clamp(centre.y - size / 2, 0, 1 - size),
    width: size,
    height: size,
  };
}

/** The transform that puts a framing on screen. */
export function zoomStateOf(zoom: number, centre: Point): ZoomState {
  const view = viewOf(zoom, centre);
  return { scale: zoom, translateX: -view.x * zoom, translateY: -view.y * zoom };
}

interface Shot {
  startSeconds: number;
  endSeconds: number;
  /** null is the full frame. */
  region: Region | null;
}

const WIDE: Pick<CameraKeyframe, "zoom" | "centre" | "focus"> = {
  zoom: 1,
  centre: { x: 0.5, y: 0.5 },
  focus: null,
};

function framingOf(
  region: Region | null,
  ceiling: number,
  tight: boolean | undefined,
): Pick<CameraKeyframe, "zoom" | "centre" | "focus"> {
  if (!region) return WIDE;
  const rules = framingRules(tight);
  const framing = frameRegion(region, ceiling, rules.padding);
  // A push-in that barely moves is noise: show the whole frame instead.
  if (framing.zoom < rules.minZoom) return WIDE;
  return { ...framing, focus: region };
}

function sameFraming(
  a: Pick<CameraKeyframe, "zoom" | "centre">,
  b: Pick<CameraKeyframe, "zoom" | "centre">,
): boolean {
  return (
    Math.hypot(a.centre.x - b.centre.x, a.centre.y - b.centre.y) <= MOTION.camera.mergeDistance &&
    Math.abs(a.zoom - b.zoom) / Math.max(a.zoom, b.zoom) <= 0.1
  );
}

/** Groups the timeline's actions into shots: runs of actions one framing can hold. */
function shotsOf(timeline: RecordingTimeline, ceiling: number, tight?: boolean): Shot[] {
  const { padding } = framingRules(tight);
  const events = [...timeline.events].sort((a, b) => a.startSeconds - b.startSeconds);
  const shots: Shot[] = [];
  /** Whether the last shot can still take more actions. */
  let open = false;
  for (const event of events) {
    if (RESET_ACTIONS.has(event.action)) {
      open = false;
      if (event.startSeconds > 0) {
        shots.push({
          startSeconds: event.startSeconds,
          endSeconds: event.endSeconds,
          region: null,
        });
      }
      continue;
    }
    if (!FOCUS_ACTIONS.has(event.action) || !event.region) continue;
    const region = event.region;
    const last = shots.at(-1);
    if (open && last?.region) {
      const together = unionRegions(last.region, region);
      // Keep one framing while it can still show every action at a useful size.
      if (frameRegion(together, ceiling, padding).zoom >= MOTION.camera.groupMinZoom) {
        shots[shots.length - 1] = {
          ...last,
          endSeconds: Math.max(last.endSeconds, event.endSeconds),
          region: together,
        };
        continue;
      }
    }
    shots.push({ startSeconds: event.startSeconds, endSeconds: event.endSeconds, region });
    open = true;
  }
  return shots;
}

/**
 * Turns framings and the moments they are needed into keyframes that obey the camera rules:
 * arrive just before the action, hold, never move faster than the minimum, never jitter
 * between near-identical framings, and ease out and back in when the next subject is far.
 */
function keyframesOf(
  shots: readonly Shot[],
  ceiling: number,
  leadSeconds: number,
  tight?: boolean,
): CameraKeyframe[] {
  const { camera, cameraMin } = MOTION.duration;
  const keyframes: CameraKeyframe[] = [{ atSeconds: 0, moveSeconds: 0, ...WIDE, dipZoom: null }];
  /** Until when the previous framing is still needed. */
  let busyUntil = 0;
  for (const shot of shots) {
    const previous = keyframes.at(-1);
    if (!previous) break;
    const framing = framingOf(shot.region, ceiling, tight);
    if (sameFraming(previous, framing)) {
      busyUntil = Math.max(busyUntil, shot.endSeconds);
      continue;
    }
    const wanted = Math.max(0, shot.startSeconds - leadSeconds);
    const earliestStart = Math.max(previous.atSeconds, busyUntil);
    let arrive = Math.max(wanted, earliestStart + cameraMin);
    if (arrive > shot.startSeconds) {
      // No room for a move after the previous hold. Leave the previous framing early, and
      // if even that is not enough, one framing has to serve both.
      arrive = shot.startSeconds;
      if (arrive - previous.atSeconds < cameraMin) {
        if (previous.moveSeconds === 0) {
          // The recording opens on this action: start there instead of moving at once.
          keyframes[keyframes.length - 1] = { ...previous, ...framing };
        } else if (previous.focus && shot.region) {
          const together = unionRegions(previous.focus, shot.region);
          keyframes[keyframes.length - 1] = { ...previous, ...framingOf(together, ceiling, tight) };
        } else {
          keyframes[keyframes.length - 1] = { ...previous, ...WIDE };
        }
        busyUntil = Math.max(busyUntil, shot.endSeconds);
        continue;
      }
    }
    const moveSeconds = clamp(arrive - earliestStart, cameraMin, camera);
    const far =
      previous.zoom > 1 &&
      framing.zoom > 1 &&
      Math.hypot(previous.centre.x - framing.centre.x, previous.centre.y - framing.centre.y) >
        MOTION.camera.farDistance;
    const room = arrive - earliestStart;
    if (far && room >= camera * 2 + MOTION.camera.holdSeconds) {
      // Time for a proper pull-back: show the whole screen, then go in again.
      keyframes.push({
        atSeconds: earliestStart + camera,
        moveSeconds: camera,
        ...WIDE,
        dipZoom: null,
      });
      keyframes.push({ atSeconds: arrive, moveSeconds: camera, ...framing, dipZoom: null });
    } else {
      keyframes.push({
        atSeconds: arrive,
        moveSeconds,
        ...framing,
        dipZoom: far ? Math.max(1, Math.min(previous.zoom, framing.zoom) * 0.72) : null,
      });
    }
    busyUntil = Math.max(arrive + MOTION.camera.holdSeconds, shot.endSeconds);
  }
  return keyframes;
}

/**
 * `follow` mode: the camera path for a recording, derived from what the recording did.
 * Times are seconds of the recording.
 */
export function cameraPath(
  timeline: RecordingTimeline,
  options: CameraOptions,
  viewport: CameraViewport,
): CameraKeyframe[] {
  const ceiling = zoomCeiling(options, viewport);
  return keyframesOf(
    shotsOf(timeline, ceiling, options.tight),
    ceiling,
    MOTION.camera.leadSeconds,
    options.tight,
  );
}

export interface ManualCameraStop {
  /** Second at which the camera should have arrived. */
  atSeconds: number;
  /** null returns to the full frame. */
  region: Region | null;
  /** Overrides the zoom the region would get by itself; still capped by the ceiling. */
  zoom?: number | undefined;
}

/** `manual` mode: the storyboard's own stops, made to obey the same rules as `follow`. */
export function manualCameraPath(
  stops: readonly ManualCameraStop[],
  options: CameraOptions,
  viewport: CameraViewport,
): CameraKeyframe[] {
  const ceiling = zoomCeiling(options, viewport);
  const { camera, cameraMin } = MOTION.duration;
  const keyframes: CameraKeyframe[] = [{ atSeconds: 0, moveSeconds: 0, ...WIDE, dipZoom: null }];
  for (const stop of [...stops].sort((a, b) => a.atSeconds - b.atSeconds)) {
    const previous = keyframes.at(-1);
    if (!previous) break;
    let framing = framingOf(stop.region, ceiling, options.tight);
    if (stop.region && stop.zoom !== undefined) {
      const zoom = clamp(stop.zoom, 1, Math.min(ceiling, frameRegion(stop.region, ceiling).zoom));
      const half = 0.5 / zoom;
      framing = {
        zoom,
        centre: {
          x: clamp(stop.region.x + stop.region.width / 2, half, 1 - half),
          y: clamp(stop.region.y + stop.region.height / 2, half, 1 - half),
        },
        focus: stop.region,
      };
    }
    const room = stop.atSeconds - previous.atSeconds;
    if (room < cameraMin) {
      // Too soon after the last stop to move again: this stop replaces it.
      keyframes[keyframes.length - 1] = { ...previous, ...framing };
      continue;
    }
    if (sameFraming(previous, framing)) continue;
    keyframes.push({
      atSeconds: stop.atSeconds,
      moveSeconds: clamp(room, cameraMin, camera),
      ...framing,
      dipZoom: null,
    });
  }
  return keyframes;
}

export interface CameraSample {
  zoom: number;
  centre: Point;
  state: ZoomState;
  /** The part of the recording on screen. */
  view: Region;
}

/** The camera at a moment: where it is between the framing it left and the one it is moving to. */
export function cameraAt(
  keyframes: readonly CameraKeyframe[],
  seconds: number,
  ease: (t: number) => number = easeCamera,
): CameraSample {
  let from = keyframes[0] ?? { atSeconds: 0, moveSeconds: 0, ...WIDE, dipZoom: null };
  let zoom = from.zoom;
  let centre = from.centre;
  for (const to of keyframes.slice(1)) {
    const start = to.atSeconds - to.moveSeconds;
    if (seconds <= start) break;
    const t = to.moveSeconds <= 0 ? 1 : clamp((seconds - start) / to.moveSeconds, 0, 1);
    const p = ease(t);
    // Zoom is interpolated geometrically so the move looks as fast at the end as at the start.
    zoom = Math.exp(Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * p);
    if (to.dipZoom !== null) {
      const dip = Math.sin(Math.PI * p);
      zoom = Math.max(1, zoom + (Math.min(zoom, to.dipZoom) - zoom) * dip);
    }
    centre = {
      x: from.centre.x + (to.centre.x - from.centre.x) * p,
      y: from.centre.y + (to.centre.y - from.centre.y) * p,
    };
    from = to;
    if (t < 1) break;
  }
  const view = viewOf(zoom, centre);
  return { zoom, centre, state: zoomStateOf(zoom, centre), view };
}

export interface FocusSpan {
  fromSeconds: number;
  toSeconds: number;
  region: Region;
}

/** When each element the recording acted on is the subject, for isolating it. */
export function focusSpans(timeline: RecordingTimeline): FocusSpan[] {
  return timeline.events
    .flatMap((event) =>
      FOCUS_ACTIONS.has(event.action) &&
      event.region &&
      // A subject is something the recording dwells on; dimming the screen for a passing
      // click would only flicker.
      event.endSeconds - event.startSeconds >= MOTION.camera.holdSeconds &&
      // Something that fills the screen is not a subject to isolate.
      event.region.width * event.region.height < 0.3
        ? [{ fromSeconds: event.startSeconds, toSeconds: event.endSeconds, region: event.region }]
        : [],
    )
    .sort((a, b) => a.fromSeconds - b.fromSeconds);
}

/**
 * The isolated region at a moment and how strongly it is isolated (0-1). Between two
 * subjects that follow each other the clear area glides from one to the next instead of
 * closing and reopening.
 */
export function focusAt(
  spans: readonly FocusSpan[],
  seconds: number,
): { region: Region; strength: number } | null {
  const { focus, release } = MOTION.duration;
  const index = spans.findLastIndex((span) => span.fromSeconds <= seconds);
  const current = spans[index];
  if (!current) return null;
  const previous = spans[index - 1];
  const linked =
    previous !== undefined && current.fromSeconds - previous.toSeconds < focus + release;
  const arrive = clamp((seconds - current.fromSeconds) / focus, 0, 1);
  const next = spans[index + 1];
  const handsOver = next !== undefined && next.fromSeconds - current.toSeconds < focus + release;
  const leave = handsOver ? 1 : 1 - clamp((seconds - current.toSeconds) / release, 0, 1);
  if (linked) {
    if (leave <= 0) return null;
    const p = easeMove(arrive);
    return {
      region: {
        x: previous.region.x + (current.region.x - previous.region.x) * p,
        y: previous.region.y + (current.region.y - previous.region.y) * p,
        width: previous.region.width + (current.region.width - previous.region.width) * p,
        height: previous.region.height + (current.region.height - previous.region.height) * p,
      },
      strength: leave,
    };
  }
  const strength = Math.min(arrive, leave);
  return strength <= 0 ? null : { region: current.region, strength };
}
