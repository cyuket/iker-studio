import { estimateLines, type Rect } from "../design/layout";
import type { PathSpec } from "./geometry";

export interface TransformLayoutInput {
  body: Rect;
  portrait: boolean;
  /** Output pixels per design pixel. */
  unit: number;
  mode: "side-by-side" | "in-place";
  items: readonly { before: string; after: string }[];
}

export interface TransformLayout {
  k: number;
  textSize: number;
  /** Where the before and after titles go. In-place mode puts both in the same spot. */
  titles: { before: Rect; after: Rect };
  rows: { before: Rect; after: Rect; link: PathSpec | null }[];
}

/**
 * Pairs of states. Side by side, each item is a row: its before on the left, its after on
 * the right, joined by a link. In place, the after state takes the before state's spot. All
 * rows share one height, set by the longest text, and the block shrinks to fit the body.
 */
export function layoutTransformation(input: TransformLayoutInput): TransformLayout {
  const { body, portrait, unit, mode, items } = input;
  const split = mode === "side-by-side";
  let scale = 1;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const k = unit * scale;
    const gapX = split ? (portrait ? 64 : 180) * k : 0;
    const width = split ? (body.width - gapX) / 2 : Math.min(body.width, 1180 * k);
    const left = split ? body.x : body.x + (body.width - width) / 2;
    const textSize = (portrait ? (split ? 32 : 40) : 44) * k;
    const padX = (portrait && split ? 22 : 30) * k;
    const mark = split ? 0 : 76 * k;
    const lines = Math.max(
      1,
      ...items.flatMap((item) => [
        estimateLines(item.before, width - padX * 2 - mark, textSize),
        estimateLines(item.after, width - padX * 2 - (split ? 64 * k : mark), textSize),
      ]),
    );
    const rowHeight = lines * textSize * 1.25 + (portrait ? 52 : 64) * k;
    const rowGap = 20 * k;
    const titleHeight = (portrait ? 84 : 100) * k;
    const total = titleHeight + items.length * rowHeight + (items.length - 1) * rowGap;
    if (total > body.height && attempt < 9) {
      scale *= Math.max(0.75, (body.height / total) * 0.98);
      continue;
    }
    const top = body.y + Math.max(0, (body.height - total) / 2);
    const rightX = split ? left + width + gapX : left;
    return {
      k,
      textSize,
      titles: {
        before: { x: left, y: top, width, height: titleHeight },
        after: { x: rightX, y: top, width, height: titleHeight },
      },
      rows: items.map((_, i) => {
        const y = top + titleHeight + i * (rowHeight + rowGap);
        const before = { x: left, y, width, height: rowHeight };
        const after = { x: rightX, y, width, height: rowHeight };
        const clear = 14 * k;
        return {
          before,
          after,
          link: split
            ? {
                kind: "line" as const,
                from: { x: left + width + clear, y: y + rowHeight / 2 },
                to: { x: rightX - clear, y: y + rowHeight / 2 },
              }
            : null,
        };
      }),
    };
  }
  throw new Error("unreachable: the transformation layout always returns within its attempts");
}
