import type { ReactNode } from "react";
import { withAlpha } from "../design/colour";
import type { Rect } from "../design/layout";
import { useTokens } from "../design/SceneContext";

const LETTER_SPACING_EM = 0.1;

export interface DisclosureLabelProps {
  text: string;
  /** The band reserved for the label; nothing else is ever laid out inside it. */
  zone: Rect;
}

/**
 * Compliance label for synthetic footage. It has no entrance or exit and sits outside the
 * scene's fade, so it is present at full strength on every frame including the first and last.
 */
export function DisclosureLabel({ text, zone }: DisclosureLabelProps): ReactNode {
  const tokens = useTokens();
  const padding = zone.height * 0.45;
  const dot = zone.height * 0.22;
  const gap = zone.height * 0.3;
  // The label must never be cut off, so the type shrinks until the whole sentence fits.
  // A monospace glyph advances 0.6em, plus the letter spacing.
  const widthPerCharacter = 0.6 + LETTER_SPACING_EM;
  const fitted = (zone.width - padding * 2 - dot - gap) / (text.length * widthPerCharacter);
  const fontSize = Math.min(zone.height * 0.46, fitted);
  return (
    <div
      style={{
        position: "absolute",
        left: zone.x,
        top: zone.y,
        width: zone.width,
        height: zone.height,
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          height: zone.height,
          maxWidth: "100%",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap,
          padding: `0 ${padding}px`,
          borderRadius: tokens.radii.sm,
          backgroundColor: withAlpha(tokens.colours.surfaceRaised, 0.96),
          border: `${tokens.stroke.hairline}px solid ${withAlpha(tokens.colours.warning, 0.55)}`,
        }}
      >
        <div
          style={{
            width: dot,
            height: dot,
            flexShrink: 0,
            borderRadius: tokens.radii.pill,
            backgroundColor: tokens.colours.warning,
          }}
        />
        <div
          style={{
            fontFamily: tokens.fonts.mono,
            fontWeight: 600,
            fontSize,
            letterSpacing: `${LETTER_SPACING_EM}em`,
            textTransform: "uppercase",
            color: tokens.colours.text,
            whiteSpace: "nowrap",
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
}
