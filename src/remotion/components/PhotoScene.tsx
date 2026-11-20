import type { ReactNode } from "react";
import { Img, useCurrentFrame } from "remotion";
import type { PhotoSceneVisual } from "../../domain/storyboard";
import { easeCamera, mix } from "../design/motion";
import { useLayout, useSceneEnvironment, useTokens } from "../design/SceneContext";
import { useBeat } from "../design/useBeat";
import { HeadedLayout } from "../scenes/HeadedLayout";
import { Reveal } from "./Reveal";

export interface PhotoSceneProps {
  visual: PhotoSceneVisual;
  /** URL of the photo; null renders an empty frame so a missing file is obvious in review. */
  src: string | null;
}

/** Scale and drift of the photo over the scene, as start and end values. */
const MOVES: Record<PhotoSceneVisual["motion"], { scale: [number, number]; x: [number, number] }> =
  {
    "zoom-in": { scale: [1.03, 1.12], x: [0, 0] },
    "zoom-out": { scale: [1.12, 1.03], x: [0, 0] },
    "pan-left": { scale: [1.1, 1.1], x: [2.5, -2.5] },
    "pan-right": { scale: [1.1, 1.1], x: [-2.5, 2.5] },
    still: { scale: [1.03, 1.03], x: [0, 0] },
  };

/**
 * A real photograph framed in the content zone, with a slow camera move that keeps the photo's
 * point of interest in frame, and an optional caption on a scrim at its foot.
 */
export function PhotoScene({ visual, src }: PhotoSceneProps): ReactNode {
  return (
    <HeadedLayout heading={visual.heading} body="fill">
      {({ width, height, startFrame }) => (
        <Reveal at={startFrame}>
          <PhotoFrame visual={visual} src={src} width={width} height={height} />
        </Reveal>
      )}
    </HeadedLayout>
  );
}

function PhotoFrame(props: {
  visual: PhotoSceneVisual;
  src: string | null;
  width: number;
  height: number;
}): ReactNode {
  const { visual, src, width, height } = props;
  const tokens = useTokens();
  const { u, pick } = useLayout();
  const frame = useCurrentFrame();
  const { durationFrames, reducedMotion, timing, fps } = useSceneEnvironment();
  const captionBeat = useBeat(visual.captionCue);

  const move = MOVES[reducedMotion ? "still" : visual.motion];
  const t = easeCamera(Math.min(1, Math.max(0, frame / Math.max(1, durationFrames - 1))));
  const scale = mix(move.scale[0], move.scale[1], t);
  const x = mix(move.x[0], move.x[1], t);
  const origin = `${String(visual.focus.x * 100)}% ${String(visual.focus.y * 100)}%`;
  const captionAt = captionBeat ?? timing.leadFrames + Math.round(fps * 0.5);
  const inset = u(pick(32, 36));

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        overflow: "hidden",
        borderRadius: tokens.radii.xl,
        boxShadow: tokens.shadows.raised,
        backgroundColor: tokens.colours.surfaceRaised,
      }}
    >
      {src ? (
        <Img
          src={src}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: origin,
            transformOrigin: origin,
            transform: `translateX(${String(x)}%) scale(${String(scale)})`,
          }}
        />
      ) : null}
      {visual.caption ? (
        <Reveal
          at={captionAt}
          style={{ position: "absolute", left: inset, right: inset, bottom: inset }}
        >
          <div
            style={{
              ...tokens.type.h3,
              display: "inline-block",
              maxWidth: "100%",
              padding: `${String(u(14))}px ${String(u(24))}px`,
              borderRadius: tokens.radii.lg,
              backgroundColor: tokens.colours.scrim,
              color: tokens.colours.text,
              textWrap: "balance",
            }}
          >
            {visual.caption}
          </div>
        </Reveal>
      ) : null}
    </div>
  );
}
