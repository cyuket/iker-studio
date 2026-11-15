import { useMemo, type ReactNode } from "react";
import { AbsoluteFill, Html5Audio, Sequence, useCurrentFrame } from "remotion";
import { AnimatedCaption } from "../components/AnimatedCaption";
import { Background } from "../components/Background";
import { DisclosureLabel } from "../components/DisclosureLabel";
import { LowerThird } from "../components/LowerThird";
import { ProgressIndicator } from "../components/ProgressIndicator";
import type { SceneRenderProps } from "../../domain/render-props";
import {
  createEnvironment,
  SceneEnvironmentProvider,
  useSceneEnvironment,
} from "../design/SceneContext";
import { exitOpacity } from "../design/motion";
import { SceneRenderer } from "./SceneRenderer";

/**
 * The scene's own visual in its content zone, without overlays or sound. Two scenes whose
 * visual layers produce the same markup produce the same pixels, which is what continuity
 * across a hard cut is tested against.
 */
export function SceneVisualLayer(
  props: Pick<SceneRenderProps, "scene" | "brand" | "recording">,
): ReactNode {
  const { zones } = useSceneEnvironment();
  return (
    <div
      style={{
        position: "absolute",
        left: zones.content.x,
        top: zones.content.y,
        width: zones.content.width,
        height: zones.content.height,
      }}
    >
      <SceneRenderer visual={props.scene.visual} brand={props.brand} recording={props.recording} />
    </div>
  );
}

function SceneLayers(props: SceneRenderProps): ReactNode {
  const { zones, timing, exit } = useSceneEnvironment();
  const frame = useCurrentFrame();
  const { scene, captions, progress, disclosure, narration } = props;
  return (
    <AbsoluteFill>
      <Background />
      {/*
        Everything in this layer fades to the bare background before the scene's last frame,
        unless the scene holds its exit for the next one to continue from.
      */}
      <AbsoluteFill style={{ opacity: exitOpacity(frame, timing, exit) }}>
        <SceneVisualLayer scene={scene} brand={props.brand} recording={props.recording} />
        {scene.lowerThird && zones.lowerThird ? (
          <LowerThird
            title={scene.lowerThird.title}
            subtitle={scene.lowerThird.subtitle}
            zone={zones.lowerThird}
          />
        ) : null}
        {captions && zones.captions ? (
          <AnimatedCaption cues={captions} zone={zones.captions} />
        ) : null}
      </AbsoluteFill>
      {/* Persistent layers: outside the fade so they hold across the hard cut between scenes. */}
      {progress && zones.progress ? (
        <ProgressIndicator start={progress.start} end={progress.end} zone={zones.progress} />
      ) : null}
      {disclosure !== null && zones.disclosure ? (
        <DisclosureLabel text={disclosure} zone={zones.disclosure} />
      ) : null}
      {narration ? (
        <Sequence from={narration.offsetFrames} layout="none" name="Narration">
          <Html5Audio src={narration.src} volume={narration.volume} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
}

/** One storyboard scene: the visual, its overlays and its narration. */
export function SceneComposition(props: SceneRenderProps): ReactNode {
  const { brand, format, durationFrames, reducedMotion, scene, captions, progress, disclosure } =
    props;
  const hasCaptions = captions !== null && captions.length > 0;
  const hasLowerThird = scene.lowerThird !== undefined;
  const enter = scene.animation.enter;
  const exit = scene.animation.exit ?? "fade";
  const beats = props.beats;
  const environment = useMemo(
    () =>
      createEnvironment({
        brand,
        format,
        fps: format.fps,
        durationFrames,
        reducedMotion,
        enter,
        exit,
        beats,
        overlays: {
          disclosure: disclosure !== null,
          captions: hasCaptions,
          progress: progress !== null,
          lowerThird: hasLowerThird,
        },
      }),
    [
      brand,
      format,
      durationFrames,
      reducedMotion,
      enter,
      exit,
      beats,
      disclosure,
      hasCaptions,
      progress,
      hasLowerThird,
    ],
  );
  return (
    <SceneEnvironmentProvider value={environment}>
      <SceneLayers {...props} />
    </SceneEnvironmentProvider>
  );
}
