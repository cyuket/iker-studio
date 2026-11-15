import type { CharacterSceneProp, CharacterSceneVisualData } from "../../domain/storyboard";
import { estimateLines, type Rect } from "../design/layout";
import { FIGURE, NICHE } from "./character";
import { unionRects, type PathSpec, type Point } from "./geometry";

/** Sizes of everything on a character stage, in design pixels. */
export const STAGE = {
  /** Height of the name under a figure, and its type size. */
  name: 62,
  nameSize: 38,
  /** Largest the stage is ever drawn, as a multiple of its design size. */
  maxScale: { landscape: 1.8, portrait: 2 },
  /** Space between two things standing side by side, and between two rows in portrait. */
  gap: 64,
  rowGap: 44,
  /** Space kept open for something handed from one character to another. */
  sendGap: 250,
  sendRowGap: 152,
  /** Edge of the tile that is handed over. */
  sendTile: 104,
  /** Diameter of the status mark on a character. */
  status: 82,
  /** Width of what stands beside a figure in portrait: their bubble and their props. */
  side: 440,
  sideGap: 26,
  /** Space between a figure and what belongs to it. */
  attach: 22,
  bubble: { size: 36, lineHeight: 1.22, padX: 30, padY: 22, tail: 22, width: 400 },
  checklist: { padX: 30, padY: 26, title: 60, titleSize: 38, row: 22, size: 35, mark: 44 },
  card: { width: 400, pad: 24, avatar: 76, nameSize: 36, detailSize: 30 },
  chip: { size: 108, gap: 22 },
  tile: { size: 132, width: 172, gap: 16, labelSize: 31 },
  app: { width: 196, height: 356 },
  label: { height: 56, size: 34 },
  keyword: { size: 84, shortSize: 150, gap: 20, lineHeight: 1.03, portrait: 1.34 },
} as const;

/** Widest a portrait row may be, in design pixels: a figure and what stands beside it. */
const PORTRAIT_ROW = FIGURE.width + STAGE.sideGap + STAGE.side;
const CHAR_WIDTH = 0.52;

/** Width of a line of display type, which is set wider than body text. */
const letters = (text: string, size: number): number => text.length * size * 0.56;

/** Columns the people of a `signups` prop are set in. */
export function signupColumns(count: number, portrait: boolean, attached: boolean): number {
  if (attached) return Math.min(count, 3);
  const widest = portrait ? 4 : 3;
  return count <= widest ? count : Math.ceil(count / 2);
}

/** Rows of text a checklist item takes at a given checklist width. */
export function checklistRows(label: string, width: number): number {
  const { padX, mark, size } = STAGE.checklist;
  return estimateLines(label, width - padX * 2 - mark - 18, size, CHAR_WIDTH);
}

/** Lines a keyword is set on: a word each for a short term, wrapped otherwise. */
export function keywordLines(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 4) return words;
  const lines: string[] = [];
  for (const word of words) {
    const last = lines.at(-1);
    if (last !== undefined && last.length + word.length < 18)
      lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

/** A keyword on its own in portrait has a row to itself, so it is set larger. */
export function keywordScale(portrait: boolean, attached: boolean): number {
  return portrait && !attached ? STAGE.keyword.portrait : 1;
}

/** True when the short form is the initials of the term, so the initials can become it. */
export function isInitialism(text: string, short: string): boolean {
  const initials = text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0))
    .join("");
  return initials.length > 1 && initials.toLowerCase() === short.trim().toLowerCase();
}

/**
 * How much room a prop needs, in design pixels. `attached` is a prop that belongs to a
 * character and so has to fit the width of a figure or of the column beside one.
 */
export function propSize(
  prop: CharacterSceneProp,
  portrait: boolean,
  attached: boolean,
): { width: number; height: number } {
  const label = (text: string | undefined): number => (text ? STAGE.label.height : 0);
  switch (prop.kind) {
    case "app":
      return {
        width: Math.max(STAGE.app.width, prop.label ? 300 : 0),
        height: STAGE.app.height + label(prop.label),
      };
    case "signups": {
      const columns = signupColumns(prop.people.length, portrait, attached);
      const rows = Math.ceil(prop.people.length / columns);
      const { size, gap } = STAGE.chip;
      return {
        width: Math.max(columns * size + (columns - 1) * gap, prop.label ? 320 : 0),
        height: rows * size + (rows - 1) * gap + label(prop.label),
      };
    }
    case "checklist": {
      const width = attached ? (portrait ? STAGE.side : FIGURE.width + 40) : portrait ? 640 : 520;
      const c = STAGE.checklist;
      const rows = prop.items.reduce(
        (sum, item) => sum + checklistRows(item.label, width) * c.size * 1.2 + c.row,
        0,
      );
      return { width, height: c.padY * 2 + (prop.title ? c.title : 0) + rows - c.row };
    }
    case "card": {
      const { pad, avatar, width } = STAGE.card;
      return { width, height: pad * 2 + avatar };
    }
    case "keyword": {
      const k = STAGE.keyword;
      const scale = keywordScale(portrait, attached);
      const lines = keywordLines(prop.text);
      const longest = Math.max(...lines.map((line) => letters(line, k.size)));
      const short = prop.short ? letters(prop.short.text, k.shortSize) * 1.16 : 0;
      return {
        width: Math.ceil((Math.max(longest, short) + 8) * scale),
        height:
          (lines.length * k.size * k.lineHeight + (prop.short ? k.gap + k.shortSize * 0.94 : 0)) *
          scale,
      };
    }
    case "tiles": {
      const t = STAGE.tile;
      const labelled = prop.items.some((item) => item.label);
      return {
        width: prop.items.length * t.width + (prop.items.length - 1) * 12,
        height: t.size + (labelled ? t.gap + t.labelSize * 1.2 * 2 : 0),
      };
    }
  }
}

/** Lines of the longest bubble a character has, and so the room to keep for it. */
function bubbleHeight(texts: readonly string[]): number {
  const b = STAGE.bubble;
  if (texts.length === 0) return 0;
  const lines = Math.max(
    ...texts.map((text) => estimateLines(text, b.width - b.padX * 2, b.size, CHAR_WIDTH)),
  );
  return lines * b.size * b.lineHeight + b.padY * 2;
}

export interface FigureSlot {
  id: string;
  /** The box the character is drawn in. */
  rect: Rect;
  /** Where the name goes; null for a character without one. */
  name: Rect | null;
  /** Room kept for the character's bubbles; null when they never say or think anything. */
  bubble: Rect | null;
  /** Which way a bubble's tail points to reach the head. */
  bubbleTail: "down" | "left";
  /** The busy arm is on the viewer's left: the character gestures towards the others. */
  mirrored: boolean;
}

export interface PropSlot {
  id: string;
  rect: Rect;
  /** Belongs to a character, rather than standing on the stage on its own. */
  attached: boolean;
}

export interface SendSlot {
  /** The way the object travels, ending at the middle of where it comes to rest. */
  path: PathSpec;
  /** Where the tile rests, and where its label goes. */
  tile: Rect;
  label: Rect;
}

export interface CharacterSceneLayout {
  /** Output pixels per design pixel, including the layout's own scale. */
  k: number;
  figures: FigureSlot[];
  props: PropSlot[];
  /** One per send, in the order given; null when either end is missing. */
  sends: (SendSlot | null)[];
  /** Everything drawn at rest. Always inside the body. */
  bounds: Rect;
}

export interface CharacterSceneLayoutInput {
  body: Rect;
  portrait: boolean;
  /** Output pixels per design pixel. */
  unit: number;
  visual: Pick<CharacterSceneVisualData, "cast" | "props" | "stage" | "actions" | "sends">;
}

/** One thing standing on the stage: a character with what belongs to them, or a prop. */
interface Group {
  id: string;
  character: boolean;
  width: number;
  height: number;
  /** Positions inside the group, relative to its top-left corner. */
  figure: Rect | null;
  name: Rect | null;
  bubble: Rect | null;
  props: { id: string; rect: Rect }[];
  /** Where the middle of a figure is, so a row of figures can share a line. */
  axis: number;
  wide: boolean;
}

const at = (rect: Rect, x: number, y: number): Rect => ({ ...rect, x: rect.x + x, y: rect.y + y });
/** The part of a figure's box its niche fills. */
const insetFigure = (rect: Rect): Rect => ({
  x: rect.x + NICHE.x,
  y: rect.y + NICHE.y,
  width: NICHE.width,
  height: rect.height - NICHE.y,
});
/** A bubble is counted as wide as the niche it speaks from, however much it says. */
const insetBubble = (rect: Rect): Rect => ({
  ...rect,
  x: rect.x + (rect.width - NICHE.width) / 2,
  width: NICHE.width,
});
/** A name is centred under its figure and far narrower than the room kept for it. */
const nameInk = (rect: Rect): Rect => ({ ...rect, x: rect.x + rect.width / 2 - 1, width: 2 });

/**
 * Sets a cast and their props on a stage. Landscape is one row: each character stands in a
 * column with their bubble above and what belongs to them below. Portrait is a column of
 * rows: a character's bubble and props stand beside them, and two things only share a row
 * when both are narrow and nothing is handed between them. Either way the whole stage is
 * scaled to fill the body without leaving it.
 */
export function layoutCharacterScene(input: CharacterSceneLayoutInput): CharacterSceneLayout {
  const { body, portrait, unit, visual } = input;
  const cast = new Set(visual.cast.map((character) => character.id));
  const free = visual.props.filter((prop) => prop.with === undefined || !cast.has(prop.with));
  const known = [...visual.cast.map((character) => character.id), ...free.map((prop) => prop.id)];
  const listed = (visual.stage ?? []).filter(
    (id, i, all) => known.includes(id) && all.indexOf(id) === i,
  );
  const order = [...listed, ...known.filter((id) => !listed.includes(id))];

  const named = visual.cast.some((character) => character.name);
  const everyoneOwns = visual.cast.every((character) =>
    visual.props.some((prop) => prop.with === character.id),
  );
  /** Something is handed between this character and one further right, across their right side. */
  const handsRight = (id: string): boolean =>
    visual.sends.some((send) => {
      const other = send.from === id ? send.to : send.to === id ? send.from : undefined;
      return other !== undefined && order.indexOf(other) > order.indexOf(id);
    });
  const groups = order.map((id): Group => {
    const character = visual.cast.find((entry) => entry.id === id);
    if (!character) {
      const prop = free.find((entry) => entry.id === id);
      const size = prop ? propSize(prop, portrait, false) : { width: 0, height: 0 };
      return {
        id,
        character: false,
        ...size,
        figure: null,
        name: null,
        bubble: null,
        props: [{ id, rect: { x: 0, y: 0, ...size } }],
        axis: size.height / 2,
        wide: size.width > FIGURE.width,
      };
    }
    const bubbles = visual.actions
      .filter((action) => action.who === id)
      .flatMap((action) => [action.say, action.think])
      .filter((text) => text !== undefined);
    const bubble = bubbleHeight(bubbles);
    const owned = visual.props
      .filter((prop) => prop.with === id)
      .map((prop) => ({ id: prop.id, size: propSize(prop, portrait, true) }));
    // Every figure keeps room for a name as soon as one has one, so what hangs below lines up.
    const nameHeight = named ? STAGE.name : 0;

    if (!portrait && owned.length > 0 && !everyoneOwns && !handsRight(id)) {
      // Only some of the cast have something: it stands beside them, so the figures keep one
      // line through the middle of the stage instead of hanging from its top.
      const top = bubble > 0 ? bubble + STAGE.bubble.tail : 0;
      const sideX = FIGURE.width + STAGE.sideGap;
      const sideWidth = Math.max(...owned.map((prop) => prop.size.width));
      const sideHeight =
        owned.reduce((sum, prop) => sum + prop.size.height, 0) + (owned.length - 1) * STAGE.attach;
      const lift = Math.max(0, sideHeight / 2 - (top + FIGURE.height / 2));
      let y = lift + top + FIGURE.height / 2 - sideHeight / 2;
      const props = owned.map((prop) => {
        const rect = { x: sideX + (sideWidth - prop.size.width) / 2, y, ...prop.size };
        y += prop.size.height + STAGE.attach;
        return { id: prop.id, rect };
      });
      return {
        id,
        character: true,
        width: sideX + sideWidth,
        height: Math.max(lift + top + FIGURE.height + nameHeight, y - STAGE.attach),
        figure: { x: 0, y: lift + top, ...FIGURE },
        name: character.name
          ? { x: 0, y: lift + top + FIGURE.height, width: FIGURE.width, height: nameHeight }
          : null,
        bubble: bubble > 0 ? { x: 0, y: lift, width: STAGE.bubble.width, height: bubble } : null,
        props,
        axis: lift + top + FIGURE.height / 2,
        wide: true,
      };
    }

    if (!portrait) {
      const width = Math.max(
        FIGURE.width,
        STAGE.bubble.width,
        ...owned.map((prop) => prop.size.width),
      );
      const top = bubble > 0 ? bubble + STAGE.bubble.tail : 0;
      const figure = { x: (width - FIGURE.width) / 2, y: top, ...FIGURE };
      let y = top + FIGURE.height + nameHeight;
      const props = owned.map((prop) => {
        y += STAGE.attach;
        const rect = { x: (width - prop.size.width) / 2, y, ...prop.size };
        y += prop.size.height;
        return { id: prop.id, rect };
      });
      return {
        id,
        character: true,
        width,
        height: y,
        figure,
        name: character.name ? { x: 0, y: top + FIGURE.height, width, height: nameHeight } : null,
        bubble:
          bubble > 0
            ? {
                x: (width - STAGE.bubble.width) / 2,
                y: 0,
                width: STAGE.bubble.width,
                height: bubble,
              }
            : null,
        props,
        axis: top + FIGURE.height / 2,
        wide: true,
      };
    }

    const hasSide = bubble > 0 || owned.length > 0;
    const figureHeight = FIGURE.height + nameHeight;
    const sideHeight =
      bubble +
      owned.reduce((sum, prop) => sum + prop.size.height, 0) +
      Math.max(0, owned.length - (bubble > 0 ? 0 : 1)) * STAGE.attach;
    const height = Math.max(figureHeight, sideHeight);
    const figureTop = (height - figureHeight) / 2;
    const sideX = FIGURE.width + STAGE.sideGap;
    // A bubble sits level with the head it comes from; props alone sit level with the figure.
    let y = bubble > 0 ? Math.min(figureTop + 40, height - sideHeight) : (height - sideHeight) / 2;
    const bubbleRect =
      bubble > 0 ? { x: sideX, y, width: STAGE.bubble.width, height: bubble } : null;
    if (bubble > 0) y += bubble + STAGE.attach;
    const props = owned.map((prop) => {
      const rect = { x: sideX, y, ...prop.size };
      y += prop.size.height + STAGE.attach;
      return { id: prop.id, rect };
    });
    return {
      id,
      character: true,
      width: hasSide ? PORTRAIT_ROW : FIGURE.width,
      height,
      figure: { x: 0, y: figureTop, ...FIGURE },
      name: character.name
        ? { x: 0, y: figureTop + FIGURE.height, width: FIGURE.width, height: nameHeight }
        : null,
      bubble: bubbleRect,
      props,
      axis: figureTop + FIGURE.height / 2,
      wide: hasSide,
    };
  });

  const linked = (a: string, b: string): boolean =>
    visual.sends.some(
      (send) => (send.from === a && send.to === b) || (send.from === b && send.to === a),
    );

  // Place every group in design pixels, then scale the lot to the body.
  type Placed = { group: Group; x: number; y: number }[];
  const inRow = (): Placed => {
    const axis = Math.max(0, ...groups.map((group) => group.axis));
    let x = 0;
    return groups.map((group, i) => {
      const previous = groups[i - 1];
      if (previous) x += linked(previous.id, group.id) ? STAGE.sendGap : STAGE.gap;
      const slot = { group, x, y: axis - group.axis };
      x += group.width;
      return slot;
    });
  };
  const inRows = (pair: boolean): Placed => {
    const rows: Group[][] = [];
    for (const group of groups) {
      const row = rows.at(-1);
      const partner = row?.length === 1 ? row[0] : undefined;
      if (
        pair &&
        row &&
        partner &&
        !partner.wide &&
        !group.wide &&
        !linked(partner.id, group.id) &&
        partner.width + STAGE.sideGap + group.width <= PORTRAIT_ROW
      ) {
        row.push(group);
      } else rows.push([group]);
    }
    const sided = groups.some((group) => group.character && group.wide);
    const slots: Placed = [];
    let y = 0;
    rows.forEach((row, i) => {
      const above = rows[i - 1];
      if (above) {
        const handed = above.some((a) => row.some((b) => linked(a.id, b.id)));
        y += handed ? STAGE.sendRowGap : STAGE.rowGap;
      }
      const width =
        row.reduce((sum, group) => sum + group.width, 0) + (row.length - 1) * STAGE.sideGap;
      // Things that share a row share the line through the middle of a figure.
      const axis = Math.max(...row.map((group) => group.axis));
      const height = Math.max(...row.map((group) => axis - group.axis + group.height));
      // Figures keep to one column down the left as soon as anybody has something beside them.
      let x = row[0]?.character && sided ? 0 : (PORTRAIT_ROW - width) / 2;
      for (const group of row) {
        slots.push({ group, x, y: y + axis - group.axis });
        x += group.width + STAGE.sideGap;
      }
      y += height;
    });
    return slots;
  };
  const fit = (slots: Placed): { slots: Placed; design: Rect; scale: number } => {
    const design = unionRects(
      slots.map(({ group, x, y }) => ({ x, y, width: group.width, height: group.height })),
    );
    const scale = Math.min(
      portrait ? STAGE.maxScale.portrait : STAGE.maxScale.landscape,
      body.width / unit / Math.max(1, design.width),
      body.height / unit / Math.max(1, design.height),
    );
    return { slots, design, scale };
  };
  // Portrait tries narrow things two to a row and one to a row, and keeps whichever lets the
  // stage be drawn larger: a figure and a small prop fill the body better one above the other.
  const options = portrait ? [fit(inRows(true)), fit(inRows(false))] : [fit(inRow())];
  const best = options.reduce((a, b) => (b.scale > a.scale + 0.001 ? b : a));
  const { slots: placed, design, scale } = best;
  const k = unit * scale;
  // What is centred is what is seen: a figure's niche, not the empty margin of its box that
  // only a raised arm ever reaches. The boxes themselves still never leave the body.
  const seen = unionRects(
    placed.flatMap(({ group, x, y }) => [
      ...(group.figure ? [at(insetFigure(group.figure), x, y)] : []),
      ...(group.name ? [at(nameInk(group.name), x, y)] : []),
      ...(group.bubble ? [at(insetBubble(group.bubble), x, y)] : []),
      ...group.props.map((prop) => at(prop.rect, x, y)),
    ]),
  );
  const centre = (
    bodyStart: number,
    bodySize: number,
    start: number,
    size: number,
    ink: Rect,
    axis: "x" | "y",
  ): number => {
    const inkStart = axis === "x" ? ink.x : ink.y;
    const inkSize = axis === "x" ? ink.width : ink.height;
    const wanted = bodyStart + (bodySize - inkSize * k) / 2 - inkStart * k;
    const lowest = bodyStart + bodySize - (start + size) * k;
    const highest = bodyStart - start * k;
    return Math.min(Math.max(wanted, Math.min(lowest, highest)), Math.max(lowest, highest));
  };
  const origin = {
    x: centre(body.x, body.width, design.x, design.width, seen, "x"),
    y: centre(body.y, body.height, design.y, design.height, seen, "y"),
  };
  const out = (rect: Rect): Rect => ({
    x: origin.x + rect.x * k,
    y: origin.y + rect.y * k,
    width: rect.width * k,
    height: rect.height * k,
  });
  const middle = origin.x + (seen.x + seen.width / 2) * k;

  const figures: FigureSlot[] = [];
  const props: PropSlot[] = [];
  for (const { group, x, y } of placed) {
    if (group.figure) {
      const rect = out(at(group.figure, x, y));
      figures.push({
        id: group.id,
        rect,
        name: group.name ? out(at(group.name, x, y)) : null,
        bubble: group.bubble ? out(at(group.bubble, x, y)) : null,
        bubbleTail: portrait ? "left" : "down",
        mirrored: rect.x + rect.width / 2 > middle + 1,
      });
    }
    for (const prop of group.props) {
      props.push({ id: prop.id, rect: out(at(prop.rect, x, y)), attached: group.character });
    }
  }

  const sends = visual.sends.map((send): SendSlot | null => {
    const from = figures.find((figure) => figure.id === send.from);
    const to = figures.find((figure) => figure.id === send.to);
    if (!from || !to) return null;
    const tile = STAGE.sendTile * k;
    const labelWidth = (portrait ? 300 : STAGE.sendGap * 0.66) * k;
    const labelHeight = STAGE.tile.labelSize * 1.2 * 2 * k;
    const stacked = Math.abs(to.rect.y - from.rect.y) > Math.abs(to.rect.x - from.rect.x);
    let start: Point;
    let rest: Point;
    let label: Rect;
    if (stacked) {
      const down = to.rect.y > from.rect.y;
      const x = to.rect.x + to.rect.width / 2;
      const fromEdge = down
        ? from.rect.y + from.rect.height + (from.name?.height ?? 0)
        : from.rect.y;
      const toEdge = down ? to.rect.y : to.rect.y + to.rect.height + (to.name?.height ?? 0);
      start = { x: from.rect.x + from.rect.width / 2, y: fromEdge };
      rest = { x, y: (fromEdge + toEdge) / 2 };
      label = {
        x: x + tile / 2 + 20 * k,
        y: rest.y - labelHeight / 2,
        width: labelWidth,
        height: labelHeight,
      };
    } else {
      const right = to.rect.x > from.rect.x;
      const gap = STAGE.sendGap * k;
      const toEdge = right ? to.rect.x : to.rect.x + to.rect.width;
      // It leaves at the height of an outstretched hand and stops just short of the receiver.
      start = {
        x: right ? from.rect.x + from.rect.width : from.rect.x,
        y: from.rect.y + from.rect.height * 0.66,
      };
      rest = { x: toEdge + (right ? -1 : 1) * gap * 0.36, y: to.rect.y + to.rect.height * 0.56 };
      label = {
        x: rest.x - labelWidth / 2,
        y: rest.y + tile / 2 + 12 * k,
        width: labelWidth,
        height: labelHeight,
      };
    }
    const lift = stacked ? 0 : Math.abs(rest.x - start.x) * 0.22;
    return {
      path: {
        kind: "quad",
        from: start,
        control: { x: (start.x + rest.x) / 2, y: Math.min(start.y, rest.y) - lift },
        to: rest,
      },
      tile: { x: rest.x - tile / 2, y: rest.y - tile / 2, width: tile, height: tile },
      label,
    };
  });

  return {
    k,
    figures,
    props,
    sends,
    bounds: unionRects([
      ...figures.flatMap((figure) => [
        figure.rect,
        ...(figure.name ? [figure.name] : []),
        ...(figure.bubble ? [figure.bubble] : []),
      ]),
      ...props.map((prop) => prop.rect),
    ]),
  };
}
