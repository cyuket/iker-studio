import type { ReactNode } from "react";
import { Freeze, Img, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import type { ResolvedRecording } from "../../domain/render-props";
import { holdFrame } from "../lib/recording";

export type RecordingMode = "video" | "screenshot";

/** What a product scene can actually show, given the assets that were resolved for it. */
export function resolveMediaSource(
  recording: ResolvedRecording | null,
  mode: RecordingMode,
): { kind: "video" | "image"; src: string } | null {
  if (!recording) return null;
  if (mode === "video" && recording.videoSrc) return { kind: "video", src: recording.videoSrc };
  if (recording.screenshotSrc) return { kind: "image", src: recording.screenshotSrc };
  if (recording.videoSrc) return { kind: "video", src: recording.videoSrc };
  return null;
}

export interface RecordingMediaProps {
  recording: ResolvedRecording;
  mode: RecordingMode;
  /**
   * Second of the recording to show. Lets a scene start the footage late, or stretch it
   * between cues. Without it the recording plays from the first frame of the scene.
   */
  atSeconds?: number | undefined;
}

/**
 * The captured pixels, filling their parent. Video plays from the first frame of the scene
 * and then holds its final frame for as long as the scene outlasts the recording.
 */
export function RecordingMedia({ recording, mode, atSeconds }: RecordingMediaProps): ReactNode {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const source = resolveMediaSource(recording, mode);
  if (!source) return null;
  const fill = { width: "100%", height: "100%", display: "block" } as const;
  if (source.kind === "image") return <Img src={source.src} style={fill} />;
  const hold = holdFrame(recording.durationSeconds, fps);
  if (atSeconds !== undefined) {
    // The scene decides which moment is on screen, so the video is always frozen on it.
    const at = Math.min(hold, Math.max(0, Math.round(atSeconds * fps)));
    return (
      // The moment is chosen by trimming, with time frozen at zero: a frozen frame beyond the
      // scene's own length is clamped by the renderer, which would stall footage that is
      // played faster than real time.
      <Freeze frame={0} active>
        <OffthreadVideo src={source.src} muted style={fill} trimBefore={at} />
      </Freeze>
    );
  }
  return (
    <Freeze frame={hold} active={frame >= hold}>
      <OffthreadVideo src={source.src} muted style={fill} />
    </Freeze>
  );
}
