import type { Brand } from "./brand";
import type { CaptionCue } from "./captions";
import type { FormatSpec } from "./formats";
import type { RecordingTimeline } from "./recording";
import type { Scene } from "./storyboard";

/**
 * The contract between the Node pipeline and the Remotion project. Everything a frame
 * depends on arrives through these props as plain JSON, already resolved to URLs, so a
 * render is a pure function of its props and can be cached by their hash.
 */

export interface ResolvedBrand extends Brand {
  /** Logo files resolved to URLs the renderer can load; null falls back to text. */
  logoSrc: { mark: string | null; wordmark: string | null };
}

export interface ResolvedRecording {
  /** MP4 of the recorded flow; null when the scene shows a still. */
  videoSrc: string | null;
  /** PNG still; used for screenshot scenes and as the hold frame. */
  screenshotSrc: string | null;
  durationSeconds: number;
  timeline: RecordingTimeline;
  /** Address shown in the browser frame. Never contains credentials or query strings. */
  displayUrl: string;
}

export interface SceneRenderProps {
  brand: ResolvedBrand;
  format: FormatSpec;
  scene: Scene;
  durationFrames: number;
  narration: { src: string; offsetFrames: number; volume: number } | null;
  /**
   * When each of the scene's cues fires, in seconds from the start of the scene, resolved
   * from the narration's word timings. Motion graphics key their animation to these.
   */
  beats: Record<string, number>;
  /** Cues timed from the start of the scene; null when captions are not burned in. */
  captions: CaptionCue[] | null;
  recording: ResolvedRecording | null;
  /** Position of this scene within its cut, as fractions of total duration. */
  progress: { start: number; end: number } | null;
  /**
   * Set when the cut has an animated background: the frame of the cut this scene starts on,
   * so the canvas carries on where the previous scene left it. null keeps the still canvas.
   */
  backdrop: { startFrame: number } | null;
  reducedMotion: boolean;
  /**
   * Text stamped on every frame of the scene, used to mark synthetic demo footage so it
   * can never be mistaken for the real product. null for scenes that need no label.
   */
  disclosure: string | null;
}

export interface CutRenderProps {
  scenes: SceneRenderProps[];
}

export const THUMBNAIL_VARIANTS = ["statement", "split", "product"] as const;
export type ThumbnailVariant = (typeof THUMBNAIL_VARIANTS)[number];

export interface ThumbnailRenderProps {
  brand: ResolvedBrand;
  variant: ThumbnailVariant;
  /** Short line, at most about five words, that must read at 160px wide. */
  headline: string;
  /** Screenshot used by the `product` variant; null renders an abstract panel instead. */
  screenshotSrc: string | null;
  /** Address shown above the screenshot: the host it was actually captured from. */
  displayUrl: string | null;
  disclosure: string | null;
}

export const COMPOSITION_IDS = { scene: "Scene", cut: "Cut", thumbnail: "Thumbnail" } as const;
export const THUMBNAIL_SIZE = { width: 1280, height: 720 } as const;
