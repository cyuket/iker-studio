import type { ReactNode } from "react";
import { withAlpha } from "../design/colour";
import { useLayout, useTokens } from "../design/SceneContext";
import type { DeviceGeometry } from "../lib/device-layout";

export interface DeviceFrameProps {
  geometry: DeviceGeometry;
  /** The footage and anything registered to it, laid out in the screen's own box. */
  children: ReactNode;
}

/**
 * A generic, flat, dark phone or tablet around a recording: rounded body, bezel, a camera
 * pill or dot and the edge of the side buttons. It is a stand-in for "on a phone" or "on a
 * tablet", never a particular maker's device, and nothing in it moves. The screen clips the
 * footage to the glass's corner radius, and the footage keeps the recording's aspect.
 */
export function DeviceFrame({ geometry, children }: DeviceFrameProps): ReactNode {
  const tokens = useTokens();
  const { u } = useLayout();
  const { outer, body, glass, screen, camera, homeIndicator } = geometry;
  const spread = u(120);
  const shadow = [
    `0 ${u(2)}px ${u(6)}px ${withAlpha(tokens.colours.background, 0.5)}`,
    `0 ${u(18)}px ${u(40)}px ${withAlpha(tokens.colours.background, 0.55)}`,
    `0 ${u(56)}px ${u(120)}px ${withAlpha(tokens.colours.background, 0.6)}`,
  ].join(", ");
  const place = (rect: { x: number; y: number; width: number; height: number }) =>
    ({
      position: "absolute",
      left: rect.x,
      top: rect.y,
      width: rect.width,
      height: rect.height,
    }) as const;
  return (
    <div style={{ position: "relative", width: outer.width, height: outer.height }}>
      {/* The same soft pool of brand colour the browser frame stands in. */}
      <div
        style={{
          position: "absolute",
          left: -spread,
          top: -spread,
          right: -spread,
          bottom: -spread,
          background: `radial-gradient(closest-side, ${withAlpha(tokens.colours.primary, 0.16)} 0%, ${withAlpha(tokens.colours.primary, 0.05)} 55%, transparent 100%)`,
        }}
      />
      {geometry.buttons.map((button, index) => (
        <div
          key={index}
          style={{
            ...place(button),
            borderRadius: tokens.radii.sm,
            backgroundColor: tokens.colours.border,
          }}
        />
      ))}
      <div
        style={{
          ...place(body),
          boxSizing: "border-box",
          borderRadius: geometry.bodyRadius,
          backgroundColor: tokens.colours.surfaceRaised,
          boxShadow: `0 0 0 ${tokens.stroke.hairline}px ${tokens.colours.hairlineStrong}, ${shadow}`,
        }}
      >
        {/* The bezel: a dark band inside the lighter rim. */}
        <div
          style={{
            position: "absolute",
            inset: geometry.rim,
            borderRadius: geometry.bodyRadius - geometry.rim,
            backgroundColor: tokens.colours.background,
            boxShadow: `inset 0 0 0 ${tokens.stroke.hairline}px ${tokens.colours.hairline}`,
          }}
        />
      </div>
      <div
        style={{
          ...place(glass),
          borderRadius: geometry.glassRadius,
          overflow: "hidden",
          // The bands around the footage read as the screen, a step lighter than the camera.
          backgroundColor: tokens.colours.surface,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: screen.x - glass.x,
            top: screen.y - glass.y,
            width: screen.width,
            height: screen.height,
            overflow: "hidden",
            backgroundColor: tokens.colours.background,
          }}
        >
          {children}
        </div>
        {homeIndicator ? (
          <div
            style={{
              ...place({
                ...homeIndicator,
                x: homeIndicator.x - glass.x,
                y: homeIndicator.y - glass.y,
              }),
              borderRadius: tokens.radii.pill,
              backgroundColor: withAlpha(tokens.colours.text, 0.32),
            }}
          />
        ) : null}
      </div>
      <div
        style={{
          ...place(camera),
          borderRadius: tokens.radii.pill,
          backgroundColor: geometry.cameraOnGlass
            ? tokens.colours.background
            : tokens.colours.surface,
          boxShadow: `inset 0 0 0 ${tokens.stroke.hairline}px ${tokens.colours.hairlineStrong}`,
        }}
      />
    </div>
  );
}
