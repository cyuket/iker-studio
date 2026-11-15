import { estimateLines, fitFontSize, type Rect } from "../design/layout";

export interface StoryLineInput {
  text: string;
  role: "lead" | "support" | "key";
  /** The line carries a status mark at its start. */
  marked: boolean;
}

export interface StoryLineBox {
  /** Top of the line's block, in the body's coordinates. */
  y: number;
  height: number;
  size: number;
  lineHeight: number;
  /** Space taken at the start of the line by its mark; 0 without one. */
  indent: number;
}

export interface StoryLayoutInput {
  body: Rect;
  portrait: boolean;
  /** Output pixels per design pixel. */
  unit: number;
  lines: readonly StoryLineInput[];
}

const SIZE = {
  lead: { landscape: 92, portrait: 78, lineHeight: 1.04, charWidth: 0.5 },
  key: { landscape: 92, portrait: 78, lineHeight: 1.04, charWidth: 0.5 },
  support: { landscape: 50, portrait: 48, lineHeight: 1.24, charWidth: 0.5 },
} as const;

/**
 * Sets a handful of lines as one typographic block: hierarchy comes from size alone. Each
 * line wraps within the body, and if the block is taller than the body every size steps
 * down together, so the proportions between the lines are kept.
 */
export function layoutStory(input: StoryLayoutInput): StoryLineBox[] {
  const { body, portrait, unit, lines } = input;
  const width = Math.min(body.width, (portrait ? 866 : 1500) * unit);
  let scale = 1;
  let boxes: StoryLineBox[] = [];
  for (let attempt = 0; attempt < 12; attempt += 1) {
    let y = 0;
    boxes = lines.map((line, i) => {
      const spec = SIZE[line.role];
      const preferred = (portrait ? spec.portrait : spec.landscape) * unit * scale;
      const indent = line.marked ? preferred * 1.35 : 0;
      const size = fitFontSize({
        text: line.text,
        maxWidth: width - indent,
        maxLines: line.role === "support" ? 3 : portrait ? 4 : 2,
        size: preferred,
        minSize: preferred * 0.6,
        charWidth: spec.charWidth,
      });
      const rows = estimateLines(line.text, width - indent, size, spec.charWidth);
      const height = rows * size * spec.lineHeight;
      const previous = lines[i - 1];
      const gap =
        i === 0
          ? 0
          : (previous?.role === "support" && line.role === "support" ? 22 : 44) * unit * scale;
      y += gap;
      const box = {
        y,
        height,
        size,
        lineHeight: spec.lineHeight,
        indent: line.marked ? size * 1.35 : 0,
      };
      y += height;
      return box;
    });
    const total = y;
    if (total <= body.height) {
      const top = body.y + (body.height - total) / 2;
      return boxes.map((box) => ({ ...box, y: box.y + top }));
    }
    scale *= Math.max(0.7, (body.height / total) * 0.98);
  }
  return boxes.map((box) => ({ ...box, y: box.y + body.y }));
}
