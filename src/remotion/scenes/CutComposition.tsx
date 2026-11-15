import type { ReactNode } from "react";
import { AbsoluteFill, Series } from "remotion";
import type { CutRenderProps } from "../../domain/render-props";
import { SceneComposition } from "./SceneComposition";

/**
 * Every scene of a cut back to back, for reviewing the whole edit in Remotion Studio.
 * Production renders each scene separately and joins them, which this mirrors exactly:
 * hard cuts with no overlap.
 */
export function CutComposition({ scenes }: CutRenderProps): ReactNode {
  return (
    <AbsoluteFill>
      <Series>
        {scenes.map((scene) => (
          <Series.Sequence
            key={scene.scene.id}
            durationInFrames={Math.max(1, Math.round(scene.durationFrames))}
            name={scene.scene.id}
          >
            <SceneComposition {...scene} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
}
