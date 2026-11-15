import type { ReactNode } from "react";
import { withAlpha } from "../design/colour";
import { useTokens } from "../design/SceneContext";
import { faceSpec } from "../lib/face";

export interface FaceGlyphProps {
  /** Same seed, same face. Use one seed per fictional person across a whole film. */
  seed: string;
  /** Diameter in output pixels. */
  size: number;
}

const FRINGE = "M29 44C29 26 39 19 50 19s21 7 21 25c-6-6-12-9-21-9s-15 3-21 9z";
const SWEEP = "M28 47C26 28 38 18 52 19c12 1 20 9 20 23-11-1-22-7-28-15-3 8-9 15-16 20z";

/**
 * An abstract portrait: a tinted disc, shoulders, a head and a hair shape. It stands for a
 * person without depicting one, and it can never be mistaken for a photo or for product UI.
 */
export function FaceGlyph({ seed, size }: FaceGlyphProps): ReactNode {
  const tokens = useTokens();
  const spec = faceSpec(seed);
  const feature = tokens.glyphs[spec.scheme];
  const disc = withAlpha(feature, 0.26);
  const skin = tokens.colours.text;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: tokens.radii.pill,
        overflow: "hidden",
        backgroundColor: tokens.colours.surfaceRaised,
        flexShrink: 0,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block" }}>
        <rect width="100" height="100" fill={disc} />
        {spec.hair === "bob" ? (
          <rect x="22" y="19" width="56" height="54" rx="27" fill={feature} />
        ) : null}
        {spec.hair === "long" ? (
          <rect x="24" y="19" width="52" height="74" rx="25" fill={feature} />
        ) : null}
        {spec.hair === "bun" ? <circle cx="50" cy="13.5" r="10.5" fill={feature} /> : null}
        <rect x="42" y="56" width="16" height="24" rx="7" fill={withAlpha(skin, 0.78)} />
        {spec.shoulders === "round" ? (
          <ellipse cx="50" cy="106" rx="41" ry="32" fill={feature} />
        ) : (
          <rect x="12" y="75" width="76" height="50" rx="20" fill={feature} />
        )}
        {spec.collar ? <path d="M42 73.5h16L50 86z" fill={withAlpha(skin, 0.78)} /> : null}
        {spec.head === "round" ? <circle cx="50" cy="44" r="20" fill={skin} /> : null}
        {spec.head === "oval" ? <ellipse cx="50" cy="44" rx="17.5" ry="22" fill={skin} /> : null}
        {spec.head === "square" ? (
          <rect x="31" y="23" width="38" height="42" rx="15" fill={skin} />
        ) : null}
        {spec.hair === "sweep" ? <path d={SWEEP} fill={feature} /> : null}
        {spec.hair !== "sweep" && spec.hair !== "none" ? <path d={FRINGE} fill={feature} /> : null}
      </svg>
    </div>
  );
}
