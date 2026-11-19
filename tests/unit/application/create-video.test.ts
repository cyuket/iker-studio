import { describe, expect, it } from "vitest";
import { createVideo } from "../../../src/application/authoring";
import { createTestCore } from "../../helpers/fakes";
import { seedTemplate } from "../../helpers/video";

describe("createVideo content type", () => {
  it("defaults to the template's first content type when none is given", async () => {
    const core = createTestCore();
    seedTemplate(core);
    const manifest = await createVideo(core, {
      topic: "Deposits",
      id: "deposits",
      template: "test-template",
      voiceProvider: "elevenlabs",
      demo: false,
    });
    expect(manifest.contentType).toBe("PRODUCT_TUTORIAL");
  });

  it("refuses a content type the template does not support", async () => {
    const core = createTestCore();
    seedTemplate(core);
    await expect(
      createVideo(core, {
        topic: "Deposits",
        id: "deposits",
        contentType: "RELEASE_UPDATE",
        template: "test-template",
        voiceProvider: "elevenlabs",
        demo: false,
      }),
    ).rejects.toThrow('Template "test-template" does not support RELEASE_UPDATE.');
  });
});
