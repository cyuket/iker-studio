import { describe, expect, it } from "vitest";
import { FORMATS } from "../../../src/domain/formats";
import { withAlpha } from "../../../src/remotion/design/colour";
import { fitCodeSize, tokenizeLine } from "../../../src/remotion/lib/code";
import { formatValue } from "../../../src/remotion/lib/format";
import { cutMetadata, sceneMetadata } from "../../../src/remotion/lib/metadata";
import {
  SAMPLE_KIND_ORDER,
  sampleCutProps,
  sampleSceneProps,
} from "../../../src/remotion/sample-props";

describe("composition metadata", () => {
  it("takes canvas, frame rate and length from the scene's props", () => {
    const props = sampleSceneProps("title", "youtube-shorts");
    expect(sceneMetadata(props)).toEqual({
      width: 1080,
      height: 1920,
      fps: 30,
      durationInFrames: props.durationFrames,
    });
  });

  it("never returns a zero-length composition", () => {
    expect(
      sceneMetadata({ format: FORMATS["youtube-landscape"], durationFrames: 0 }).durationInFrames,
    ).toBe(1);
  });

  it("sums scene lengths for a cut and uses the cut's format", () => {
    const cut = sampleCutProps("social-portrait");
    const total = cut.scenes.reduce((sum, scene) => sum + scene.durationFrames, 0);
    expect(cutMetadata(cut, FORMATS["youtube-landscape"])).toEqual({
      width: 1080,
      height: 1920,
      fps: 30,
      durationInFrames: total,
    });
  });

  it("falls back to the given format for an empty cut", () => {
    expect(cutMetadata({ scenes: [] }, FORMATS["youtube-landscape"])).toEqual({
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 1,
    });
  });
});

describe("sample props", () => {
  it("covers every visual kind in the sample cut", () => {
    const kinds = new Set(
      sampleCutProps("youtube-landscape").scenes.map((scene) => scene.scene.visual.kind),
    );
    expect([...kinds].sort()).toEqual([...SAMPLE_KIND_ORDER].sort());
  });

  it("needs no external media", () => {
    const serialised = JSON.stringify(sampleCutProps("youtube-landscape"));
    expect(serialised).not.toMatch(/https?:\/\/(?!example\.com)[^"]+\.(png|mp4|mp3|wav|svg)/);
    expect(serialised).not.toContain("file://");
  });

  it("gives the cut contiguous progress from 0 to 1", () => {
    const { scenes } = sampleCutProps("youtube-shorts");
    expect(scenes[0]?.progress?.start).toBe(0);
    expect(scenes.at(-1)?.progress?.end).toBe(1);
    scenes
      .slice(1)
      .forEach((scene, i) => expect(scene.progress?.start).toBe(scenes[i]?.progress?.end));
  });

  it("labels every sample product scene as synthetic", () => {
    for (const scene of sampleCutProps("youtube-landscape").scenes) {
      if (scene.scene.visual.kind === "product") expect(scene.disclosure).not.toBeNull();
    }
  });
});

describe("code helpers", () => {
  it("classifies tokens without changing the text", () => {
    const line = 'const total = await sum(4, "a b"); // done';
    const tokens = tokenizeLine(line);
    expect(tokens.map((token) => token.text).join("")).toBe(line);
    expect(tokens.find((token) => token.text === "const")?.kind).toBe("keyword");
    expect(tokens.find((token) => token.text === '"a b"')?.kind).toBe("string");
    expect(tokens.find((token) => token.text === "4")?.kind).toBe("number");
    expect(tokens.at(-1)).toEqual({ text: "// done", kind: "comment" });
  });

  it("does not treat a URL inside a string as a comment", () => {
    const tokens = tokenizeLine('url: "https://example.com/done",');
    expect(tokens.some((token) => token.kind === "comment")).toBe(false);
  });

  it("sizes code so the longest line and all rows fit", () => {
    const lines = ["x".repeat(50), "y"];
    expect(fitCodeSize(lines, 600, 1000, 40, 10, 1.6)).toBeCloseTo(20);
    expect(fitCodeSize(lines, 6000, 64, 40, 10, 1.6)).toBeCloseTo(20);
    expect(fitCodeSize(lines, 6000, 6000, 40, 10, 1.6)).toBe(40);
    expect(fitCodeSize(lines, 10, 10, 40, 10, 1.6)).toBe(10);
  });
});

describe("formatValue", () => {
  it("attaches symbols and spaces words", () => {
    expect(formatValue(42, "%")).toBe("42%");
    expect(formatValue(3, "min")).toBe("3 min");
    expect(formatValue(1234.5, "")).toBe("1,234.5");
  });
});

describe("colour helpers", () => {
  it("converts brand hex to rgba and clamps alpha", () => {
    expect(withAlpha("#7b6ef7", 0.5)).toBe("rgba(123, 110, 247, 0.5)");
    expect(withAlpha("#000000", 4)).toBe("rgba(0, 0, 0, 1)");
  });
});
