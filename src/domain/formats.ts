import { z } from "zod";

export const FORMAT_IDS = [
  "youtube-landscape",
  "youtube-shorts",
  "social-landscape",
  "social-portrait",
] as const;
export const FormatIdSchema = z.enum(FORMAT_IDS);
export type FormatId = z.infer<typeof FormatIdSchema>;

export type Orientation = "landscape" | "portrait";

export interface SafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface FormatSpec {
  id: FormatId;
  label: string;
  width: number;
  height: number;
  fps: number;
  orientation: Orientation;
  /** Pixels at full resolution that must stay free of text and key UI. */
  safeArea: SafeArea;
  captions: { maxCharsPerLine: number; maxLines: number; burnInByDefault: boolean };
  /** Platform limit; exceeding it is a QA failure. */
  maxDurationSeconds: number | null;
}

// Portrait safe areas keep clear of the platform chrome drawn over Shorts/Reels-style
// players: title and channel row at the bottom, action buttons on the right.
const PORTRAIT_SAFE_AREA: SafeArea = { top: 220, right: 150, bottom: 420, left: 64 };
const LANDSCAPE_SAFE_AREA: SafeArea = { top: 64, right: 96, bottom: 64, left: 96 };

export const FORMATS: Record<FormatId, FormatSpec> = {
  "youtube-landscape": {
    id: "youtube-landscape",
    label: "YouTube 16:9",
    width: 1920,
    height: 1080,
    fps: 30,
    orientation: "landscape",
    safeArea: LANDSCAPE_SAFE_AREA,
    captions: { maxCharsPerLine: 42, maxLines: 2, burnInByDefault: false },
    maxDurationSeconds: null,
  },
  "youtube-shorts": {
    id: "youtube-shorts",
    label: "YouTube Shorts 9:16",
    width: 1080,
    height: 1920,
    fps: 30,
    orientation: "portrait",
    safeArea: PORTRAIT_SAFE_AREA,
    captions: { maxCharsPerLine: 24, maxLines: 2, burnInByDefault: true },
    maxDurationSeconds: 180,
  },
  "social-landscape": {
    id: "social-landscape",
    label: "LinkedIn / X 16:9",
    width: 1920,
    height: 1080,
    fps: 30,
    orientation: "landscape",
    safeArea: LANDSCAPE_SAFE_AREA,
    captions: { maxCharsPerLine: 42, maxLines: 2, burnInByDefault: true },
    maxDurationSeconds: 140,
  },
  "social-portrait": {
    id: "social-portrait",
    label: "LinkedIn / X 9:16",
    width: 1080,
    height: 1920,
    fps: 30,
    orientation: "portrait",
    safeArea: PORTRAIT_SAFE_AREA,
    captions: { maxCharsPerLine: 24, maxLines: 2, burnInByDefault: true },
    maxDurationSeconds: 140,
  },
};

export const QUALITY_IDS = ["preview", "final"] as const;
export const QualityIdSchema = z.enum(QUALITY_IDS);
export type QualityId = z.infer<typeof QualityIdSchema>;

export interface QualitySpec {
  id: QualityId;
  /** Output scale relative to the format's full resolution. */
  scale: number;
  /** H.264 constant rate factor; lower is higher quality. */
  crf: number;
  jpegQuality: number;
  audioBitrateKbps: number;
}

export const QUALITIES: Record<QualityId, QualitySpec> = {
  preview: { id: "preview", scale: 0.5, crf: 28, jpegQuality: 70, audioBitrateKbps: 128 },
  final: { id: "final", scale: 1, crf: 18, jpegQuality: 92, audioBitrateKbps: 192 },
};

export interface RenderDimensions {
  width: number;
  height: number;
  fps: number;
}

/** Output pixel size for a format at a quality, kept even because H.264 requires it. */
export function outputDimensions(format: FormatSpec, quality: QualitySpec): RenderDimensions {
  const even = (n: number): number => Math.round((n * quality.scale) / 2) * 2;
  return { width: even(format.width), height: even(format.height), fps: format.fps };
}

/** EBU R128 targets used for every export so narration level is consistent across videos. */
export const LOUDNESS_TARGET = { integratedLufs: -14, truePeakDbtp: -1.5, loudnessRange: 11 };
