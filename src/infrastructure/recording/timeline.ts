import type { RecordingTimeline, Scenario, Step } from "../../domain/recording";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Viewport = Scenario["viewport"];
type TimelineEvent = RecordingTimeline["events"][number];

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const round = (value: number, places: number): number => Number(value.toFixed(places));

/**
 * Converts pixel bounds to viewport fractions, clipped to the visible area so a consumer
 * can scale them straight onto the video frame. Null when nothing of the box is on screen.
 */
export function toRegion(box: Box, viewport: Viewport): Box | null {
  const left = clamp01(box.x / viewport.width);
  const top = clamp01(box.y / viewport.height);
  const right = clamp01((box.x + box.width) / viewport.width);
  const bottom = clamp01((box.y + box.height) / viewport.height);
  if (right <= left || bottom <= top) return null;
  return {
    x: round(left, 4),
    y: round(top, 4),
    width: round(right - left, 4),
    height: round(bottom - top, 4),
  };
}

/**
 * The caption a scene may show for a step. Typed text is deliberately never used: a
 * timeline is a shareable artefact and must not be able to carry something a person typed.
 */
export function stepLabel(step: Step): string | null {
  if (step.action === "highlight" && step.label !== undefined) return step.label;
  return step.note ?? null;
}

export interface TimelineRecorder {
  /** Marks the first captured frame; times before this are reported as zero. */
  startCapture(): void;
  stopCapture(): void;
  /** Marks a step as started. Call the returned function once when the step has finished. */
  begin(index: number, step: Step): (box: Box | null) => void;
  /** Marks the moment the running step's pointer pressed. Only the first press counts. */
  markPress(): void;
  /** Marks the moment the running step started typing. Only the first mark counts. */
  markKeys(): void;
  build(): RecordingTimeline;
}

export function createTimelineRecorder(
  scenario: Pick<Scenario, "id" | "target" | "viewport">,
  nowMs: () => number,
): TimelineRecorder {
  const events: TimelineEvent[] = [];
  let startedAtMs: number | null = null;
  let stoppedAtMs: number | null = null;
  let marks: { press?: number; keys?: number } = {};

  /** Steps that run before the capture starts all sit at zero: they are not in the video. */
  const seconds = (): number =>
    startedAtMs === null ? 0 : round(((stoppedAtMs ?? nowMs()) - startedAtMs) / 1000, 3);

  return {
    startCapture: () => {
      startedAtMs = nowMs();
    },
    stopCapture: () => {
      stoppedAtMs = nowMs();
    },
    begin: (index, step) => {
      const startSeconds = seconds();
      marks = {};
      return (box) => {
        events.push({
          index,
          action: step.action,
          startSeconds,
          endSeconds: seconds(),
          region: box ? toRegion(box, scenario.viewport) : null,
          label: stepLabel(step),
          ...(marks.press === undefined ? {} : { pressSeconds: marks.press }),
          ...(marks.keys === undefined ? {} : { keysFromSeconds: marks.keys }),
        });
        marks = {};
      };
    },
    markPress: () => {
      marks.press ??= seconds();
    },
    markKeys: () => {
      marks.keys ??= seconds();
    },
    build: () => ({
      schemaVersion: 1,
      scenarioId: scenario.id,
      target: scenario.target,
      viewport: { ...scenario.viewport },
      durationSeconds: seconds(),
      events: [...events],
    }),
  };
}
