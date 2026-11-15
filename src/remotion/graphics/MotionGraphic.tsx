import type { ReactNode } from "react";
import type { MotionGraphicVisual } from "../../domain/storyboard";
import { CharacterScene } from "./CharacterScene";
import { Decision } from "./Decision";
import { IdentityStory } from "./IdentityStory";
import { Network } from "./Network";
import { Pipeline } from "./Pipeline";
import { Story } from "./Story";
import { Timeline } from "./Timeline";
import { Transformation } from "./Transformation";

export interface MotionGraphicProps {
  visual: MotionGraphicVisual;
}

/** Draws any data-driven motion graphic. Used for whole scenes and for product preludes. */
export function MotionGraphic({ visual }: MotionGraphicProps): ReactNode {
  switch (visual.kind) {
    case "identity-story":
      return <IdentityStory visual={visual} />;
    case "network":
      return <Network visual={visual} />;
    case "pipeline":
      return <Pipeline visual={visual} />;
    case "decision":
      return <Decision visual={visual} />;
    case "timeline":
      return <Timeline visual={visual} />;
    case "story":
      return <Story visual={visual} />;
    case "transformation":
      return <Transformation visual={visual} />;
    case "character-scene":
      return <CharacterScene visual={visual} />;
  }
}
