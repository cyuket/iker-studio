import { SILENT_SCENE_SECONDS } from "./script";
import type { Scene } from "./storyboard";

export interface SceneTiming {
  sceneId: string;
  startFrame: number;
  durationFrames: number;
  /** Frame, relative to the scene, at which narration starts. */
  narrationOffsetFrames: number;
  narrationSeconds: number | null;
}

export interface CutTimeline {
  cutId: string;
  fps: number;
  totalFrames: number;
  totalSeconds: number;
  scenes: SceneTiming[];
}

export interface SceneMedia {
  /** Measured length of the scene's narration audio, when it has any. */
  narrationSeconds: number | null;
  /** Length of the scene's recording, so a demo is never cut off mid-action. */
  recordingSeconds: number | null;
}

export function sceneDurationFrames(scene: Scene, media: SceneMedia, fps: number): number {
  const { leadInSeconds, tailSeconds, minDurationSeconds } = scene.animation;
  const spoken = media.narrationSeconds ?? 0;
  const content = Math.max(spoken, media.recordingSeconds ?? 0);
  const natural = content > 0 ? leadInSeconds + content + tailSeconds : SILENT_SCENE_SECONDS;
  return Math.max(1, Math.ceil(Math.max(natural, minDurationSeconds) * fps));
}

export function buildCutTimeline(
  cutId: string,
  scenes: readonly Scene[],
  media: ReadonlyMap<string, SceneMedia>,
  fps: number,
): CutTimeline {
  const timings: SceneTiming[] = [];
  let cursor = 0;
  for (const scene of scenes) {
    const sceneMedia = media.get(scene.id) ?? { narrationSeconds: null, recordingSeconds: null };
    const durationFrames = sceneDurationFrames(scene, sceneMedia, fps);
    timings.push({
      sceneId: scene.id,
      startFrame: cursor,
      durationFrames,
      narrationOffsetFrames: Math.round(scene.animation.leadInSeconds * fps),
      narrationSeconds: sceneMedia.narrationSeconds,
    });
    cursor += durationFrames;
  }
  return { cutId, fps, totalFrames: cursor, totalSeconds: cursor / fps, scenes: timings };
}

export interface Chapter {
  title: string;
  startSeconds: number;
}

/** YouTube chapters: the first must start at 0:00 and each must last at least 10 seconds. */
export function buildChapters(timeline: CutTimeline, scenes: readonly Scene[]): Chapter[] {
  const chapters: Chapter[] = [];
  for (const timing of timeline.scenes) {
    const scene = scenes.find((s) => s.id === timing.sceneId);
    if (!scene?.chapterTitle) continue;
    const startSeconds = chapters.length === 0 ? 0 : timing.startFrame / timeline.fps;
    const previous = chapters.at(-1);
    if (previous && startSeconds - previous.startSeconds < 10) continue;
    chapters.push({ title: scene.chapterTitle, startSeconds });
  }
  return chapters.length >= 3 ? chapters : [];
}

export function formatChapterTime(seconds: number): string {
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
