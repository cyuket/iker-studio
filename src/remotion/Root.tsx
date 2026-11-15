import type { ReactNode } from "react";
import { Composition, Still, type CalculateMetadataFunction } from "remotion";
import { FORMATS } from "../domain/formats";
import {
  COMPOSITION_IDS,
  THUMBNAIL_SIZE,
  type CutRenderProps,
  type SceneRenderProps,
  type ThumbnailRenderProps,
} from "../domain/render-props";
import { cutMetadata, sceneMetadata } from "./lib/metadata";
import { SAMPLE_CUT, SAMPLE_SCENE, SAMPLE_THUMBNAIL } from "./sample-props";
import { CutComposition } from "./scenes/CutComposition";
import { SceneComposition } from "./scenes/SceneComposition";
import { Thumbnail } from "./thumbnail/Thumbnail";

/**
 * Remotion requires props to be assignable to Record<string, unknown>, which interfaces
 * are not. These aliases are structurally identical to the domain contract.
 */
type Indexable<T> = { [K in keyof T]: T[K] };
type SceneProps = Indexable<SceneRenderProps>;
type CutProps = Indexable<CutRenderProps>;
type ThumbnailProps = Indexable<ThumbnailRenderProps>;

const SceneRoot: (props: SceneProps) => ReactNode = SceneComposition;
const CutRoot: (props: CutProps) => ReactNode = CutComposition;
const ThumbnailRoot: (props: ThumbnailProps) => ReactNode = Thumbnail;
const sceneDefaults: SceneProps = SAMPLE_SCENE;
const cutDefaults: CutProps = SAMPLE_CUT;
const thumbnailDefaults: ThumbnailProps = SAMPLE_THUMBNAIL;

/** Canvas size, frame rate and length all come from the props, so one composition serves every format. */
const calculateSceneMetadata: CalculateMetadataFunction<SceneProps> = ({ props }) =>
  sceneMetadata(props);

const calculateCutMetadata: CalculateMetadataFunction<CutProps> = ({ props }) =>
  cutMetadata(props, FORMATS["youtube-landscape"]);

export function RemotionRoot(): ReactNode {
  return (
    <>
      <Composition
        id={COMPOSITION_IDS.scene}
        component={SceneRoot}
        defaultProps={sceneDefaults}
        calculateMetadata={calculateSceneMetadata}
      />
      <Composition
        id={COMPOSITION_IDS.cut}
        component={CutRoot}
        defaultProps={cutDefaults}
        calculateMetadata={calculateCutMetadata}
      />
      <Still
        id={COMPOSITION_IDS.thumbnail}
        component={ThumbnailRoot}
        defaultProps={thumbnailDefaults}
        width={THUMBNAIL_SIZE.width}
        height={THUMBNAIL_SIZE.height}
      />
    </>
  );
}
