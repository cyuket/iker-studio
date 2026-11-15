import { z } from "zod";

const HexColour = z.string().regex(/^#[0-9a-fA-F]{6}$/, "expected a #rrggbb colour");

export const BrandSchema = z.object({
  schemaVersion: z.literal(1),
  companyName: z.string().min(1),
  productName: z.string().min(1),
  tagline: z.string(),
  website: z.string(),
  /** Paths relative to the brand directory; null renders the wordmark as text. */
  logo: z.object({
    mark: z.string().nullable(),
    wordmark: z.string().nullable(),
  }),
  colours: z.object({
    background: HexColour,
    surface: HexColour,
    surfaceRaised: HexColour,
    border: HexColour,
    text: HexColour,
    textMuted: HexColour,
    primary: HexColour,
    onPrimary: HexColour,
    accent: HexColour,
    positive: HexColour,
    warning: HexColour,
    danger: HexColour,
  }),
  fonts: z.object({
    display: z.string().min(1),
    sans: z.string().min(1),
    mono: z.string().min(1),
  }),
  /** Assets that are stand-ins for real brand files, listed so reviews can call them out. */
  placeholders: z.array(z.string()),
});
export type Brand = z.infer<typeof BrandSchema>;
