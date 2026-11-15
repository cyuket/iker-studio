import type { CSSProperties, ReactNode } from "react";
import { interpolateColors } from "remotion";
import type { CharacterSceneProp } from "../../domain/storyboard";
import { withAlpha } from "../design/colour";
import type { Rect } from "../design/layout";
import { mix } from "../design/motion";
import { useTokens } from "../design/SceneContext";
import { MOTION } from "../design/tokens";
import { useMotion } from "../design/useBeat";
import {
  isInitialism,
  keywordLines,
  keywordScale,
  signupColumns,
  STAGE,
} from "../lib/character-scene";
import { ranksWithinCue } from "../lib/graph";
import { FaceGlyph } from "../primitives/FaceGlyph";
import { Icon, type IconName } from "../primitives/Icon";
import { StatusMark } from "../primitives/StatusMark";

type TileIcon = Extract<CharacterSceneProp, { kind: "tiles" }>["items"][number]["icon"];

/** The line icon that stands for each kind of object. */
export const TILE_ICON: Record<TileIcon, IconName> = {
  "id-card": "document",
  selfie: "selfie",
  link: "link",
  phone: "phone",
  laptop: "device",
  money: "wallet",
};

export interface StagePropProps {
  prop: CharacterSceneProp;
  rect: Rect;
  /** Output pixels per design pixel. */
  k: number;
  /** Frame the prop appears on. */
  start: number;
  settled: readonly string[];
  portrait: boolean;
  attached: boolean;
}

/**
 * Something on a character stage that is not a person: an app, the people signing up to
 * it, a list of steps, a sign-up card, a term, a few objects. Each is plain illustration,
 * deliberately unlike any screen of the product.
 */
export function StageProp(props: StagePropProps): ReactNode {
  const tokens = useTokens();
  const m = useMotion();
  const { prop, rect, k, start, settled } = props;
  const enter = m.tween(start, "enter");
  const settle = m.spring(start, "settle");
  const rise = (progress: number, distance: number): string =>
    m.reducedMotion ? "0px 0px" : `0px ${(1 - progress) * distance * k}px`;
  // Items that share a cue arrive one after another, like everything else that shares one.
  const together = (cues: readonly (string | undefined)[]): number[] =>
    ranksWithinCue(cues).map((rank) => Math.round(rank * MOTION.stagger.item * m.fps));
  const frame: CSSProperties = {
    position: "absolute",
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
  };
  const label = (text: string | undefined): ReactNode =>
    text ? (
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: rect.width,
          height: STAGE.label.height * k,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          fontFamily: tokens.fonts.sans,
          fontWeight: 500,
          fontSize: STAGE.label.size * k,
          lineHeight: 1.15,
          whiteSpace: "nowrap",
          color: tokens.colours.textSoft,
        }}
      >
        {text}
      </div>
    ) : null;
  const panel: CSSProperties = {
    backgroundColor: tokens.colours.surface,
    boxShadow: `0 0 0 ${tokens.stroke.hairline}px ${tokens.colours.hairlineStrong}`,
  };

  switch (prop.kind) {
    case "app": {
      const w = STAGE.app.width * k;
      const bar = withAlpha(tokens.colours.text, 0.12);
      return (
        <div style={{ ...frame, opacity: enter, translate: rise(settle, MOTION.distance.rise) }}>
          <div
            style={{
              position: "absolute",
              left: (rect.width - w) / 2,
              top: 0,
              width: w,
              height: STAGE.app.height * k,
              boxSizing: "border-box",
              borderRadius: 36 * k,
              backgroundColor: tokens.colours.surface,
              border: `${4 * k}px solid ${tokens.colours.hairlineStrong}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                marginTop: 18 * k,
                width: 52 * k,
                height: 9 * k,
                borderRadius: tokens.radii.pill,
                backgroundColor: bar,
              }}
            />
            <div style={{ marginTop: 50 * k, display: "flex", alignItems: "center", gap: 10 * k }}>
              <div
                style={{
                  width: 50 * k,
                  height: 50 * k,
                  borderRadius: tokens.radii.pill,
                  backgroundColor: tokens.glyphs.lilac,
                }}
              />
              <Icon name="transaction" size={34 * k} colour={tokens.colours.textSoft} />
              <div
                style={{
                  width: 50 * k,
                  height: 50 * k,
                  borderRadius: tokens.radii.pill,
                  backgroundColor: tokens.glyphs.blue,
                }}
              />
            </div>
            <div
              style={{
                marginTop: 40 * k,
                width: 112 * k,
                height: 18 * k,
                borderRadius: tokens.radii.pill,
                backgroundColor: withAlpha(tokens.colours.text, 0.3),
              }}
            />
            <div
              style={{
                marginTop: 16 * k,
                width: 76 * k,
                height: 12 * k,
                borderRadius: tokens.radii.pill,
                backgroundColor: bar,
              }}
            />
            <div
              style={{
                marginTop: 52 * k,
                width: 136 * k,
                height: 46 * k,
                borderRadius: tokens.radii.pill,
                backgroundColor: tokens.colours.primary,
              }}
            />
          </div>
          {label(prop.label)}
        </div>
      );
    }

    case "signups": {
      const { size, gap } = STAGE.chip;
      const columns = signupColumns(prop.people.length, props.portrait, props.attached);
      const width = columns * size + (columns - 1) * gap;
      const waits = together(prop.people.map((person) => person.cue));
      const arrivals = prop.people.map(
        (person, i) =>
          m.child(person.cue, settled, start, Math.round(i * MOTION.stagger.auto * m.fps)) +
          (waits[i] ?? 0),
      );
      const asked = prop.ask
        ? m.child(
            prop.ask.cue,
            settled,
            arrivals.at(-1) ?? start,
            m.frames("enter") + Math.round(MOTION.stagger.auto * m.fps),
          )
        : null;
      return (
        <div style={frame}>
          {prop.people.map((person, i) => {
            const arrive = arrivals[i] ?? start;
            const shown = m.tween(arrive, "enter");
            const landed = m.spring(arrive, "settle");
            const askAt =
              asked === null ? null : asked + Math.round(i * MOTION.stagger.field * m.fps);
            const unknown = askAt === null ? 0 : m.tween(askAt, "emphasis", "move");
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: (rect.width - width * k) / 2 + (i % columns) * (size + gap) * k,
                  top: Math.floor(i / columns) * (size + gap) * k,
                  width: size * k,
                  height: size * k,
                  opacity: shown,
                  scale: m.reducedMotion ? "1" : String(mix(MOTION.scale.enterFrom, 1, landed)),
                }}
              >
                <div style={{ opacity: mix(1, MOTION.focus.recede, unknown) }}>
                  <FaceGlyph seed={person.face} size={size * k} />
                </div>
                {unknown > 0 ? (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: tokens.fonts.display,
                      fontWeight: 600,
                      fontSize: size * 0.62 * k,
                      lineHeight: 1,
                      color: tokens.colours.text,
                      opacity: unknown,
                    }}
                  >
                    ?
                  </div>
                ) : null}
              </div>
            );
          })}
          <div style={{ opacity: enter }}>{label(prop.label)}</div>
        </div>
      );
    }

    case "checklist": {
      const c = STAGE.checklist;
      const waits = together(prop.items.map((item) => item.cue));
      return (
        <div
          style={{
            ...frame,
            ...panel,
            boxSizing: "border-box",
            padding: `${c.padY * k}px ${c.padX * k}px`,
            borderRadius: 26 * k,
            opacity: enter,
            translate: rise(settle, MOTION.distance.rise),
          }}
        >
          {prop.title ? (
            <div
              style={{
                height: c.title * k,
                fontFamily: tokens.fonts.display,
                fontWeight: 600,
                fontSize: c.titleSize * k,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
                color: tokens.colours.text,
              }}
            >
              {prop.title}
            </div>
          ) : null}
          {prop.items.map((item, i) => {
            const at =
              m.child(
                item.cue,
                settled,
                start,
                m.frames("quick") + Math.round((i + 1) * MOTION.stagger.item * m.fps),
              ) + (waits[i] ?? 0);
            const shown = m.tween(at, "enter");
            const stamped = item.status
              ? m.spring(m.child(item.statusCue, settled, at, m.frames("emphasis")), "snap")
              : 0;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 18 * k,
                  marginTop: i === 0 ? 0 : c.row * k,
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: c.mark * k,
                    height: c.mark * k,
                    flexShrink: 0,
                    marginTop: (c.size * 1.2 - c.mark) * 0.5 * k,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 2 * k,
                      borderRadius: tokens.radii.pill,
                      border: `${3 * k}px solid ${tokens.colours.hairlineStrong}`,
                      opacity: 1 - Math.min(1, Math.max(0, stamped)),
                    }}
                  />
                  {item.status ? (
                    <div style={{ position: "absolute", inset: 0 }}>
                      <StatusMark status={item.status} size={c.mark * k} progress={stamped} />
                    </div>
                  ) : null}
                </div>
                <div style={{ position: "relative", flexGrow: 1 }}>
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: c.size * 0.39 * k,
                      width: "62%",
                      height: c.size * 0.42 * k,
                      borderRadius: tokens.radii.pill,
                      backgroundColor: withAlpha(tokens.colours.text, 0.1),
                      // The empty slot is gone before the words arrive, so it never strikes them out.
                      opacity: 1 - Math.min(1, shown / 0.4),
                    }}
                  />
                  <div
                    style={{
                      fontFamily: tokens.fonts.sans,
                      fontWeight: 500,
                      fontSize: c.size * k,
                      lineHeight: 1.2,
                      color: tokens.colours.text,
                      opacity: Math.max(0, (shown - 0.4) / 0.6),
                    }}
                  >
                    {item.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    case "card": {
      const c = STAGE.card;
      return (
        <div
          style={{
            ...frame,
            ...panel,
            boxSizing: "border-box",
            padding: c.pad * k,
            borderRadius: 24 * k,
            display: "flex",
            alignItems: "center",
            gap: 22 * k,
            opacity: enter,
            translate: rise(settle, MOTION.distance.rise),
          }}
        >
          <div
            style={{
              width: c.avatar * k,
              height: c.avatar * k,
              flexShrink: 0,
              borderRadius: tokens.radii.pill,
              backgroundColor: withAlpha(tokens.colours.text, 0.08),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="person" size={c.avatar * 0.56 * k} colour={tokens.colours.textMuted} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: tokens.fonts.display,
                fontWeight: 600,
                fontSize: c.nameSize * k,
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
                color: tokens.colours.text,
              }}
            >
              {prop.name}
            </div>
            {prop.detail ? (
              <div
                style={{
                  marginTop: 4 * k,
                  fontFamily: tokens.fonts.sans,
                  fontSize: c.detailSize * k,
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                  color: tokens.colours.textMuted,
                }}
              >
                {prop.detail}
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    case "keyword": {
      const w = STAGE.keyword;
      const size = k * keywordScale(props.portrait, props.attached);
      const lines = keywordLines(prop.text);
      const short = prop.short;
      const shortAt = short
        ? m.child(short.cue, settled, start, m.frames("enter") + m.seconds(MOTION.stagger.auto))
        : null;
      const picked = shortAt === null ? 0 : m.tween(shortAt, "emphasis", "move");
      const initials = short !== undefined && isInitialism(prop.text, short.text);
      const arrived = shortAt === null ? 0 : m.tween(shortAt + m.frames("quick"), "enter");
      const rest = interpolateColors(
        picked,
        [0, 1],
        [tokens.colours.text, tokens.colours.textMuted],
      );
      const first = interpolateColors(
        picked,
        [0, 1],
        [tokens.colours.text, tokens.colours.primary],
      );
      return (
        <div style={frame}>
          {lines.map((line, i) => {
            const at = m.child(
              undefined,
              settled,
              start,
              Math.round(i * MOTION.stagger.item * m.fps),
            );
            const shown = m.tween(at, "enter");
            return (
              <div
                key={i}
                style={{
                  fontFamily: tokens.fonts.display,
                  fontWeight: 600,
                  fontSize: w.size * size,
                  lineHeight: w.lineHeight,
                  letterSpacing: "-0.04em",
                  whiteSpace: "nowrap",
                  color: rest,
                  opacity: shown,
                  translate: rise(shown, MOTION.distance.rise),
                }}
              >
                {initials ? (
                  <>
                    <span style={{ color: first }}>{line.charAt(0)}</span>
                    {line.slice(1)}
                  </>
                ) : (
                  line
                )}
              </div>
            );
          })}
          {short ? (
            <div
              style={{
                marginTop: w.gap * size,
                fontFamily: tokens.fonts.display,
                fontWeight: 700,
                fontSize: w.shortSize * size,
                lineHeight: 0.94,
                letterSpacing: "-0.05em",
                whiteSpace: "nowrap",
                color: tokens.colours.primary,
                opacity: arrived,
                translate: rise(arrived, MOTION.distance.rise),
              }}
            >
              {short.text}
            </div>
          ) : null}
        </div>
      );
    }

    case "tiles": {
      const t = STAGE.tile;
      const waits = together(prop.items.map((item) => item.cue));
      return (
        <div style={{ ...frame, display: "flex", justifyContent: "space-between" }}>
          {prop.items.map((item, i) => {
            const at =
              m.child(item.cue, settled, start, m.seconds(i * MOTION.stagger.auto)) +
              (waits[i] ?? 0);
            const shown = m.tween(at, "enter");
            const landed = m.spring(at, "settle");
            const stamped = item.status
              ? m.spring(m.child(item.statusCue, settled, at, m.frames("emphasis")), "snap")
              : 0;
            return (
              <div
                key={i}
                style={{
                  width: t.width * k,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: t.gap * k,
                  opacity: shown,
                  translate: rise(landed, MOTION.distance.rise),
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: t.size * k,
                    height: t.size * k,
                    boxSizing: "border-box",
                    borderRadius: 32 * k,
                    backgroundColor: tokens.colours.surfaceRaised,
                    border: `${3 * k}px solid ${tokens.colours.hairlineStrong}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon
                    name={TILE_ICON[item.icon]}
                    size={t.size * 0.52 * k}
                    colour={tokens.colours.text}
                  />
                  {item.status ? (
                    <div
                      style={{
                        position: "absolute",
                        right: -12 * k,
                        bottom: -12 * k,
                        borderRadius: tokens.radii.pill,
                        backgroundColor: tokens.colours.background,
                      }}
                    >
                      <StatusMark status={item.status} size={50 * k} progress={stamped} />
                    </div>
                  ) : null}
                </div>
                {item.label ? (
                  <div
                    style={{
                      fontFamily: tokens.fonts.sans,
                      fontWeight: 500,
                      fontSize: t.labelSize * k,
                      lineHeight: 1.2,
                      textAlign: "center",
                      textWrap: "balance",
                      color: tokens.colours.textSoft,
                    }}
                  >
                    {item.label}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      );
    }
  }
}
