import type { ReactNode } from "react";
import type { Status, Tone } from "../../domain/storyboard";
import { withAlpha } from "../design/colour";
import { mix } from "../design/motion";
import { useTokens } from "../design/SceneContext";
import { MOTION, toneColour } from "../design/tokens";

/** The colour family a status is drawn in. */
export function statusTone(status: Status): Tone {
  switch (status) {
    case "verified":
      return "positive";
    case "flagged":
      return "warning";
    case "declined":
      return "danger";
    case "pending":
      return "neutral";
  }
}

const GLYPH: Record<Status, string> = {
  verified: "M7.4 12.4l3.1 3.1 6.1-6.6",
  flagged: "M12 7v6.2M12 16.6v.2",
  declined: "M8.6 8.6l6.8 6.8M15.4 8.6l-6.8 6.8",
  pending: "M12 7.6v4.6l2.8 1.7",
};

export interface StatusMarkProps {
  status: Status;
  /** Diameter in output pixels. */
  size: number;
  /** 0 is absent, 1 is stamped. A spring may pass slightly above 1 on the way. */
  progress: number;
}

/**
 * The verdict on something: verified, flagged, pending or declined. It is stamped rather
 * than faded in, and its glyph draws itself, so the viewer sees the moment it is decided.
 */
export function StatusMark({ status, size, progress }: StatusMarkProps): ReactNode {
  const tokens = useTokens();
  const colour = toneColour(tokens, statusTone(status));
  if (progress <= 0) return <div style={{ width: size, height: size, flexShrink: 0 }} />;
  const drawn = Math.min(1, Math.max(0, progress));
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        opacity: Math.min(1, drawn * 3),
        scale: String(mix(MOTION.scale.enterFrom - 0.3, 1, progress)),
      }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: "block" }}>
        <circle
          cx="12"
          cy="12"
          r="10.5"
          fill={withAlpha(colour, 0.16)}
          stroke={colour}
          strokeWidth="1.5"
        />
        <path
          d={GLYPH[status]}
          stroke={colour}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray="1"
          strokeDashoffset={1 - drawn}
        />
      </svg>
    </div>
  );
}
