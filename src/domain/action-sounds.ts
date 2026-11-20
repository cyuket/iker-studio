import { footageAnchors, footageLength, type FootageAnchor } from "./cues";
import type { RecordingTimeline } from "./recording";
import type { ProductSceneVisual } from "./storyboard";

/**
 * Sounds that recorded actions make, so every click, key and swipe in product footage is
 * heard. Files are in assets/sfx. Typing is cut to the length of the typing, so a long clip
 * serves any amount of text.
 */
export const ACTION_SOUNDS = {
  click: { file: "click.wav", volume: 0.5 },
  select: { file: "click.wav", volume: 0.5 },
  dismiss: { file: "click-soft.wav", volume: 0.45 },
  press: { file: "click-soft.wav", volume: 0.45 },
  drag: { file: "click-soft.wav", volume: 0.45 },
  scroll: { file: "mixkit-swipe-fast-small-sweep.mp3", volume: 0.25 },
  typeDesktop: { file: "mixkit-keyboard-typing.mp3", volume: 0.35 },
  typePhone: { file: "mixkit-typing-text-smartphone.mp3", volume: 0.35 },
} as const;

/** Every file action sounds may play, for checks that the library is complete. */
export const ACTION_SOUND_FILES: readonly string[] = [
  ...new Set(Object.values(ACTION_SOUNDS).map((sound) => sound.file)),
];

/** Viewports narrower than this are phones: their typing sounds like a phone keyboard. */
const PHONE_MAX_WIDTH = 700;
/** Before the recorder logged the moment of a press, it came this long after the step began. */
const LEGACY_PRESS_DELAY_SECONDS = 0.65;
/** Before typing was logged, it began this long after the press. */
const LEGACY_KEYS_DELAY_SECONDS = 0.35;
/** Shorter typing is still heard as a few keys. */
const MIN_TYPING_SECONDS = 0.25;

export interface PlannedActionSound {
  file: string;
  volume: number;
  /** Seconds from the start of the scene. */
  atSeconds: number;
  /** How long the sound may play; absent plays the whole file. */
  durationSeconds?: number;
}

/**
 * The scene second showing a given second of the recording: the inverse of the footage time
 * map. Null for a moment the scene never plays (before the footage starts, or cut off).
 */
export function sceneSecondsFor(
  anchors: readonly FootageAnchor[] | null,
  recordingSeconds: number,
): number | null {
  if (!anchors || anchors.length === 0) return recordingSeconds;
  const first = anchors[0];
  const last = anchors.at(-1);
  if (!first || !last || recordingSeconds < first.recordingSeconds) return null;
  for (let i = 1; i < anchors.length; i += 1) {
    const from = anchors[i - 1];
    const to = anchors[i];
    if (!from || !to || recordingSeconds > to.recordingSeconds) continue;
    const t =
      (recordingSeconds - from.recordingSeconds) / (to.recordingSeconds - from.recordingSeconds);
    return from.sceneSeconds + (to.sceneSeconds - from.sceneSeconds) * t;
  }
  return last.sceneSeconds + (recordingSeconds - last.recordingSeconds);
}

/**
 * The sounds of a product scene's recorded actions, placed on the scene's own clock: a click
 * where the pointer presses, typing for as long as keys go down, a sweep for a scroll.
 * Screenshot scenes play no footage and so make no action sounds.
 */
export function planActionSounds(
  visual: ProductSceneVisual,
  timeline: RecordingTimeline,
  beats: Readonly<Record<string, number>>,
  sceneSeconds: number,
): PlannedActionSound[] {
  if (visual.mode !== "video") return [];
  const timed = visual.footage !== undefined || visual.prelude !== undefined;
  const anchors = timed ? footageAnchors(visual, beats) : null;
  const length = footageLength(visual, timeline.durationSeconds);
  const phone = timeline.viewport.width < PHONE_MAX_WIDTH;
  const planned: PlannedActionSound[] = [];

  const place = (
    sound: { file: string; volume: number },
    recordingSeconds: number,
    durationSeconds?: number,
  ): void => {
    if (recordingSeconds > length) return;
    const at = sceneSecondsFor(anchors, recordingSeconds);
    if (at === null || at < 0 || at >= sceneSeconds) return;
    planned.push({
      file: sound.file,
      volume: sound.volume,
      atSeconds: at,
      ...(durationSeconds === undefined
        ? {}
        : { durationSeconds: Math.min(durationSeconds, sceneSeconds - at) }),
    });
  };

  for (const event of timeline.events) {
    const press = event.pressSeconds ?? event.startSeconds + LEGACY_PRESS_DELAY_SECONDS;
    switch (event.action) {
      case "click":
      case "select":
      case "drag":
      case "dismiss":
        place(ACTION_SOUNDS[event.action], Math.min(press, event.endSeconds));
        break;
      case "press":
        place(ACTION_SOUNDS.press, event.pressSeconds ?? event.startSeconds);
        break;
      case "scroll":
        place(ACTION_SOUNDS.scroll, event.startSeconds);
        break;
      case "type": {
        place(ACTION_SOUNDS.click, Math.min(press, event.endSeconds));
        const keys = event.keysFromSeconds ?? press + LEGACY_KEYS_DELAY_SECONDS;
        const from = Math.min(keys, event.endSeconds);
        // The typing is heard for as long as it lasts on screen, however the footage is timed.
        const start = sceneSecondsFor(anchors, from);
        const end = sceneSecondsFor(anchors, Math.min(event.endSeconds, length));
        const duration =
          start === null || end === null ? 0 : Math.max(MIN_TYPING_SECONDS, end - start);
        place(phone ? ACTION_SOUNDS.typePhone : ACTION_SOUNDS.typeDesktop, from, duration);
        break;
      }
      default:
        break;
    }
  }
  return planned.sort((a, b) => a.atSeconds - b.atSeconds);
}
