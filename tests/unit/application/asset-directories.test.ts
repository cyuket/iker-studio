import { describe, expect, it } from "vitest";
import { assetDirectories } from "../../../src/application/render";
import { createTestCore } from "../../helpers/fakes";

describe("assetDirectories", () => {
  it("serves the video, the brand, the sound effects and the photos scenes use", () => {
    const core = createTestCore();
    const served = assetDirectories(core, "demo");
    expect(served).toEqual({
      video: core.layout.video("demo").root,
      brand: core.layout.brandDir,
      sfx: core.layout.sfxDir,
      images: core.layout.imagesDir,
    });
  });
});
