/**
 * Abstract face glyphs. A person in an illustration is never a photo: it is a small
 * geometric portrait derived from a seed, so "the same face" is literally the same drawing
 * and a different person is visibly a different one. Pure, so glyphs are reproducible.
 */

export const FACE_HAIR = ["crop", "bob", "bun", "sweep", "long", "none"] as const;
export const FACE_HEAD = ["round", "oval", "square"] as const;
/**
 * Colour families a glyph can take. Status colours (green, amber, red) are left out on
 * purpose: next to a "verified" mark, a green face would read as a verdict.
 */
export const FACE_SCHEME = ["violet", "blue", "cyan", "pink", "slate", "lilac"] as const;

export interface FaceSpec {
  hair: (typeof FACE_HAIR)[number];
  head: (typeof FACE_HEAD)[number];
  /** Which glyph hue tints the disc and fills hair and shoulders. */
  scheme: (typeof FACE_SCHEME)[number];
  /** A notch at the neckline. */
  collar: boolean;
  shoulders: "round" | "square";
}

/** FNV-1a: small, stable, and identical in Node and in the browser. */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** The glyph for a seed. Equal seeds give equal glyphs, always. */
export function faceSpec(seed: string): FaceSpec {
  let rest = hashSeed(seed.trim().toLowerCase());
  const take = (count: number): number => {
    const value = rest % count;
    rest = Math.floor(rest / count);
    return value;
  };
  const scheme = FACE_SCHEME[take(FACE_SCHEME.length)] ?? "violet";
  const hair = FACE_HAIR[take(FACE_HAIR.length)] ?? "crop";
  const head = FACE_HEAD[take(FACE_HEAD.length)] ?? "round";
  const collar = take(2) === 0;
  const shoulders = take(2) === 0 ? "round" : "square";
  return { hair, head, scheme, collar, shoulders };
}

/**
 * How many of the features a viewer notices first differ between two glyphs: colour, hair
 * and head shape. 0 means they would be read as the same person.
 */
export function faceDifference(a: FaceSpec, b: FaceSpec): number {
  return Number(a.scheme !== b.scheme) + Number(a.hair !== b.hair) + Number(a.head !== b.head);
}

/** Pairs of distinct seeds whose glyphs are too alike to tell apart at a glance. */
export function confusableFaces(seeds: readonly string[]): [string, string][] {
  const unique = [...new Set(seeds)];
  const pairs: [string, string][] = [];
  unique.forEach((a, i) => {
    for (const b of unique.slice(i + 1)) {
      const spec = faceSpec(a);
      const other = faceSpec(b);
      if (spec.scheme === other.scheme && faceDifference(spec, other) < 2) pairs.push([a, b]);
    }
  });
  return pairs;
}
