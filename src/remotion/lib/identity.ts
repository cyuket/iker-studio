import type { Rect } from "../design/layout";
import { trimLine, unionRects, type PathSpec, type Point } from "./geometry";

/** Where a card's face glyph sits: overlapping its top edge, beside it, or inside it. */
export type FacePlacement = "top" | "side" | "inside";

export interface IdentityCardMetrics {
  /** Output pixels per design pixel, including the layout's own scale. */
  k: number;
  width: number;
  height: number;
  placement: FacePlacement;
  /** Face glyph relative to the card's top-left corner. May lie outside the card. */
  face: { cx: number; cy: number; r: number };
  paddingX: number;
  name: { x: number; y: number; width: number; height: number; size: number; centred: boolean };
  fields: { y: number; rowHeight: number; size: number; icon: number };
  /** Progress segments and status line; null when the card has no steps. */
  footer: { y: number; barHeight: number; lineY: number; lineHeight: number; size: number } | null;
  radius: number;
}

export interface CardMetricsInput {
  k: number;
  width: number;
  fields: number;
  hasSteps: boolean;
  placement: FacePlacement;
  /** Face diameter in design pixels. */
  faceDiameter: number;
}

/** Every measurement of an identity card, from its width and what it has to hold. */
export function identityCardMetrics(input: CardMetricsInput): IdentityCardMetrics {
  const { k, width, placement } = input;
  const d = input.faceDiameter * k;
  const paddingX = 34 * k;
  const nameHeight = 56 * k;
  const rowHeight = 58 * k;
  let face: IdentityCardMetrics["face"];
  let nameX = paddingX;
  let nameY: number;
  let nameWidth = width - paddingX * 2;
  let fieldsY: number;
  if (placement === "top") {
    face = { cx: width / 2, cy: -d / 4, r: d / 2 };
    nameY = d / 4 + 20 * k;
    fieldsY = nameY + nameHeight + 18 * k;
  } else if (placement === "side") {
    face = { cx: -(24 * k + d / 2), cy: d / 2, r: d / 2 };
    nameY = 28 * k;
    fieldsY = nameY + nameHeight + 14 * k;
  } else {
    face = { cx: paddingX + d / 2, cy: 30 * k + d / 2, r: d / 2 };
    nameX = paddingX + d + 24 * k;
    nameWidth = width - nameX - paddingX;
    nameY = 30 * k + d / 2 - nameHeight / 2;
    fieldsY = 30 * k + d + 22 * k;
  }
  const fieldsEnd = fieldsY + input.fields * rowHeight;
  const footer = input.hasSteps
    ? {
        y: fieldsEnd + 18 * k,
        barHeight: 6 * k,
        lineY: fieldsEnd + 18 * k + 6 * k + 18 * k,
        lineHeight: 44 * k,
        size: 30 * k,
      }
    : null;
  const height = (footer ? footer.lineY + footer.lineHeight : fieldsEnd) + 28 * k;
  return {
    k,
    width,
    height,
    placement,
    face,
    paddingX,
    name: {
      x: nameX,
      y: nameY,
      width: nameWidth,
      height: nameHeight,
      size: 42 * k,
      centred: placement === "top",
    },
    fields: { y: fieldsY, rowHeight, size: 31 * k, icon: 30 * k },
    footer,
    radius: 22 * k,
  };
}

export interface IdentityLayoutInput {
  /** Box the cards are laid out in. */
  body: Rect;
  portrait: boolean;
  /** Output pixels per design pixel. */
  unit: number;
  accounts: readonly { id: string; fields: number; steps: number }[];
  /** A label sits between cards (time passing), so the gap must hold it. */
  hasGaps: boolean;
  hasMatch: boolean;
}

export interface IdentityCardSlot {
  id: string;
  rect: Rect;
  /** Face glyph in the body's coordinates. */
  face: { cx: number; cy: number; r: number };
}

export interface IdentityLayout {
  metrics: IdentityCardMetrics;
  cards: IdentityCardSlot[];
  /** Centre of the space after each card, where a "time passes" label goes. */
  gaps: { after: string; centre: Point; length: number }[];
  /** Everything drawn, faces included. Always inside the body. */
  bounds: Rect;
}

const LANDSCAPE = [
  { card: 540, gap: 110, wideGap: 230, face: 144 },
  { card: 540, gap: 110, wideGap: 230, face: 144 },
  { card: 430, gap: 70, wideGap: 150, face: 112 },
  { card: 360, gap: 48, wideGap: 110, face: 96 },
] as const;
const PORTRAIT_FACE = [124, 124, 100, 84] as const;

/**
 * Places one to four identity cards. Landscape sets them in a row with each face
 * overlapping the top of its card, so faces share a line that a match can be drawn along.
 * Portrait stacks them with the faces in a column down the left for the same reason. The
 * whole group is scaled to fill the body without ever leaving it.
 */
export function layoutIdentityStory(input: IdentityLayoutInput): IdentityLayout {
  const { body, portrait, unit, accounts } = input;
  const count = Math.max(1, accounts.length);
  const fields = Math.max(0, ...accounts.map((account) => account.fields));
  const hasSteps = accounts.some((account) => account.steps > 0);
  const index = Math.min(count, 4) - 1;

  if (!portrait) {
    const spec = LANDSCAPE[index] ?? LANDSCAPE[0];
    const gap = input.hasGaps ? spec.wideGap : spec.gap;
    const probe = identityCardMetrics({
      k: 1,
      width: spec.card,
      fields,
      hasSteps,
      placement: "top",
      faceDiameter: spec.face,
    });
    const blockWidth = count * spec.card + (count - 1) * gap;
    const blockHeight = spec.face * 0.75 + probe.height;
    const scale = Math.min(
      1.3,
      body.width / unit / blockWidth,
      (body.height * 0.94) / unit / blockHeight,
    );
    const k = unit * scale;
    const metrics = identityCardMetrics({
      k,
      width: spec.card * k,
      fields,
      hasSteps,
      placement: "top",
      faceDiameter: spec.face,
    });
    const left = body.x + (body.width - blockWidth * k) / 2;
    const top = body.y + (body.height - blockHeight * k) / 2 + spec.face * 0.75 * k;
    const cards = accounts.map((account, i) => {
      const rect = {
        x: left + i * (spec.card + gap) * k,
        y: top,
        width: metrics.width,
        height: metrics.height,
      };
      return { id: account.id, rect, face: faceIn(rect, metrics) };
    });
    return finish(metrics, cards, (a, b) => ({
      centre: { x: (a.rect.x + a.rect.width + b.rect.x) / 2, y: a.rect.y + a.rect.height / 2 },
      length: b.rect.x - (a.rect.x + a.rect.width),
    }));
  }

  const face = PORTRAIT_FACE[index] ?? PORTRAIT_FACE[0];
  const gap = input.hasGaps || input.hasMatch ? 96 : 36;
  const probe = identityCardMetrics({
    k: 1,
    width: 600,
    fields,
    hasSteps,
    placement: "side",
    faceDiameter: face,
  });
  const blockHeight = count * probe.height + (count - 1) * gap;
  const scale = Math.min(1.15, Math.max(0.5, (body.height * 0.97) / unit / blockHeight));
  const k = unit * scale;
  const column = (face + 24) * k;
  const metrics = identityCardMetrics({
    k,
    width: body.width - column,
    fields,
    hasSteps,
    placement: "side",
    faceDiameter: face,
  });
  const top = body.y + Math.max(0, (body.height - blockHeight * k) / 2);
  const cards = accounts.map((account, i) => {
    const rect = {
      x: body.x + column,
      y: top + i * (probe.height + gap) * k,
      width: metrics.width,
      height: metrics.height,
    };
    return { id: account.id, rect, face: faceIn(rect, metrics) };
  });
  return finish(metrics, cards, (a, b) => ({
    centre: { x: a.rect.x + a.rect.width / 2, y: (a.rect.y + a.rect.height + b.rect.y) / 2 },
    length: b.rect.y - (a.rect.y + a.rect.height),
  }));
}

function faceIn(rect: Rect, metrics: IdentityCardMetrics): IdentityCardSlot["face"] {
  return { cx: rect.x + metrics.face.cx, cy: rect.y + metrics.face.cy, r: metrics.face.r };
}

function finish(
  metrics: IdentityCardMetrics,
  cards: IdentityCardSlot[],
  between: (a: IdentityCardSlot, b: IdentityCardSlot) => { centre: Point; length: number },
): IdentityLayout {
  const gaps = cards.slice(0, -1).flatMap((card, i) => {
    const next = cards[i + 1];
    return next ? [{ after: card.id, ...between(card, next) }] : [];
  });
  const bounds = unionRects(
    cards.flatMap((card) => [
      card.rect,
      {
        x: card.face.cx - card.face.r,
        y: card.face.cy - card.face.r,
        width: card.face.r * 2,
        height: card.face.r * 2,
      },
    ]),
  );
  return { metrics, cards, gaps, bounds };
}

/**
 * Groups of account ids that are to be shown as the same person. By default every face
 * seed used by more than one account forms a group; an explicit list forms exactly one.
 */
export function matchGroups(
  accounts: readonly { id: string; face: string }[],
  explicit?: readonly string[],
): string[][] {
  if (explicit) {
    const known = explicit.filter((id) => accounts.some((account) => account.id === id));
    return known.length >= 2 ? [known] : [];
  }
  const bySeed = new Map<string, string[]>();
  for (const account of accounts) {
    const seed = account.face.trim().toLowerCase();
    bySeed.set(seed, [...(bySeed.get(seed) ?? []), account.id]);
  }
  return [...bySeed.values()].filter((group) => group.length >= 2);
}

/** Straight links between consecutive faces of a group, stopping short of each glyph. */
export function matchLinks(
  layout: IdentityLayout,
  group: readonly string[],
  clearance: number,
): PathSpec[] {
  const faces = group.flatMap((id) => {
    const card = layout.cards.find((slot) => slot.id === id);
    return card ? [card.face] : [];
  });
  return faces.slice(0, -1).flatMap((from, i) => {
    const to = faces[i + 1];
    if (!to) return [];
    return [
      trimLine(
        { x: from.cx, y: from.cy },
        { x: to.cx, y: to.cy },
        from.r + clearance,
        to.r + clearance,
      ),
    ];
  });
}
