import type { ReactNode } from "react";
import { useCurrentFrame } from "remotion";
import { handoffSeconds } from "../../domain/cues";
import type { ResolvedRecording } from "../../domain/render-props";
import type { ProductSceneVisual } from "../../domain/storyboard";
import { browserBarHeight } from "../components/BrowserFrame";
import { DeviceFrame } from "../components/DeviceFrame";
import { FeatureHighlight, featureHighlightHeaderHeight } from "../components/FeatureHighlight";
import { resolveMediaSource } from "../components/RecordingMedia";
import { RecordingUnavailable } from "../components/RecordingUnavailable";
import { Reveal } from "../components/Reveal";
import { durationFrames, isSettled, tween } from "../design/motion";
import { useLayout, useSceneEnvironment, useTokens } from "../design/SceneContext";
import { MOTION } from "../design/tokens";
import { graphicMetrics } from "../graphics/GraphicLayout";
import { MotionGraphic } from "../graphics/MotionGraphic";
import { motionGraphicAnchor } from "../lib/anchors";
import { DEVICE_VIEWPORT_ASPECT, layoutDevice, PRODUCT_CALLOUT } from "../lib/device-layout";
import { layoutProduct, regionOnScreen, type ProductGeometry } from "../lib/product-layout";
import { clipRegion, detailCrop, mapRegion, NO_ZOOM } from "../lib/recording";
import { ScreenRecordingTransition } from "../product/ScreenRecordingTransition";
import {
  annotationPresence,
  annotationWindow,
  SmartScreenRecording,
} from "../product/SmartScreenRecording";
import { useProductCamera } from "../product/useProductCamera";

export interface ProductLayoutProps {
  visual: ProductSceneVisual;
  recording: ResolvedRecording | null;
}

const FULL_FRAME = { x: 0, y: 0, width: 1, height: 1 };

/** Used when a recording carries no usable viewport size. */
const DEFAULT_VIEWPORT_ASPECT = 1440 / 900;

/**
 * Product scenes. In 16:9 the browser frame is the hero, with the heading beside it, and
 * the virtual camera moves inside the frame. In 9:16 the frame is fitted to the safe width
 * and stays on the full view, while the camera's view is repeated below at a size that is
 * readable on a phone. A scene may open on a motion graphic that hands over to the footage.
 * With `device` set to a phone or tablet the footage is shown in that device instead, the
 * camera moves inside its screen in both orientations and there is no detail panel.
 */
export function ProductLayout({ visual, recording }: ProductLayoutProps): ReactNode {
  const tokens = useTokens();
  const layout = useLayout();
  const { u, isPortrait, zones } = layout;
  const { timing, fps, beats, reducedMotion, enter } = useSceneEnvironment();
  const frame = useCurrentFrame();
  const content = zones.content;
  const hold = enter === "hold";
  const start = timing.leadFrames;

  const viewport = recording?.timeline.viewport;
  const aspect =
    viewport && viewport.width > 0 && viewport.height > 0
      ? viewport.width / viewport.height
      : visual.device === "browser"
        ? DEFAULT_VIEWPORT_ASPECT
        : DEVICE_VIEWPORT_ASPECT[visual.device];
  const available = recording !== null && resolveMediaSource(recording, visual.mode) !== null;
  const directed = visual.camera !== undefined;
  const moving = directed && visual.camera?.mode !== "static";
  const detailHeader = featureHighlightHeaderHeight(u);
  const hasCallout = directed && visual.annotations.length > 0;
  const deviceLayout =
    visual.device === "browser"
      ? null
      : layoutDevice({
          content,
          portrait: isPortrait,
          u,
          device: visual.device,
          heading: visual.heading,
          hasCallout,
          aspect,
        });
  const geometry: ProductGeometry = deviceLayout
    ? {
        text: deviceLayout.text,
        headingSize: deviceLayout.headingSize,
        frame: deviceLayout.frame,
        // Only the browser frame reads this; a device draws from its own geometry.
        frameSize: {
          width: deviceLayout.frame.width,
          height: deviceLayout.frame.height,
          barHeight: 0,
          viewportHeight: deviceLayout.viewport.height,
        },
        viewport: deviceLayout.viewport,
        detail: null,
      }
    : layoutProduct({
        content,
        portrait: isPortrait,
        u,
        heading: visual.heading,
        hasCallout,
        aspect,
        barHeight: browserBarHeight(layout),
        wantsDetail: available && (visual.focus !== undefined || moving),
        detailHeader,
      });
  // A device's screen is the whole picture, so the camera moves inside it in both
  // orientations; the browser frame in portrait stays on the full view instead.
  const applyCamera = deviceLayout !== null || !isPortrait;
  const camera = useProductCamera(
    visual,
    recording,
    deviceLayout ? deviceLayout.viewport.width : geometry.frame.width,
    deviceLayout ? false : isPortrait,
  );
  const stackedCallout = deviceLayout !== null && isPortrait;

  const notes = visual.annotations.flatMap((annotation) => {
    const presence = annotationPresence(annotationWindow(annotation, beats, fps), frame, fps);
    return presence > 0 ? [{ text: annotation.text, presence }] : [];
  });
  const note = notes.at(-1) ?? null;

  // The handoff from an opening motion graphic, when the scene has one.
  const prelude = visual.prelude;
  const seconds: Record<string, number> = {};
  for (const [id, at] of Object.entries(beats)) seconds[id] = at / fps;
  const handoffAt = prelude ? Math.round((handoffSeconds(visual, seconds) ?? 0) * fps) : 0;
  const handoff = prelude ? tween(frame, handoffAt, fps, "handoff", "move") : 1;
  const landsOn = prelude?.landsOn ?? null;
  const landingStart = handoffAt + Math.round(durationFrames("handoff", fps) * 0.75);
  const landing =
    prelude && landsOn
      ? {
          region: landsOn,
          progress: Math.min(
            tween(frame, landingStart, fps, "emphasis"),
            1 -
              tween(
                frame,
                landingStart + durationFrames("camera", fps) + durationFrames("emphasis", fps),
                fps,
                "release",
                "exit",
              ),
          ),
        }
      : null;

  const screenStart =
    hold || prelude ? -1 : start + (visual.heading ? durationFrames("quick", fps) : 0);
  const textStart = hold || prelude ? -1 : start;
  const crop =
    geometry.detail && available
      ? detailCrop(
          moving && camera.factor > 1.02 ? camera.view : (visual.focus ?? camera.view),
          geometry.detail.width / Math.max(1, geometry.detail.height - detailHeader),
          aspect,
          moving ? 0 : 0.12,
        )
      : null;

  // With a moving camera and no fixed focus, the detail has nothing to add while the
  // camera is on the full frame, so it steps out until there is something to magnify.
  const detailPresence =
    moving && !visual.focus
      ? Math.min(1, Math.max(0, (camera.factor - 1) / (MOTION.scale.detailMin - 1)))
      : 1;

  const product = (
    <>
      {geometry.text ? (
        <div
          style={{
            position: "absolute",
            left: geometry.text.x,
            top: geometry.text.y,
            width: geometry.text.width,
            height: isPortrait ? undefined : geometry.text.height,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: tokens.space[6],
            textAlign: stackedCallout ? "center" : undefined,
          }}
        >
          {visual.heading ? (
            <Reveal at={textStart}>
              <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[5] }}>
                {isPortrait ? null : (
                  <div
                    style={{
                      width: u(44),
                      height: u(5),
                      borderRadius: tokens.radii.pill,
                      backgroundColor: tokens.colours.primary,
                    }}
                  />
                )}
                <div
                  style={{
                    ...tokens.type.h2,
                    fontSize: geometry.headingSize,
                    lineHeight: 1.1,
                    color: tokens.colours.text,
                    textWrap: "balance",
                  }}
                >
                  {visual.heading}
                </div>
              </div>
            </Reveal>
          ) : null}
          {hasCallout && (!isPortrait || stackedCallout) ? (
            // What the viewer should notice, set as a sentence beside the footage rather
            // than as a tag on top of it (above a device in portrait, which has no detail
            // panel to carry it). The row keeps its height so nothing jumps.
            <div
              style={{
                minHeight: stackedCallout ? deviceLayout.calloutHeight : u(132),
                display: "flex",
                alignItems: "flex-start",
                justifyContent: stackedCallout ? "center" : undefined,
              }}
            >
              <div
                style={{
                  ...tokens.type.bodyLg,
                  fontSize: u(PRODUCT_CALLOUT.size),
                  lineHeight: PRODUCT_CALLOUT.lineHeight,
                  color: tokens.colours.textSoft,
                  textWrap: "balance",
                  opacity: note?.presence ?? 0,
                }}
              >
                {note?.text ?? ""}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <Reveal
        at={screenStart}
        style={{ position: "absolute", left: geometry.frame.x, top: geometry.frame.y }}
      >
        {available ? (
          <SmartScreenRecording
            visual={visual}
            recording={recording}
            size={geometry.frameSize}
            camera={camera}
            applyCamera={applyCamera}
            outline={geometry.detail && crop && detailPresence > 0.5 ? crop : null}
            landing={landing}
            device={deviceLayout?.device ?? null}
          />
        ) : deviceLayout ? (
          <DeviceFrame geometry={deviceLayout.device}>
            <RecordingUnavailable
              scenarioId={visual.scenarioId}
              width={deviceLayout.viewport.width}
              height={deviceLayout.viewport.height}
            />
          </DeviceFrame>
        ) : (
          <RecordingUnavailable
            scenarioId={visual.scenarioId}
            width={geometry.frame.width}
            height={geometry.frame.height}
          />
        )}
      </Reveal>
      {available && geometry.detail && crop ? (
        <Reveal
          at={screenStart < 0 ? -1 : screenStart + durationFrames("emphasis", fps)}
          style={{ position: "absolute", left: geometry.detail.x, top: geometry.detail.y }}
        >
          <div style={{ opacity: detailPresence }}>
            <FeatureHighlight
              recording={recording}
              mode={visual.mode}
              crop={crop}
              width={geometry.detail.width}
              height={geometry.detail.height}
              caption={note?.text ?? null}
              atSeconds={camera.recordingSeconds}
            />
          </div>
        </Reveal>
      ) : null}
    </>
  );

  if (!prelude)
    return <div style={{ position: "relative", width: "100%", height: "100%" }}>{product}</div>;

  const anchorContext = {
    content,
    portrait: isPortrait,
    unit: u(1),
    metrics: graphicMetrics(tokens, layout),
  };
  const from = motionGraphicAnchor(prelude.visual, prelude.anchor, anchorContext);
  const bounds = motionGraphicAnchor(prelude.visual, undefined, anchorContext);
  // The landing place is where the region is on screen right now, camera included.
  const landed = landsOn
    ? (clipRegion(mapRegion(landsOn, applyCamera ? camera.zoom : NO_ZOOM)) ?? FULL_FRAME)
    : FULL_FRAME;
  const to = regionOnScreen(landed, geometry.viewport);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <ScreenRecordingTransition
        progress={isSettled(handoffAt) ? 1 : handoff}
        from={from}
        to={to}
        bounds={bounds}
        outgoing={<MotionGraphic visual={prelude.visual} />}
        reducedMotion={reducedMotion}
      >
        {product}
      </ScreenRecordingTransition>
    </div>
  );
}
