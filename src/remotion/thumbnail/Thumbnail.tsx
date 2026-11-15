import { useMemo, type ReactNode } from "react";
import { AbsoluteFill, Img } from "remotion";
import { Background } from "../components/Background";
import { BrowserFrame, browserBarHeight, fitBrowserFrame } from "../components/BrowserFrame";
import { DisclosureLabel } from "../components/DisclosureLabel";
import { Wordmark } from "../components/Wordmark";
import { THUMBNAIL_SIZE, type ThumbnailRenderProps } from "../../domain/render-props";
import { withAlpha } from "../design/colour";
import { fitFontSize, type LayoutFormat } from "../design/layout";
import {
  createEnvironment,
  SceneEnvironmentProvider,
  useLayout,
  useTokens,
} from "../design/SceneContext";

/** The thumbnail is laid out as a 1920x1080 design scaled to the 1280x720 still. */
export const THUMBNAIL_FORMAT: LayoutFormat = {
  width: THUMBNAIL_SIZE.width,
  height: THUMBNAIL_SIZE.height,
  orientation: "landscape",
  safeArea: { top: 48, right: 56, bottom: 48, left: 56 },
  captions: { maxLines: 1 },
};

/** A brand-coloured graphic for when there is no screenshot. It depicts no interface. */
function AbstractPanel({
  brand,
  width,
  height,
}: Pick<ThumbnailRenderProps, "brand"> & { width: number; height: number }): ReactNode {
  const tokens = useTokens();
  const { u } = useLayout();
  const rings = [1, 0.74, 0.5];
  const base = Math.min(width, height) * 0.86;
  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        borderRadius: tokens.radii.xl,
        background: `linear-gradient(150deg, ${withAlpha(tokens.colours.primary, 0.34)}, ${withAlpha(tokens.colours.surfaceRaised, 0.9)} 62%)`,
        border: `${tokens.stroke.hairline}px solid ${withAlpha(tokens.colours.accent, 0.4)}`,
        boxShadow: tokens.shadows.raised,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {rings.map((ring) => (
        <div
          key={ring}
          style={{
            position: "absolute",
            width: base * ring,
            height: base * ring,
            borderRadius: base * ring * 0.3,
            border: `${tokens.stroke.regular}px solid ${withAlpha(tokens.colours.accent, 0.16 + (1 - ring) * 0.5)}`,
          }}
        />
      ))}
      <Wordmark brand={brand} height={u(190)} variant="mark" />
    </div>
  );
}

function ThumbnailLayout({
  brand,
  variant,
  headline,
  screenshotSrc,
  displayUrl,
  disclosure,
}: ThumbnailRenderProps): ReactNode {
  const tokens = useTokens();
  const layout = useLayout();
  const { u, safe, zones } = layout;
  const footer = u(64);
  const full = variant === "statement";
  const textWidth = full ? safe.width : safe.width * 0.5;
  const bodyHeight = safe.height - footer - u(40);
  const headlineSize = fitFontSize({
    text: headline,
    maxWidth: textWidth,
    maxLines: full ? 3 : 4,
    size: u(full ? 236 : 168),
    minSize: u(92),
    charWidth: 0.56,
  });

  const panelWidth = safe.width - textWidth - u(64);
  const bar = browserBarHeight(layout);
  const frame = fitBrowserFrame(u(1240), bodyHeight * 1.2, 16 / 10, bar);
  const visual =
    variant === "product" && screenshotSrc ? (
      // The capture deliberately runs off the right edge; the headline, not the UI, is the read.
      <div style={{ position: "absolute", left: safe.x + textWidth + u(64), top: safe.y + u(56) }}>
        <BrowserFrame size={frame} displayUrl={displayUrl ?? ""}>
          <Img src={screenshotSrc} style={{ width: "100%", height: "100%", display: "block" }} />
        </BrowserFrame>
      </div>
    ) : full ? null : (
      <div
        style={{
          position: "absolute",
          left: safe.x + textWidth + u(64),
          top: safe.y,
          width: panelWidth,
          height: bodyHeight,
        }}
      >
        <AbstractPanel brand={brand} width={panelWidth} height={bodyHeight} />
      </div>
    );

  return (
    <AbsoluteFill>
      <Background />
      {visual}
      {variant === "product" && screenshotSrc ? (
        <AbsoluteFill
          style={{
            background: `linear-gradient(90deg, ${tokens.colours.background} 0%, ${tokens.colours.background} ${Math.round(((safe.x + textWidth) / layout.width) * 100)}%, transparent ${Math.round(((safe.x + textWidth + u(120)) / layout.width) * 100)}%)`,
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          left: safe.x,
          top: safe.y,
          width: textWidth,
          height: bodyHeight,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: u(36),
        }}
      >
        <div
          style={{
            fontFamily: tokens.fonts.display,
            fontWeight: 700,
            fontSize: headlineSize,
            lineHeight: 0.96,
            letterSpacing: "-0.05em",
            color: tokens.colours.text,
            textWrap: "balance",
          }}
        >
          {headline}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: safe.x,
          top: safe.y + safe.height - footer,
          height: footer,
          display: "flex",
          alignItems: "center",
        }}
      >
        <Wordmark brand={brand} height={u(58)} />
      </div>
      {disclosure !== null && zones.disclosure ? (
        <DisclosureLabel text={disclosure} zone={zones.disclosure} />
      ) : null}
    </AbsoluteFill>
  );
}

/** Still image for the video's thumbnail: one short line that reads at a glance. */
export function Thumbnail(props: ThumbnailRenderProps): ReactNode {
  const { brand, disclosure } = props;
  const environment = useMemo(
    () =>
      createEnvironment({
        brand,
        format: THUMBNAIL_FORMAT,
        fps: 30,
        durationFrames: 1,
        reducedMotion: true,
        enter: "none",
        overlays: {
          disclosure: disclosure !== null,
          captions: false,
          progress: false,
          lowerThird: false,
        },
      }),
    [brand, disclosure],
  );
  return (
    <SceneEnvironmentProvider value={environment}>
      <ThumbnailLayout {...props} />
    </SceneEnvironmentProvider>
  );
}
