import type { FormatSpec } from "../../domain/formats";
import type { CutRenderProps, SceneRenderProps } from "../../domain/render-props";

export interface CompositionMetadata {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

/** Remotion rejects a zero-length composition, so a scene is always at least one frame. */
const frames = (value: number): number => Math.max(1, Math.round(value));

export function sceneMetadata(
  props: Pick<SceneRenderProps, "format" | "durationFrames">,
): CompositionMetadata {
  return {
    width: props.format.width,
    height: props.format.height,
    fps: props.format.fps,
    durationInFrames: frames(props.durationFrames),
  };
}

/**
 * A cut takes its canvas from its first scene; every scene in a cut shares one format.
 * `fallback` keeps Remotion Studio usable when a cut has no scenes yet.
 */
export function cutMetadata(props: CutRenderProps, fallback: FormatSpec): CompositionMetadata {
  const format = props.scenes[0]?.format ?? fallback;
  const total = props.scenes.reduce((sum, scene) => sum + frames(scene.durationFrames), 0);
  return {
    width: format.width,
    height: format.height,
    fps: format.fps,
    durationInFrames: Math.max(1, total),
  };
}
