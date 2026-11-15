import { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { footageAnchors, footageTimeAt } from "../../domain/cues";
import type { ResolvedRecording } from "../../domain/render-props";
import type { ProductSceneVisual, Region } from "../../domain/storyboard";
import { useZoom } from "../components/ZoomTransition";
import { easeCamera } from "../design/motion";
import { useSceneEnvironment } from "../design/SceneContext";
import {
  cameraAt,
  cameraPath,
  focusAt,
  focusSpans,
  manualCameraPath,
  type FocusSpan,
} from "../lib/camera";
import { NO_ZOOM, type ZoomState } from "../lib/recording";

export interface ProductCamera {
  /** The camera transform for this frame. */
  zoom: ZoomState;
  /** 1 shows the whole frame. */
  factor: number;
  /** The part of the recording the camera shows. */
  view: Region;
  /** The element to isolate and how strongly; null when nothing is isolated. */
  isolate: { region: Region; strength: number } | null;
  /** Second of the recording to show; undefined plays it from the scene's first frame. */
  recordingSeconds: number | undefined;
}

const FULL: Region = { x: 0, y: 0, width: 1, height: 1 };

/**
 * Everything time-dependent about a product scene's footage on the current frame: which
 * moment of the recording is showing, where the virtual camera is, and what is isolated.
 */
export function useProductCamera(
  visual: ProductSceneVisual,
  recording: ResolvedRecording | null,
  displayWidth: number,
  /** The camera's view feeds a magnifying panel rather than moving the frame itself. */
  tight = false,
): ProductCamera {
  const frame = useCurrentFrame();
  const { fps, beats, reducedMotion } = useSceneEnvironment();
  const legacyZoom = useZoom(visual.focus, visual.zoom);
  const sceneSeconds = frame / fps;

  const plan = useMemo(() => {
    const seconds: Record<string, number> = {};
    for (const [id, at] of Object.entries(beats)) seconds[id] = at / fps;
    const timed = visual.footage !== undefined || visual.prelude !== undefined;
    const anchors = timed ? footageAnchors(visual, seconds) : null;
    const camera = visual.camera;
    if (!camera || !recording || camera.mode === "static") {
      return { anchors, path: null, spans: [] as FocusSpan[], inRecordingTime: false };
    }
    const viewport = recording.timeline.viewport;
    const options = { maxZoom: camera.maxZoom, tight };
    const size = {
      aspect: viewport.width / Math.max(1, viewport.height),
      displayWidth,
      sourceWidth: viewport.width,
    };
    // A still shows one moment, so the recording's timeline cannot drive the camera over it.
    if (camera.mode === "follow" && visual.mode === "video") {
      return {
        anchors,
        path: cameraPath(recording.timeline, options, size),
        spans: camera.isolate ? focusSpans(recording.timeline) : [],
        inRecordingTime: true,
      };
    }
    const stops = camera.keyframes.flatMap((keyframe) => {
      const at = keyframe.cue === undefined ? keyframe.atSeconds : seconds[keyframe.cue];
      return at === undefined
        ? []
        : [{ atSeconds: at, region: keyframe.region, zoom: keyframe.zoom }];
    });
    const sorted = [...stops].sort((a, b) => a.atSeconds - b.atSeconds);
    const spans = sorted.flatMap((stop, i) =>
      stop.region
        ? [
            {
              fromSeconds: stop.atSeconds,
              toSeconds: sorted[i + 1]?.atSeconds ?? Number.POSITIVE_INFINITY,
              region: stop.region,
            },
          ]
        : [],
    );
    return {
      anchors,
      path: manualCameraPath(stops, options, size),
      spans: camera.isolate ? spans : [],
      inRecordingTime: false,
    };
  }, [visual, recording, beats, fps, displayWidth, tight]);

  const recordingSeconds =
    plan.anchors && recording
      ? footageTimeAt(plan.anchors, sceneSeconds, recording.durationSeconds)
      : undefined;
  if (!visual.camera) {
    const view: Region =
      legacyZoom.scale > 1
        ? {
            x: -legacyZoom.translateX / legacyZoom.scale,
            y: -legacyZoom.translateY / legacyZoom.scale,
            width: 1 / legacyZoom.scale,
            height: 1 / legacyZoom.scale,
          }
        : FULL;
    return { zoom: legacyZoom, factor: legacyZoom.scale, view, isolate: null, recordingSeconds };
  }
  if (!plan.path) {
    return { zoom: NO_ZOOM, factor: 1, view: FULL, isolate: null, recordingSeconds };
  }
  const clock = plan.inRecordingTime ? (recordingSeconds ?? sceneSeconds) : sceneSeconds;
  // Reduced motion keeps the framings but cuts between them instead of travelling.
  const sample = cameraAt(plan.path, clock, reducedMotion ? (t) => (t < 1 ? 0 : 1) : easeCamera);
  return {
    zoom: sample.state,
    factor: sample.zoom,
    view: sample.view,
    isolate: focusAt(plan.spans, clock),
    recordingSeconds,
  };
}
