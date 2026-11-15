import type { ReactNode } from "react";
import { useCurrentFrame } from "remotion";
import type { ResolvedRecording } from "../../domain/render-props";
import type { ProductSceneVisual, Region } from "../../domain/storyboard";
import { Annotation } from "../components/Annotation";
import { CursorAnimation } from "../components/CursorAnimation";
import { RecordingMedia, resolveMediaSource } from "../components/RecordingMedia";
import { SpotlightOverlay } from "../components/SpotlightOverlay";
import type { Rect } from "../design/layout";
import { durationFrames } from "../design/motion";
import { useLayout, useSceneEnvironment, useTokens } from "../design/SceneContext";
import { MOTION } from "../design/tokens";
import type { BrowserFrameSize } from "../lib/product-layout";
import { clipRegion, mapRegion, NO_ZOOM } from "../lib/recording";
import { CameraRig } from "./CameraRig";
import { CinematicProductFrame } from "./CinematicProductFrame";
import { UIElementFocus } from "./UIElementFocus";
import type { ProductCamera } from "./useProductCamera";

export interface AnnotationWindow {
  /** Frame the callout appears on. */
  from: number;
  /** Frame it is gone by; null keeps it to the end of the scene. */
  to: number | null;
}

/** When a callout is on screen: its cues when it names them, its seconds otherwise. */
export function annotationWindow(
  annotation: ProductSceneVisual["annotations"][number],
  beats: Readonly<Record<string, number>>,
  fps: number,
): AnnotationWindow {
  const cueFrom = annotation.cue === undefined ? undefined : beats[annotation.cue];
  const cueTo = annotation.untilCue === undefined ? undefined : beats[annotation.untilCue];
  return {
    from: cueFrom ?? annotation.fromSeconds * fps,
    to: cueTo ?? (annotation.toSeconds === undefined ? null : annotation.toSeconds * fps),
  };
}

/** 0-1 presence of a callout on a frame, with token fades at both ends. */
export function annotationPresence(window: AnnotationWindow, frame: number, fps: number): number {
  const fadeIn = durationFrames("focus", fps);
  const fadeOut = durationFrames("release", fps);
  const arrive = Math.min(1, Math.max(0, (frame - window.from) / fadeIn));
  const leave = window.to === null ? 1 : Math.min(1, Math.max(0, (window.to - frame) / fadeOut));
  return Math.min(arrive, leave);
}

export interface SmartScreenRecordingProps {
  visual: ProductSceneVisual;
  recording: ResolvedRecording;
  size: BrowserFrameSize;
  camera: ProductCamera;
  /** False keeps the frame on the full view (portrait shows the camera's view in the detail). */
  applyCamera: boolean;
  /** A region to outline on the footage, for layouts that magnify it elsewhere. */
  outline: Region | null;
  /** Where a prelude has just landed, ringed briefly so the eye arrives with it. */
  landing: { region: Region; progress: number } | null;
}

/**
 * Real product footage, directed: the recording in its frame, seen through the virtual
 * camera, with the element in focus isolated and callouts registered to the footage as it
 * moves. Nothing is drawn that is not in the recording except rings and dimming.
 */
export function SmartScreenRecording({
  visual,
  recording,
  size,
  camera,
  applyCamera,
  outline,
  landing,
}: SmartScreenRecordingProps): ReactNode {
  const tokens = useTokens();
  const { u } = useLayout();
  const { fps, beats, reducedMotion } = useSceneEnvironment();
  const frame = useCurrentFrame();
  const bounds = { width: size.width, height: size.viewportHeight };
  const zoom = applyCamera ? camera.zoom : NO_ZOOM;
  const source = resolveMediaSource(recording, visual.mode);
  // A recorded video carries the recorder's own cursor; drawing a second one would double it.
  const drawCursor = visual.showCursor && source?.kind === "image" && visual.mode === "screenshot";
  const directed = visual.camera !== undefined;

  const toPixels = (region: Region): Rect | null => {
    const visible = clipRegion(mapRegion(region, zoom));
    if (!visible) return null;
    return {
      x: visible.x * bounds.width,
      y: visible.y * bounds.height,
      width: visible.width * bounds.width,
      height: visible.height * bounds.height,
    };
  };
  const callouts = visual.annotations.flatMap((annotation, index) => {
    const presence = annotationPresence(annotationWindow(annotation, beats, fps), frame, fps);
    return presence > 0 ? [{ annotation, index, presence }] : [];
  });
  const outlineRect = outline ? toPixels(outline) : null;

  return (
    <CinematicProductFrame size={size} displayUrl={recording.displayUrl}>
      <CameraRig zoom={zoom}>
        <RecordingMedia
          recording={recording}
          mode={visual.mode}
          atSeconds={camera.recordingSeconds}
        />
      </CameraRig>
      {/* Dimming the small overview frame of a portrait layout would only hide the map. */}
      {camera.isolate && applyCamera ? (
        <UIElementFocus
          region={camera.isolate.region}
          zoom={zoom}
          bounds={bounds}
          progress={camera.isolate.strength}
          isolate
          ring={false}
        />
      ) : null}
      {outlineRect ? (
        <div
          style={{
            position: "absolute",
            left: outlineRect.x,
            top: outlineRect.y,
            width: outlineRect.width,
            height: outlineRect.height,
            boxSizing: "border-box",
            borderRadius: tokens.radii.sm,
            border: `${tokens.stroke.regular}px solid ${tokens.colours.accent}`,
          }}
        />
      ) : null}
      {directed
        ? callouts.map(({ annotation, index, presence }) => (
            <UIElementFocus
              key={`focus-${index}`}
              region={annotation.region}
              zoom={zoom}
              bounds={bounds}
              progress={presence}
              isolate={annotation.spotlight}
            />
          ))
        : callouts.map(({ annotation, index, presence }) => {
            const target = toPixels(annotation.region);
            if (!target) return null;
            return (
              <div key={`note-${index}`}>
                {annotation.spotlight ? (
                  <SpotlightOverlay target={target} opacity={presence} padding={u(6)} />
                ) : null}
                <Annotation
                  text={annotation.text}
                  target={target}
                  bounds={bounds}
                  opacity={presence}
                  rise={reducedMotion ? 0 : (1 - presence) * u(MOTION.distance.nudge)}
                />
              </div>
            );
          })}
      {landing ? (
        <UIElementFocus
          region={landing.region}
          zoom={zoom}
          bounds={bounds}
          progress={landing.progress}
        />
      ) : null}
      {drawCursor ? (
        <CursorAnimation
          events={recording.timeline.events}
          bounds={bounds}
          zoom={zoom}
          opacity={1}
        />
      ) : null}
    </CinematicProductFrame>
  );
}
