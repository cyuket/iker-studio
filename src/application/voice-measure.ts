import path from "node:path";
import {
  clipFindings,
  edgeSilence,
  internalSilences,
  loudnessSpread,
  paceOf,
  summarisePauses,
  type ClipMeasurement,
  type LoudnessSpread,
} from "../domain/voice-audio";
import { enabledScenes } from "../domain/storyboard";
import { loadStoryboard } from "./context";
import { readWords, type NarrationDeps } from "./narration";
import type { AudioTools } from "./ports";
import { voiceReviewDir } from "./voice-direction";

export interface ClipReportRow {
  sceneId: string;
  file: string;
  measurement: ClipMeasurement;
  wordsPerMinute: number | null;
  pauseCount: number;
  longestPauseSeconds: number;
  /** Silent stretches inside the clip, measured on the audio itself. */
  acousticPauses: number;
  leadingSilenceSeconds: number;
  trailingSilenceSeconds: number;
  clipped: boolean;
  startMayClick: boolean;
  endMayClick: boolean;
}

export interface ClipReport {
  videoId: string;
  rows: ClipReportRow[];
  loudness: LoudnessSpread | null;
  /** Fastest minus slowest scene, in words per minute. */
  paceSpread: number | null;
  files: { markdown: string; json: string };
}

const fixed = (value: number | null, digits: number): string =>
  value === null ? "n/a" : value.toFixed(digits);

function markdown(report: ClipReport, toleranceLu: number): string {
  const lines = [
    `# Narration clips: ${report.videoId}`,
    "",
    "Measured per clip, before the final mix. These numbers describe level and timing. They do not describe how the narration sounds.",
    "",
    "| Scene | Duration | Words/min | Pauses | Longest | LUFS | dBTP | LRA | Lead | Trail | Flags |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...report.rows.map((row) => {
      const flags = [
        row.clipped ? "clipped" : "",
        row.startMayClick ? "loud start edge" : "",
        row.endMayClick ? "loud end edge" : "",
      ].filter(Boolean);
      return `| ${row.sceneId} | ${row.measurement.durationSeconds.toFixed(2)}s | ${fixed(row.wordsPerMinute, 0)} | ${row.pauseCount} | ${row.longestPauseSeconds.toFixed(2)}s | ${fixed(row.measurement.integratedLufs, 1)} | ${fixed(row.measurement.truePeakDbtp, 1)} | ${fixed(row.measurement.loudnessRange, 1)} | ${row.leadingSilenceSeconds.toFixed(2)}s | ${row.trailingSilenceSeconds.toFixed(2)}s | ${flags.join(", ") || "none"} |`;
    }),
    "",
  ];
  if (report.loudness) {
    lines.push(
      `Loudness runs from ${report.loudness.minLufs.toFixed(1)} to ${report.loudness.maxLufs.toFixed(1)} LUFS, a spread of ${report.loudness.spreadLu.toFixed(1)} LU.`,
      report.loudness.outliers.length
        ? `More than ${toleranceLu} LU from the median: ${report.loudness.outliers.join(", ")}.`
        : `Every clip is within ${toleranceLu} LU of the median.`,
      "",
    );
  }
  if (report.paceSpread !== null) {
    lines.push(
      `Pace differs by ${report.paceSpread.toFixed(0)} words per minute between the slowest and fastest scene.`,
      "",
    );
  }
  return lines.join("\n");
}

/**
 * Measures every narration clip of a video and writes a report. Read-only for the clips:
 * it exists so that loudness, clipping, edge clicks and pacing drift are seen, not assumed.
 */
export async function measureNarration(
  deps: NarrationDeps & { audio: AudioTools },
  videoId: string,
): Promise<ClipReport> {
  const manifest = await deps.manifests.load(videoId);
  const storyboard = await loadStoryboard(deps, videoId);
  const paths = deps.layout.video(videoId);
  const order = [...new Set(storyboard.cuts.flatMap((cut) => enabledScenes(cut).map((s) => s.id)))];
  const rows: ClipReportRow[] = [];
  for (const sceneId of order) {
    const asset = manifest.assets.narration[sceneId];
    if (!asset || !(await deps.files.exists(paths.absolute(asset.file)))) continue;
    const measurement = await deps.audio.measureClip(paths.absolute(asset.file));
    const words = await readWords(deps, videoId, asset);
    const pauses = summarisePauses(words);
    const edges = edgeSilence(measurement);
    rows.push({
      sceneId,
      file: asset.file,
      measurement,
      wordsPerMinute: paceOf(words)?.wordsPerMinute ?? null,
      pauseCount: pauses.count,
      longestPauseSeconds: pauses.longestSeconds,
      acousticPauses: internalSilences(measurement).length,
      leadingSilenceSeconds: edges.leadingSeconds,
      trailingSilenceSeconds: edges.trailingSeconds,
      ...clipFindings(measurement),
    });
  }
  const tolerance = manifest.voice.finishing.toleranceLu;
  const paces = rows.flatMap((row) => (row.wordsPerMinute === null ? [] : [row.wordsPerMinute]));
  const dir = voiceReviewDir(deps.layout, videoId);
  const report: ClipReport = {
    videoId,
    rows,
    loudness: loudnessSpread(
      rows.map((row) => ({ id: row.sceneId, integratedLufs: row.measurement.integratedLufs })),
      tolerance,
    ),
    paceSpread: paces.length ? Math.max(...paces) - Math.min(...paces) : null,
    files: { markdown: path.join(dir, "clips.md"), json: path.join(dir, "clips.json") },
  };
  await deps.files.writeText(report.files.markdown, markdown(report, tolerance));
  await deps.files.writeJson(report.files.json, report);
  return report;
}
