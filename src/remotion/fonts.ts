import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import { cancelRender, continueRender, delayRender } from "remotion";

/**
 * The font files are bundled from @fontsource, so a render needs no network. The weights
 * imported above are the only ones the design tokens use; add a weight here before using it.
 */
export const BUNDLED_FONT_FAMILIES = ["Plus Jakarta Sans", "JetBrains Mono"] as const;

const normalise = (family: string): string => family.replace(/^["']|["']$/g, "");

async function loadBundledFonts(): Promise<void> {
  const wanted = new Set<string>(BUNDLED_FONT_FAMILIES);
  // Every bundled face is loaded up front, including the unicode-range subsets a given
  // frame may not need yet, so no frame can ever be captured in a fallback font.
  const faces = [...document.fonts].filter((face) => wanted.has(normalise(face.family)));
  const loaded = new Set<string>();
  await Promise.all(
    faces.map(async (face) => {
      await face.load();
      loaded.add(normalise(face.family));
    }),
  );
  const missing = BUNDLED_FONT_FAMILIES.filter((family) => !loaded.has(family));
  if (missing.length > 0) {
    throw new Error(`Bundled fonts did not load: ${missing.join(", ")}`);
  }
  await document.fonts.ready;
}

let started = false;

/**
 * Blocks rendering until every bundled font face is ready. Called once when the Remotion
 * entry point is evaluated; a failure cancels the render instead of silently falling back.
 */
export function ensureFontsLoaded(): void {
  if (started || typeof document === "undefined") return;
  started = true;
  const handle = delayRender("Loading bundled fonts");
  loadBundledFonts().then(
    () => continueRender(handle),
    (error: unknown) => cancelRender(error),
  );
}
