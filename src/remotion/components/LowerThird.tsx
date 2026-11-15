import type { ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { Rect } from "../design/layout";
import { useSceneEnvironment, useTokens } from "../design/SceneContext";
import { useReveal } from "../design/useReveal";

export interface LowerThirdProps {
  title: string;
  subtitle?: string | undefined;
  /** The band reserved for the lower third; scene content never enters it. */
  zone: Rect;
}

/** How long a lower third stays up before it clears, in seconds. */
const HOLD_SECONDS = 5;

/** Names who or what is on screen, then gets out of the way. */
export function LowerThird({ title, subtitle, zone }: LowerThirdProps): ReactNode {
  const tokens = useTokens();
  const { fps, timing } = useSceneEnvironment();
  const frame = useCurrentFrame();
  const start = timing.leadFrames + Math.round(fps * 0.4);
  const reveal = useReveal(start, 12);
  const end = start + Math.round(HOLD_SECONDS * fps);
  const leave = interpolate(frame, [end, end + timing.exitFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleSize = zone.height * (subtitle ? 0.4 : 0.48);

  return (
    <div
      style={{
        position: "absolute",
        left: zone.x,
        top: zone.y,
        width: zone.width,
        height: zone.height,
        opacity: leave,
      }}
    >
      <div
        style={{
          ...reveal,
          height: "100%",
          display: "flex",
          alignItems: "stretch",
          gap: zone.height * 0.2,
        }}
      >
        <div
          style={{
            width: tokens.stroke.strong,
            borderRadius: tokens.radii.pill,
            backgroundColor: tokens.colours.primary,
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: zone.height * 0.06,
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontFamily: tokens.fonts.display,
              fontWeight: 600,
              fontSize: titleSize,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: tokens.colours.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                fontFamily: tokens.fonts.sans,
                fontSize: zone.height * 0.27,
                lineHeight: 1.2,
                color: tokens.colours.textMuted,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
