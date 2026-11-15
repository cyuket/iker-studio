import type { ReactNode } from "react";
import { Img } from "remotion";
import type { ResolvedBrand } from "../../domain/render-props";
import { useTokens } from "../design/SceneContext";

export interface WordmarkProps {
  brand: ResolvedBrand;
  /** Cap height of the lockup in output pixels. */
  height: number;
  variant?: "wordmark" | "mark";
}

/** The brand lockup: the supplied logo file when there is one, the web address otherwise. */
export function Wordmark({ brand, height, variant = "wordmark" }: WordmarkProps): ReactNode {
  const tokens = useTokens();
  const src = variant === "mark" ? brand.logoSrc.mark : brand.logoSrc.wordmark;
  if (src) {
    return (
      <Img
        src={src}
        alt={brand.productName}
        style={{
          height,
          width: "auto",
          display: "block",
          borderRadius: variant === "mark" ? height * 0.24 : 0,
        }}
      />
    );
  }
  if (variant === "mark") {
    return (
      <div
        style={{
          width: height,
          height,
          borderRadius: height * 0.26,
          backgroundColor: tokens.colours.primary,
          color: tokens.colours.onPrimary,
          fontFamily: tokens.fonts.display,
          fontWeight: 700,
          fontSize: height * 0.56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {brand.productName.slice(0, 1)}
      </div>
    );
  }
  // No logo file: the web address is the lockup, with its ending picked out in the accent.
  const dot = brand.website.indexOf(".");
  const name = dot === -1 ? brand.website : brand.website.slice(0, dot);
  const ending = dot === -1 ? "" : brand.website.slice(dot);
  return (
    <div
      style={{
        fontFamily: tokens.fonts.display,
        fontWeight: 700,
        fontSize: height * 0.92,
        lineHeight: `${height}px`,
        letterSpacing: "-0.035em",
        color: tokens.colours.text,
        whiteSpace: "nowrap",
      }}
    >
      {name}
      <span style={{ color: tokens.colours.primary }}>{ending}</span>
    </div>
  );
}
