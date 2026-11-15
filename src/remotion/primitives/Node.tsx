import type { ReactNode } from "react";
import type { Status } from "../../domain/storyboard";
import { useTokens } from "../design/SceneContext";
import { FaceGlyph } from "./FaceGlyph";
import { Icon, type IconName } from "./Icon";
import { StatusMark } from "./StatusMark";

export interface NodeProps {
  /** Radius of the circle in output pixels. */
  radius: number;
  icon: IconName;
  /** Face glyph seed; when set the glyph replaces the icon. */
  face?: string | undefined;
  /** Colour of the ring and of the icon. */
  colour: string;
  /** Stroke width of the ring in output pixels. */
  ring: number;
  label?: string | undefined;
  sublabel?: string | undefined;
  /** Width and height of the text block under the circle. */
  labelBox: { width: number; height: number };
  status?: Status | undefined;
  /** 0-1 progress of the status mark. */
  statusProgress?: number;
}

/**
 * One thing in a network: an account, a face, a device, a wallet. A circle with a glyph
 * that says what kind of thing it is, and its name underneath at a size that can be read.
 */
export function Node(props: NodeProps): ReactNode {
  const tokens = useTokens();
  const { radius, labelBox } = props;
  const size = radius * 2;
  const inset = props.ring + radius * 0.09;
  const badge = radius * 0.72;
  const title = radius * 0.46;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <div
        style={{
          width: size,
          height: size,
          boxSizing: "border-box",
          borderRadius: tokens.radii.pill,
          backgroundColor: tokens.colours.surface,
          border: `${props.ring}px solid ${props.colour}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {props.face ? (
          <FaceGlyph seed={props.face} size={size - inset * 2} />
        ) : (
          <Icon name={props.icon} size={radius * 0.96} colour={props.colour} />
        )}
      </div>
      {props.status ? (
        <div
          style={{
            position: "absolute",
            right: -badge * 0.18,
            bottom: -badge * 0.18,
            borderRadius: tokens.radii.pill,
            backgroundColor: tokens.colours.background,
          }}
        >
          <StatusMark status={props.status} size={badge} progress={props.statusProgress ?? 1} />
        </div>
      ) : null}
      {props.label ? (
        <div
          style={{
            position: "absolute",
            left: radius - labelBox.width / 2,
            top: size + radius * 0.2,
            width: labelBox.width,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: tokens.fonts.sans,
              fontWeight: 600,
              fontSize: title,
              lineHeight: 1.15,
              color: tokens.colours.text,
              textWrap: "balance",
            }}
          >
            {props.label}
          </div>
          {props.sublabel ? (
            <div
              style={{
                marginTop: radius * 0.06,
                fontFamily: tokens.fonts.sans,
                fontSize: title * 0.86,
                lineHeight: 1.2,
                color: tokens.colours.textMuted,
              }}
            >
              {props.sublabel}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
