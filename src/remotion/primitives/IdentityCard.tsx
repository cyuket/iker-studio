import type { ReactNode } from "react";
import { interpolateColors } from "remotion";
import type { Status } from "../../domain/storyboard";
import { withAlpha } from "../design/colour";
import { fitFontSize } from "../design/layout";
import { mix } from "../design/motion";
import { useTokens } from "../design/SceneContext";
import { toneColour } from "../design/tokens";
import type { IdentityCardMetrics } from "../lib/identity";
import { FaceGlyph } from "./FaceGlyph";
import { Icon, type IconName } from "./Icon";
import { StatusMark, statusTone } from "./StatusMark";

export interface IdentityCardField {
  icon: IconName;
  value: string;
  /** 0 shows an empty slot, 1 the value. */
  reveal: number;
  /** 0-1 strength of the "this differs" emphasis. */
  emphasis: number;
}

export interface IdentityCardStep {
  label: string;
  status?: Status | undefined;
  /** 0 not reached, 1 reached. A spring may pass slightly above 1. */
  progress: number;
}

export interface IdentityCardProps {
  metrics: IdentityCardMetrics;
  name: string;
  /** 0 shows an empty slot, 1 the name. */
  nameReveal: number;
  nameEmphasis: number;
  /** Seed of the face glyph. */
  face: string;
  /** 1 is the resting size; a matched face is shown slightly larger. */
  faceScale: number;
  /** 0-1 progress of a ring around the face, drawn in `ringColour`. */
  faceRing: number;
  ringColour: string;
  /** Opacity of the face, separate from the card so a matched face can stay lit. */
  faceOpacity: number;
  fields: readonly IdentityCardField[];
  steps: readonly IdentityCardStep[];
  /** Opacity of the card and everything on it except the face. */
  contentOpacity: number;
}

/** Share of a reveal spent clearing the empty slot before the value starts to appear. */
const SLOT_SHARE = 0.4;

/**
 * The empty slot is gone before its value arrives. If the two crossfaded, the slot's bar
 * would sit across the text for a few frames and read as a strike-through.
 */
function slotOpacity(reveal: number): number {
  return 1 - Math.min(1, Math.max(0, reveal / SLOT_SHARE));
}

function valueOpacity(reveal: number): number {
  return Math.min(1, Math.max(0, (reveal - SLOT_SHARE) / (1 - SLOT_SHARE)));
}

/**
 * One account as a stylised card: an abstract face, a name, a few details and what has
 * happened to it. It is an illustration of an identity, deliberately unlike any screen of
 * the product: dark, flat, and built from glyphs instead of form controls.
 */
export function IdentityCard(props: IdentityCardProps): ReactNode {
  const tokens = useTokens();
  const { metrics, fields, steps } = props;
  const { k } = metrics;
  const differ = tokens.colours.warning;
  const slot = withAlpha(tokens.colours.text, 0.1);
  const cut = 5 * k;

  const nameSize = fitFontSize({
    text: props.name,
    maxWidth: metrics.name.width,
    maxLines: 1,
    size: metrics.name.size,
    minSize: metrics.name.size * 0.6,
    charWidth: 0.56,
  });
  const valueWidth = metrics.width - metrics.paddingX * 2 - metrics.fields.icon - 16 * k - 20 * k;
  const reached = steps.reduce((last, step, i) => (step.progress > 0 ? i : last), -1);

  return (
    <div style={{ position: "relative", width: metrics.width, height: metrics.height }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: props.contentOpacity,
          borderRadius: metrics.radius,
          backgroundColor: tokens.colours.surface,
          boxShadow: `0 0 0 ${tokens.stroke.hairline}px ${tokens.colours.hairlineStrong}`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: metrics.name.x,
            top: metrics.name.y,
            width: metrics.name.width,
            height: metrics.name.height,
            display: "flex",
            alignItems: "center",
            justifyContent: metrics.name.centred ? "center" : "flex-start",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: metrics.name.width * 0.56,
              height: metrics.name.size * 0.42,
              borderRadius: tokens.radii.pill,
              backgroundColor: slot,
              opacity: slotOpacity(props.nameReveal),
            }}
          />
          <div
            style={{
              fontFamily: tokens.fonts.display,
              fontWeight: 600,
              fontSize: nameSize,
              letterSpacing: "-0.02em",
              whiteSpace: "nowrap",
              color: interpolateColors(props.nameEmphasis, [0, 1], [tokens.colours.text, differ]),
              opacity: valueOpacity(props.nameReveal),
            }}
          >
            {props.name}
          </div>
        </div>

        {fields.map((field, i) => {
          const size = fitFontSize({
            text: field.value,
            maxWidth: valueWidth,
            maxLines: 1,
            size: metrics.fields.size,
            minSize: metrics.fields.size * 0.7,
          });
          const rowTop = metrics.fields.y + i * metrics.fields.rowHeight;
          const inset = 5 * k;
          return (
            <div
              key={`${field.icon}-${i}`}
              style={{
                position: "absolute",
                left: metrics.paddingX - 10 * k,
                top: rowTop + inset,
                width: metrics.width - (metrics.paddingX - 10 * k) * 2,
                height: metrics.fields.rowHeight - inset * 2,
                boxSizing: "border-box",
                padding: `0 ${10 * k}px`,
                display: "flex",
                alignItems: "center",
                gap: 16 * k,
                borderRadius: tokens.radii.sm,
                backgroundColor: withAlpha(differ, 0.13 * field.emphasis),
              }}
            >
              <Icon
                name={field.icon}
                size={metrics.fields.icon}
                colour={interpolateColors(
                  field.emphasis,
                  [0, 1],
                  [tokens.colours.textMuted, differ],
                )}
              />
              <div style={{ position: "relative", flex: 1, minWidth: 0, height: "100%" }}>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "50%",
                    width: "62%",
                    height: metrics.fields.size * 0.4,
                    marginTop: -metrics.fields.size * 0.2,
                    borderRadius: tokens.radii.pill,
                    backgroundColor: slot,
                    opacity: slotOpacity(field.reveal),
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    fontFamily: tokens.fonts.sans,
                    fontWeight: 500,
                    fontSize: size,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: interpolateColors(
                      field.emphasis,
                      [0, 1],
                      [tokens.colours.textSoft, differ],
                    ),
                    opacity: valueOpacity(field.reveal),
                  }}
                >
                  {field.value}
                </div>
              </div>
            </div>
          );
        })}

        {metrics.footer && steps.length > 0 ? (
          <>
            <div
              style={{
                position: "absolute",
                left: metrics.paddingX,
                top: metrics.footer.y,
                width: metrics.width - metrics.paddingX * 2,
                height: metrics.footer.barHeight,
                display: "flex",
                gap: 8 * k,
              }}
            >
              {steps.map((step, i) => (
                <div
                  key={`${step.label}-${i}`}
                  style={{
                    position: "relative",
                    flex: 1,
                    borderRadius: tokens.radii.pill,
                    backgroundColor: tokens.colours.hairlineStrong,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: `${Math.min(1, Math.max(0, step.progress)) * 100}%`,
                      borderRadius: tokens.radii.pill,
                      backgroundColor: toneColour(
                        tokens,
                        step.status ? statusTone(step.status) : "primary",
                      ),
                    }}
                  />
                </div>
              ))}
            </div>
            {steps.map((step, i) => {
              const next = steps[i + 1];
              const shown =
                Math.min(1, Math.max(0, step.progress)) *
                (1 - Math.min(1, Math.max(0, next?.progress ?? 0)));
              if (shown <= 0 || !metrics.footer) return null;
              return (
                <div
                  key={`line-${step.label}-${i}`}
                  style={{
                    position: "absolute",
                    left: metrics.paddingX,
                    top: metrics.footer.lineY,
                    width: metrics.width - metrics.paddingX * 2,
                    height: metrics.footer.lineHeight,
                    display: "flex",
                    alignItems: "center",
                    gap: 14 * k,
                    opacity: shown,
                  }}
                >
                  {step.status ? (
                    <StatusMark
                      status={step.status}
                      size={metrics.footer.lineHeight * 0.86}
                      progress={i === reached ? step.progress : 1}
                    />
                  ) : null}
                  <div
                    style={{
                      fontFamily: tokens.fonts.sans,
                      fontWeight: 600,
                      fontSize: metrics.footer.size,
                      whiteSpace: "nowrap",
                      color: step.status
                        ? toneColour(tokens, statusTone(step.status))
                        : tokens.colours.textSoft,
                    }}
                  >
                    {step.label}
                  </div>
                </div>
              );
            })}
          </>
        ) : null}
      </div>

      {/* The face sits on its own layer: when accounts are matched it is what stays lit. */}
      <div
        style={{
          position: "absolute",
          left: metrics.face.cx - metrics.face.r - cut,
          top: metrics.face.cy - metrics.face.r - cut,
          padding: cut,
          borderRadius: tokens.radii.pill,
          backgroundColor: tokens.colours.background,
          opacity: props.faceOpacity,
          scale: String(props.faceScale),
        }}
      >
        <FaceGlyph seed={props.face} size={metrics.face.r * 2} />
        {props.faceRing > 0 ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              boxSizing: "border-box",
              borderRadius: tokens.radii.pill,
              border: `${Math.max(2, 4 * k)}px solid ${props.ringColour}`,
              opacity: Math.min(1, props.faceRing * 1.5),
              scale: String(mix(1.12, 1, Math.min(1, props.faceRing))),
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
