import { useId, type ReactNode } from "react";
import { mixHex, withAlpha } from "../design/colour";
import { useTokens } from "../design/SceneContext";
import {
  FIGURE,
  shoulder,
  type Arm,
  type CharacterLook,
  type ExpressionFrame,
  type HeldItem,
  type PoseFrame,
} from "../lib/character";

export interface CharacterProps {
  look: CharacterLook;
  /** Width in output pixels; the height follows from the figure's proportions. */
  width: number;
  pose: PoseFrame;
  expression: ExpressionFrame;
  /** The busy arm is on the viewer's left. */
  mirrored: boolean;
  /** What the busy hand holds, each with its opacity: one fades out as the next fades in. */
  held: readonly { item: HeldItem; opacity: number }[];
  /** 0-1 strength of an index finger on the busy hand. */
  pointing: number;
  /** 0 eyes open, 1 shut. */
  blink: number;
  /** How far the figure has risen on a breath, in design pixels. */
  rise: number;
}

const HEAD = { cx: 200, cy: 146, rx: 74, ry: 78 } as const;
const EYES = { y: 150, left: 174, right: 226, rx: 6.5, ry: 8.5 } as const;
const MOUTH_Y = 190;
const ARM = 44;
const HAND = 22;
/** The niche: a tall arch. The figure is cut to its foot, and free to reach past its sides. */
const NICHE = "M50 402V170A150 150 0 0 1 350 170V402A28 28 0 0 1 322 430H78A28 28 0 0 1 50 402Z";
const CUT = "M-80 -80H480V402H350A28 28 0 0 1 322 430H78A28 28 0 0 1 50 402H-80Z";
/** The face glyph's fringe and sweep, at this figure's size: the same hair, grown up. */
const FRINGE =
  "M122 146C122 79 159 53 200 53C241 53 278 79 278 146C256 124 233 113 200 113C167 113 144 124 122 146Z";
const SWEEP =
  "M119 157C111 87 156 50 207 53C252 57 281 87 281 139C241 135 200 113 178 83C167 113 144 139 119 157Z";

const n = (value: number): string => String(Math.round(value * 100) / 100);
const armPath = (side: "left" | "right", arm: Arm): string => {
  const from = shoulder(side);
  return `M${n(from.x)} ${n(from.y)}L${n(arm.elbow.x)} ${n(arm.elbow.y)}L${n(arm.hand.x)} ${n(arm.hand.y)}`;
};

/**
 * One person of an explainer, waist-up in a niche. Flat shapes only: a head, hair, a body,
 * two arms that go where the pose puts them and a face made of a few strokes. A hidden
 * character is the same outline with nothing filled in: somebody, but nobody yet.
 */
export function Character(props: CharacterProps): ReactNode {
  const tokens = useTokens();
  const clip = useId();
  const { look, pose, expression: face, mirrored } = props;
  const palette = tokens.characters;
  const hidden = look.hidden;
  const skin = hidden ? palette.hidden : palette.skin[look.skin];
  const skinShade = hidden ? palette.hidden : mixHex(skin, palette.ink, 0.2);
  const outfit = hidden ? palette.hidden : palette.outfit[look.outfit];
  const sleeve = mixHex(outfit, palette.ink, hidden ? 0.16 : 0.2);
  const hair = palette.hair[look.hairColour];
  const niche = hidden ? palette.backdrop : mixHex(palette.backdrop, outfit, 0.2);
  const device = mixHex(palette.backdrop, tokens.colours.text, 0.34);
  const dir = mirrored ? -1 : 1;
  const busy = mirrored ? pose.left : pose.right;
  const hand = busy.hand;
  const reach = Math.hypot(hand.x - busy.elbow.x, hand.y - busy.elbow.y) || 1;
  const finger = {
    x: hand.x + ((hand.x - busy.elbow.x) / reach) * 34,
    y: hand.y + ((hand.y - busy.elbow.y) / reach) * 34,
  };
  const heldOpacity = (item: HeldItem): number =>
    props.held.find((entry) => entry.item === item)?.opacity ?? 0;

  const eyeRy = Math.max(0.9, EYES.ry * face.eyes * (1 - props.blink));
  const browY = 127 + face.browLift;
  const mouthTop = MOUTH_Y + face.smile * 7 - face.open * (1 - Math.abs(face.smile)) * 15;
  const mouthBottom = MOUTH_Y + face.smile * 23 + face.open * 16;
  const mouth = `M${n(HEAD.cx - face.width)} ${MOUTH_Y}Q${HEAD.cx} ${n(mouthTop)} ${n(HEAD.cx + face.width)} ${MOUTH_Y}Q${HEAD.cx} ${n(mouthBottom)} ${n(HEAD.cx - face.width)} ${MOUTH_Y}Z`;

  return (
    <svg
      width={props.width}
      height={(props.width * FIGURE.height) / FIGURE.width}
      viewBox={`0 0 ${FIGURE.width} ${FIGURE.height}`}
      style={{ display: "block", overflow: "visible" }}
    >
      <clipPath id={clip}>
        <path d={CUT} />
      </clipPath>
      <path
        d={NICHE}
        fill={niche}
        stroke={hidden ? tokens.colours.hairlineStrong : "none"}
        strokeWidth={3}
        strokeDasharray={hidden ? "3 13" : undefined}
        strokeLinecap="round"
      />
      <g clipPath={`url(#${clip})`}>
        <g transform={`translate(0 ${n(-props.rise)})`}>
          {hidden ? null : (
            <>
              {look.hair === "afro" ? (
                <g fill={hair}>
                  <circle cx="200" cy="104" r="92" />
                  <circle cx="126" cy="130" r="52" />
                  <circle cx="274" cy="130" r="52" />
                  <circle cx="152" cy="72" r="52" />
                  <circle cx="248" cy="72" r="52" />
                </g>
              ) : null}
              {look.hair === "puffs" ? (
                <g fill={hair}>
                  <circle cx="128" cy="78" r="46" />
                  <circle cx="272" cy="78" r="46" />
                </g>
              ) : null}
              {look.hair === "bun" ? <circle cx="200" cy="44" r="34" fill={hair} /> : null}
              {look.hair === "bob" ? (
                <rect x="112" y="54" width="176" height="186" rx="84" fill={hair} />
              ) : null}
              {look.hair === "long" ? (
                <rect x="114" y="54" width="172" height="262" rx="80" fill={hair} />
              ) : null}
            </>
          )}
          <rect x="179" y="200" width="42" height="66" rx="18" fill={skinShade} />
          <path d="M82 440V320Q82 252 150 248H250Q318 252 318 320V440Z" fill={outfit} />
          {hidden ? null : look.collar ? (
            <path d="M170 246L200 292L230 246Z" fill={skinShade} />
          ) : (
            <path d="M168 246Q200 284 232 246Z" fill={skinShade} />
          )}
          <path
            d={`${armPath("left", pose.left)}${armPath("right", pose.right)}`}
            stroke={sleeve}
            strokeWidth={ARM}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {hidden ? null : (
            <>
              <circle cx="127" cy="152" r="13" fill={skinShade} />
              <circle cx="273" cy="152" r="13" fill={skinShade} />
            </>
          )}
          <ellipse cx={HEAD.cx} cy={HEAD.cy} rx={HEAD.rx} ry={HEAD.ry} fill={skin} />
          {hidden ? (
            <text
              x={HEAD.cx}
              y={HEAD.cy + 34}
              textAnchor="middle"
              fontFamily={tokens.fonts.display}
              fontWeight={600}
              fontSize={96}
              fill={withAlpha(tokens.colours.text, 0.5)}
            >
              ?
            </text>
          ) : (
            <>
              <circle cx="154" cy="178" r="12" fill={withAlpha(palette.outfit.pink, 0.2)} />
              <circle cx="246" cy="178" r="12" fill={withAlpha(palette.outfit.pink, 0.2)} />
              <ellipse
                cx={n(EYES.left + pose.gaze.x)}
                cy={n(EYES.y + pose.gaze.y)}
                rx={n(EYES.rx * face.eyes)}
                ry={n(eyeRy)}
                fill={palette.ink}
              />
              <ellipse
                cx={n(EYES.right + pose.gaze.x)}
                cy={n(EYES.y + pose.gaze.y)}
                rx={n(EYES.rx * face.eyes)}
                ry={n(eyeRy)}
                fill={palette.ink}
              />
              <path
                d={`M163 ${n(browY + face.browTilt / 2)}Q174 ${n(browY - 5)} 185 ${n(browY - face.browTilt / 2)}M215 ${n(browY - face.browTilt / 2 - face.browRaise)}Q226 ${n(browY - 5 - face.browRaise)} 237 ${n(browY + face.browTilt / 2 - face.browRaise)}`}
                stroke={palette.ink}
                strokeWidth={4.5}
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M195 168Q200 175 205 168"
                stroke={skinShade}
                strokeWidth={4.5}
                strokeLinecap="round"
                fill="none"
              />
              <path
                d={mouth}
                fill={palette.ink}
                stroke={palette.ink}
                strokeWidth={5.5}
                strokeLinejoin="round"
              />
              {look.hair === "sweep" ? <path d={SWEEP} fill={hair} /> : null}
              {look.hair !== "sweep" && look.hair !== "none" ? (
                <path d={FRINGE} fill={hair} />
              ) : null}
            </>
          )}

          {heldOpacity("phone") > 0 ? (
            <g
              opacity={heldOpacity("phone")}
              transform={`translate(${n(hand.x - 4 * dir)} ${n(hand.y - 36)}) rotate(${-8 * dir})`}
            >
              <rect x="-31" y="-54" width="62" height="108" rx="13" fill={palette.ink} />
              <rect x="-25" y="-47" width="50" height="94" rx="8" fill={tokens.colours.accent} />
              <rect
                x="-13"
                y="-32"
                width="26"
                height="6"
                rx="3"
                fill={withAlpha(palette.ink, 0.4)}
              />
            </g>
          ) : null}
          {heldOpacity("id-card") > 0 ? (
            <g
              opacity={heldOpacity("id-card")}
              transform={`translate(${n(hand.x - 2 * dir)} ${n(hand.y - 50)}) rotate(${4 * dir})`}
            >
              <rect x="-64" y="-43" width="128" height="86" rx="11" fill={tokens.colours.text} />
              <rect
                x="-51"
                y="-28"
                width="40"
                height="50"
                rx="7"
                fill={withAlpha(palette.ink, 0.2)}
              />
              <circle cx="-31" cy="-9" r="9" fill={withAlpha(palette.ink, 0.42)} />
              <path d="M-46 22Q-31 -2 -16 22Z" fill={withAlpha(palette.ink, 0.42)} />
              <rect
                x="0"
                y="-24"
                width="50"
                height="9"
                rx="4.5"
                fill={withAlpha(palette.ink, 0.5)}
              />
              <rect x="0" y="-5" width="38" height="8" rx="4" fill={withAlpha(palette.ink, 0.24)} />
              <rect x="0" y="11" width="44" height="8" rx="4" fill={withAlpha(palette.ink, 0.24)} />
            </g>
          ) : null}
          {heldOpacity("camera-phone") > 0 ? (
            <g
              opacity={heldOpacity("camera-phone")}
              transform={`translate(${n(hand.x)} ${n(hand.y - 34)}) rotate(${9 * dir})`}
            >
              <rect x="-30" y="-52" width="60" height="104" rx="13" fill={device} />
              <circle cx="0" cy="-32" r="9" fill={palette.ink} />
              <circle cx="0" cy="-32" r="3.5" fill={tokens.colours.accent} />
            </g>
          ) : null}

          {props.pointing > 0 ? (
            <path
              d={`M${n(hand.x)} ${n(hand.y)}L${n(finger.x)} ${n(finger.y)}`}
              stroke={skin}
              strokeWidth={15}
              strokeLinecap="round"
              opacity={props.pointing}
            />
          ) : null}
          <circle cx={n(pose.left.hand.x)} cy={n(pose.left.hand.y)} r={HAND} fill={skin} />
          <circle cx={n(pose.right.hand.x)} cy={n(pose.right.hand.y)} r={HAND} fill={skin} />

          {heldOpacity("laptop") > 0 ? (
            <g opacity={heldOpacity("laptop")}>
              <rect x="104" y="306" width="192" height="118" rx="14" fill={device} />
              <circle cx="200" cy="362" r="11" fill={withAlpha(tokens.colours.text, 0.34)} />
              <rect
                x="74"
                y="414"
                width="252"
                height="14"
                rx="7"
                fill={mixHex(device, tokens.colours.text, 0.3)}
              />
            </g>
          ) : null}
        </g>
      </g>
    </svg>
  );
}
