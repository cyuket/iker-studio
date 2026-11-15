import type { ReactNode } from "react";
import { withAlpha } from "../design/colour";
import { useLayout, useSceneEnvironment, useTokens } from "../design/SceneContext";
import { labelStyle, type Tokens } from "../design/tokens";
import { useEnterProgress } from "../design/useReveal";
import { fitCodeSize, tokenizeLine, type CodeTokenKind } from "../lib/code";

export interface CodeSnippetProps {
  language: string;
  code: string;
  /** 1-based line numbers to call out. */
  highlightLines: readonly number[];
  /** Largest box the panel may occupy, in output pixels. */
  maxWidth: number;
  maxHeight: number;
}

function tokenColour(tokens: Tokens, kind: CodeTokenKind): string {
  switch (kind) {
    case "keyword":
      return tokens.colours.accent;
    case "string":
      return tokens.colours.positive;
    case "number":
      return tokens.colours.warning;
    case "comment":
      return tokens.colours.textMuted;
    case "punctuation":
      return withAlpha(tokens.colours.text, 0.6);
    case "plain":
      return tokens.colours.text;
  }
}

/**
 * A code panel sized so no line wraps or clips. Highlighted lines are picked out part-way
 * through the scene, once the viewer has had time to take in the whole snippet.
 */
export function CodeSnippet({
  language,
  code,
  highlightLines,
  maxWidth,
  maxHeight,
}: CodeSnippetProps): ReactNode {
  const tokens = useTokens();
  const { u, pick } = useLayout();
  const { timing, fps, durationFrames } = useSceneEnvironment();
  const lines = code.replace(/\t/g, "  ").replace(/\n+$/, "").split("\n");
  const highlighted = new Set(highlightLines);
  const emphasisAt = Math.min(
    Math.round(durationFrames * 0.3),
    timing.leadFrames + Math.round(fps * 2.2),
  );
  const emphasis = useEnterProgress(Math.max(timing.leadFrames + timing.enterFrames, emphasisAt));
  const dim = highlighted.size > 0 ? emphasis : 0;

  const lineHeight = tokens.type.code.lineHeight;
  const padding = u(pick(36, 26));
  const header = u(pick(60, 62));
  const gutterChars = String(lines.length).length + 2;
  const size = fitCodeSize(
    lines.map((line) => " ".repeat(gutterChars) + line),
    maxWidth - padding * 2,
    maxHeight - header - padding * 2,
    u(pick(32, 30)),
    u(12),
    lineHeight,
  );
  const rowHeight = size * lineHeight;

  return (
    <div
      style={{
        maxWidth,
        boxSizing: "border-box",
        borderRadius: tokens.radii.lg,
        backgroundColor: tokens.colours.surface,
        border: `${tokens.stroke.hairline}px solid ${tokens.colours.hairlineStrong}`,
        boxShadow: tokens.shadows.raised,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: header,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          padding: `0 ${padding}px`,
          borderBottom: `${tokens.stroke.hairline}px solid ${tokens.colours.hairline}`,
          backgroundColor: withAlpha(tokens.colours.surfaceRaised, 0.6),
        }}
      >
        {/* The file type as written, not as an uppercase tag: small capitals read as decoration. */}
        <div style={{ ...labelStyle(tokens, tokens.colours.textMuted), textTransform: "none" }}>
          {language}
        </div>
      </div>
      <div
        style={{
          padding: `${padding}px 0`,
          fontFamily: tokens.fonts.mono,
          fontSize: size,
          lineHeight: `${rowHeight}px`,
        }}
      >
        {lines.map((line, i) => {
          const isHighlighted = highlighted.has(i + 1);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                height: rowHeight,
                padding: `0 ${padding}px`,
                whiteSpace: "pre",
                opacity: isHighlighted ? 1 : 1 - dim * 0.45,
                backgroundColor: isHighlighted
                  ? withAlpha(tokens.colours.primary, 0.16 * emphasis)
                  : "transparent",
                boxShadow: isHighlighted
                  ? `inset ${tokens.stroke.strong}px 0 0 ${withAlpha(tokens.colours.primary, emphasis)}`
                  : "none",
              }}
            >
              <span
                style={{
                  width: `${gutterChars}ch`,
                  flexShrink: 0,
                  color: isHighlighted
                    ? tokens.colours.accent
                    : withAlpha(tokens.colours.textMuted, 0.6),
                }}
              >
                {String(i + 1).padStart(gutterChars - 2, " ")}
              </span>
              <span>
                {tokenizeLine(line).map((token, j) => (
                  <span key={j} style={{ color: tokenColour(tokens, token.kind) }}>
                    {token.text}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
