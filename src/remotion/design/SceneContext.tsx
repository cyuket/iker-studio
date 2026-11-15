import { createContext, useContext, type ReactNode } from "react";
import type { Brand } from "../../domain/brand";
import {
  computeLayout,
  computeZones,
  type Layout,
  type LayoutFormat,
  type OverlayPresence,
  type Zones,
} from "./layout";
import { sceneTiming, type RevealMode, type SceneTiming } from "./motion";
import { buildTokens, type Tokens } from "./tokens";

export interface SceneEnvironment {
  tokens: Tokens;
  layout: Layout;
  zones: Zones;
  timing: SceneTiming;
  fps: number;
  durationFrames: number;
  reducedMotion: boolean;
  enter: RevealMode;
  exit: "fade" | "hold";
  /** Frame at which each of the scene's cues fires. */
  beats: Readonly<Record<string, number>>;
}

export interface EnvironmentInput {
  brand: Brand;
  format: LayoutFormat;
  fps: number;
  durationFrames: number;
  reducedMotion: boolean;
  enter: RevealMode;
  exit?: "fade" | "hold";
  /** Cue times in seconds from the start of the scene. */
  beats?: Readonly<Record<string, number>>;
  overlays: OverlayPresence;
}

/** Everything a component needs to lay itself out, derived once per scene from its props. */
export function createEnvironment(input: EnvironmentInput): SceneEnvironment {
  const layout = computeLayout(input.format);
  return {
    tokens: buildTokens(input.brand, layout),
    layout,
    zones: computeZones(layout, input.overlays, input.format.captions.maxLines),
    timing: sceneTiming(input.durationFrames, input.fps),
    fps: input.fps,
    durationFrames: input.durationFrames,
    reducedMotion: input.reducedMotion,
    enter: input.enter,
    exit: input.exit ?? "fade",
    beats: Object.fromEntries(
      Object.entries(input.beats ?? {}).map(([id, seconds]) => [
        id,
        Math.round(seconds * input.fps),
      ]),
    ),
  };
}

const SceneEnvironmentContext = createContext<SceneEnvironment | null>(null);

export function SceneEnvironmentProvider(props: {
  value: SceneEnvironment;
  children: ReactNode;
}): ReactNode {
  return (
    <SceneEnvironmentContext.Provider value={props.value}>
      {props.children}
    </SceneEnvironmentContext.Provider>
  );
}

export function useSceneEnvironment(): SceneEnvironment {
  const environment = useContext(SceneEnvironmentContext);
  if (!environment) throw new Error("Component rendered outside a SceneEnvironmentProvider");
  return environment;
}

/** Orientation, safe-area rect, overlay zones and scaled units for the current format. */
export function useLayout(): Layout & { zones: Zones } {
  const { layout, zones } = useSceneEnvironment();
  return { ...layout, zones };
}

export function useTokens(): Tokens {
  return useSceneEnvironment().tokens;
}
