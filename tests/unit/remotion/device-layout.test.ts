import { describe, expect, it } from "vitest";
import { FORMATS } from "../../../src/domain/formats";
import { SceneVisualSchema } from "../../../src/domain/storyboard";
import {
  computeLayout,
  computeZones,
  rectContains,
  rectsOverlap,
  type Rect,
} from "../../../src/remotion/design/layout";
import {
  DEVICE_VIEWPORT_ASPECT,
  fitDevice,
  layoutDevice,
  type DeviceKind,
} from "../../../src/remotion/lib/device-layout";

/** The content zone of a product scene in each social format: disclosure and captions on. */
const ZONES = (["social-landscape", "social-portrait"] as const).map((id) => {
  const format = FORMATS[id];
  const layout = computeLayout(format);
  const zones = computeZones(
    layout,
    { disclosure: true, captions: true, progress: false, lowerThird: false },
    format.captions.maxLines,
  );
  return {
    id,
    portrait: layout.isPortrait,
    u: layout.u,
    content: { width: zones.content.width, height: zones.content.height },
  };
});

const DEVICES: DeviceKind[] = ["iphone", "ipad"];
const HEADINGS = [undefined, "Every payment on the booking", "A longer heading that has to wrap"];
const within = (outer: Rect, inner: Rect): boolean => rectContains(outer, inner, 0.5);

describe("layoutDevice", () => {
  for (const zone of ZONES) {
    for (const device of DEVICES) {
      for (const heading of HEADINGS) {
        for (const hasCallout of [false, true]) {
          it(`fits ${device} in ${zone.id} (heading: ${heading ? "yes" : "no"}, callout: ${hasCallout})`, () => {
            const aspect = DEVICE_VIEWPORT_ASPECT[device];
            const geometry = layoutDevice({
              content: zone.content,
              portrait: zone.portrait,
              u: zone.u,
              device,
              heading,
              hasCallout,
              aspect,
            });
            const box: Rect = { x: 0, y: 0, ...zone.content };
            // The device, its glass and its footage stay inside the content zone.
            expect(within(box, geometry.frame)).toBe(true);
            expect(within(geometry.frame, geometry.viewport)).toBe(true);
            const local: Rect = { x: 0, y: 0, ...geometry.device.outer };
            const { body, glass, screen, camera } = geometry.device;
            expect(within(local, body)).toBe(true);
            expect(within(body, glass)).toBe(true);
            expect(within(glass, screen)).toBe(true);
            expect(within(body, camera)).toBe(true);
            for (const button of geometry.device.buttons) expect(within(local, button)).toBe(true);
            // The footage keeps the recording's aspect: no crop, no letterbox.
            expect(geometry.viewport.width / geometry.viewport.height).toBeCloseTo(aspect, 6);
            // The text never sits on the device.
            if (heading !== undefined || hasCallout) {
              expect(geometry.text).not.toBeNull();
              if (geometry.text) {
                expect(within(box, geometry.text)).toBe(true);
                expect(rectsOverlap(geometry.text, geometry.frame)).toBe(false);
              }
            } else {
              expect(geometry.text).toBeNull();
            }
            // A device is never a sliver: it takes a real share of the zone.
            const share = Math.max(
              geometry.frame.width / zone.content.width,
              geometry.frame.height / zone.content.height,
            );
            expect(share).toBeGreaterThan(0.6);
          });
        }
      }
    }
  }

  it("makes the phone the full height of a portrait zone without a heading", () => {
    const zone = ZONES.find((z) => z.portrait);
    if (!zone) throw new Error("no portrait zone");
    const geometry = layoutDevice({
      content: zone.content,
      portrait: true,
      u: zone.u,
      device: "iphone",
      heading: undefined,
      hasCallout: false,
      aspect: DEVICE_VIEWPORT_ASPECT.iphone,
    });
    expect(geometry.frame.height).toBeCloseTo(zone.content.height, 3);
  });

  it("makes the tablet the hero of a landscape zone, with the heading beside it", () => {
    const zone = ZONES.find((z) => !z.portrait);
    if (!zone) throw new Error("no landscape zone");
    const geometry = layoutDevice({
      content: zone.content,
      portrait: false,
      u: zone.u,
      device: "ipad",
      heading: "Every payment on the booking",
      hasCallout: false,
      aspect: DEVICE_VIEWPORT_ASPECT.ipad,
    });
    expect(geometry.text).not.toBeNull();
    if (geometry.text) expect(geometry.text.x + geometry.text.width).toBeLessThan(geometry.frame.x);
    // It takes the whole height of the zone, and far more width than the text.
    expect(geometry.frame.height).toBeCloseTo(zone.content.height, 3);
    if (geometry.text) expect(geometry.frame.width).toBeGreaterThan(geometry.text.width * 2);
  });

  it("stacks the heading above the device in portrait", () => {
    const zone = ZONES.find((z) => z.portrait);
    if (!zone) throw new Error("no portrait zone");
    for (const device of DEVICES) {
      const geometry = layoutDevice({
        content: zone.content,
        portrait: true,
        u: zone.u,
        device,
        heading: "Every payment on the booking",
        hasCallout: true,
        aspect: DEVICE_VIEWPORT_ASPECT[device],
      });
      expect(geometry.text).not.toBeNull();
      if (geometry.text) {
        expect(geometry.frame.y).toBeGreaterThanOrEqual(geometry.text.y + geometry.text.height);
      }
      expect(geometry.calloutHeight).toBeGreaterThan(0);
    }
  });
});

describe("fitDevice", () => {
  it("draws a portrait phone with the camera pill on the glass, above the footage", () => {
    const phone = fitDevice("iphone", 500, 1000, 390 / 844, 1);
    expect(phone.cameraOnGlass).toBe(true);
    expect(phone.camera.y + phone.camera.height).toBeLessThanOrEqual(phone.screen.y);
    expect(phone.homeIndicator).not.toBeNull();
    if (phone.homeIndicator) {
      expect(phone.homeIndicator.y).toBeGreaterThanOrEqual(phone.screen.y + phone.screen.height);
    }
    expect(phone.glassRadius).toBeGreaterThan(0);
    expect(phone.bodyRadius).toBeGreaterThan(phone.glassRadius);
  });

  it("puts the tablet camera on the bezel, outside the glass", () => {
    const tablet = fitDevice("ipad", 1200, 900, 1180 / 820, 1);
    expect(tablet.cameraOnGlass).toBe(false);
    expect(rectsOverlap(tablet.camera, tablet.glass)).toBe(false);
    expect(tablet.homeIndicator).toBeNull();
    expect(tablet.screen).toEqual(tablet.glass);
  });

  it("is deterministic and never negative in a box too small for it", () => {
    const tiny = fitDevice("iphone", 4, 4, 0.5, 1);
    expect(tiny.screen.width).toBeGreaterThanOrEqual(0);
    expect(tiny.screen.height).toBeGreaterThanOrEqual(0);
    expect(fitDevice("ipad", 800, 600, 1.4, 1)).toEqual(fitDevice("ipad", 800, 600, 1.4, 1));
  });
});

describe("product visual device field", () => {
  it("defaults to the browser so existing storyboards render as before", () => {
    const visual = SceneVisualSchema.parse({ kind: "product", scenarioId: "flow" });
    expect(visual.kind === "product" ? visual.device : null).toBe("browser");
  });

  it("accepts the phone and the tablet and nothing else", () => {
    for (const device of ["iphone", "ipad"]) {
      const visual = SceneVisualSchema.parse({ kind: "product", scenarioId: "flow", device });
      expect(visual.kind === "product" ? visual.device : null).toBe(device);
    }
    expect(
      SceneVisualSchema.safeParse({ kind: "product", scenarioId: "flow", device: "android" })
        .success,
    ).toBe(false);
  });
});
