import type { ReactNode } from "react";
import type { Region } from "../../domain/storyboard";
import { useLayout, useTokens } from "../design/SceneContext";
import { clipRegion, mapRegion, type ZoomState } from "../lib/recording";
import { DimMask, FocusRing } from "../primitives/Focus";

export interface UIElementFocusProps {
  /** The element, in fractions of the recorded viewport. */
  region: Region;
  /** The camera, so the focus stays on the element while the footage moves. */
  zoom: ZoomState;
  /** Size of the viewport the footage is drawn in, in output pixels. */
  bounds: { width: number; height: number };
  /** 0-1 strength. */
  progress: number;
  /** Dim everything else in the viewport. */
  isolate?: boolean;
  /** Draw a ring around the element. */
  ring?: boolean;
  colour?: string;
}

/**
 * Points at one element of real footage: a ring around it, and optionally everything else
 * dimmed. It adds nothing to the interface and puts no label on it. Must be rendered inside
 * the clipped viewport of a product frame.
 */
export function UIElementFocus({
  region,
  zoom,
  bounds,
  progress,
  isolate = false,
  ring = true,
  colour,
}: UIElementFocusProps): ReactNode {
  const tokens = useTokens();
  const { u } = useLayout();
  const visible = clipRegion(mapRegion(region, zoom));
  if (!visible || progress <= 0) return null;
  const target = {
    x: visible.x * bounds.width,
    y: visible.y * bounds.height,
    width: visible.width * bounds.width,
    height: visible.height * bounds.height,
  };
  return (
    <>
      {isolate ? (
        <DimMask target={target} progress={progress} padding={u(8)} radius={tokens.radii.md} />
      ) : null}
      {ring ? (
        <FocusRing
          target={target}
          progress={progress}
          colour={colour ?? tokens.colours.primary}
          padding={u(8)}
          radius={tokens.radii.md}
          weight={tokens.stroke.strong}
        />
      ) : null}
    </>
  );
}

/** `UIElementFocus` with isolation on: the element in a pool of light, the rest dimmed. */
export function ProductSpotlight(props: Omit<UIElementFocusProps, "isolate">): ReactNode {
  return <UIElementFocus {...props} isolate />;
}
