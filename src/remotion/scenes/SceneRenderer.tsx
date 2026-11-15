import type { ReactNode } from "react";
import { CallToAction } from "../components/CallToAction";
import { ChapterTransition } from "../components/ChapterTransition";
import { CodeSnippet } from "../components/CodeSnippet";
import { ComparisonScene } from "../components/ComparisonScene";
import { DataVisualisation } from "../components/DataVisualisation";
import { DiagramScene } from "../components/DiagramScene";
import { IntroSequence } from "../components/IntroSequence";
import { OutroSequence } from "../components/OutroSequence";
import { Reveal } from "../components/Reveal";
import { StatementLayout } from "../components/StatementLayout";
import { StepIndicator } from "../components/StepIndicator";
import type { ResolvedBrand, ResolvedRecording } from "../../domain/render-props";
import type { SceneVisual } from "../../domain/storyboard";
import { MotionGraphic } from "../graphics/MotionGraphic";
import { HeadedLayout } from "./HeadedLayout";
import { ProductLayout } from "./ProductLayout";

export interface SceneRendererProps {
  visual: SceneVisual;
  brand: ResolvedBrand;
  recording: ResolvedRecording | null;
}

/** Maps a storyboard visual onto its layout. Rendered inside the scene's content zone. */
export function SceneRenderer({ visual, brand, recording }: SceneRendererProps): ReactNode {
  switch (visual.kind) {
    case "title":
      return <IntroSequence brand={brand} headline={visual.headline} subhead={visual.subhead} />;
    case "statement":
      return (
        <StatementLayout
          headline={visual.headline}
          body={visual.body}
          points={visual.points}
          tone={visual.tone}
        />
      );
    case "steps":
      return (
        <HeadedLayout heading={visual.heading} body="hug">
          {({ startFrame }) => <StepIndicator steps={visual.steps} startFrame={startFrame} />}
        </HeadedLayout>
      );
    case "product":
      return <ProductLayout visual={visual} recording={recording} />;
    case "diagram":
      return (
        <HeadedLayout heading={visual.heading} body="fill">
          {({ width, height, startFrame }) => (
            <DiagramScene
              nodes={visual.nodes}
              edges={visual.edges}
              width={width}
              height={height}
              startFrame={startFrame}
            />
          )}
        </HeadedLayout>
      );
    case "comparison":
      return (
        <HeadedLayout heading={visual.heading} body="hug">
          {({ startFrame }) => (
            <ComparisonScene left={visual.left} right={visual.right} startFrame={startFrame} />
          )}
        </HeadedLayout>
      );
    case "code":
      return (
        <HeadedLayout heading={visual.heading} body="hug">
          {({ width, height, startFrame }) => (
            <Reveal at={startFrame}>
              <CodeSnippet
                language={visual.language}
                code={visual.code}
                highlightLines={visual.highlightLines}
                maxWidth={width}
                maxHeight={height}
              />
            </Reveal>
          )}
        </HeadedLayout>
      );
    case "data":
      return (
        <HeadedLayout heading={visual.heading} body="hug">
          {({ startFrame }) => (
            <DataVisualisation
              unit={visual.unit}
              series={visual.series}
              source={visual.source}
              illustrative={visual.illustrative}
              startFrame={startFrame}
            />
          )}
        </HeadedLayout>
      );
    case "cta":
      return (
        <CallToAction
          brand={brand}
          headline={visual.headline}
          action={visual.action}
          url={visual.url}
        />
      );
    case "outro":
      return <OutroSequence brand={brand} tagline={visual.tagline} />;
    case "chapter":
      return <ChapterTransition title={visual.title} />;
    default:
      return <MotionGraphic visual={visual} />;
  }
}
