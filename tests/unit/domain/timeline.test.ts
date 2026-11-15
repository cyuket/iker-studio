import { describe, expect, it } from "vitest";
import { FORMATS, QUALITIES, outputDimensions } from "../../../src/domain/formats";
import { SceneSchema, type Scene } from "../../../src/domain/storyboard";
import {
  buildChapters,
  buildCutTimeline,
  formatChapterTime,
  sceneDurationFrames,
} from "../../../src/domain/timeline";

function scene(id: string, overrides: Record<string, unknown> = {}): Scene {
  return SceneSchema.parse({
    id,
    type: "EXPLANATION",
    narration: "Some narration.",
    estimatedDurationSeconds: 3,
    visual: { kind: "statement", headline: "Headline" },
    ...overrides,
  });
}

describe("sceneDurationFrames", () => {
  it("is lead-in plus narration plus tail, rounded up to a whole frame", () => {
    // 0.4 + 4.01 + 0.5 = 4.91s, which is 147.3 frames at 30 fps.
    expect(
      sceneDurationFrames(scene("a"), { narrationSeconds: 4.01, recordingSeconds: null }, 30),
    ).toBe(148);
  });

  it("lasts as long as the recording when that outruns the narration", () => {
    expect(sceneDurationFrames(scene("a"), { narrationSeconds: 3, recordingSeconds: 10 }, 30)).toBe(
      Math.ceil(10.9 * 30),
    );
  });

  it("uses the default length for a scene with neither narration nor recording", () => {
    expect(
      sceneDurationFrames(scene("a"), { narrationSeconds: null, recordingSeconds: null }, 30),
    ).toBe(90);
  });

  it("respects a minimum duration set by the designer", () => {
    const held = scene("a", { animation: { minDurationSeconds: 8 } });
    expect(sceneDurationFrames(held, { narrationSeconds: 2, recordingSeconds: null }, 30)).toBe(
      240,
    );
  });

  it("scales with the frame rate", () => {
    const media = { narrationSeconds: 5, recordingSeconds: null };
    expect(sceneDurationFrames(scene("a"), media, 60)).toBe(
      2 * sceneDurationFrames(scene("a"), media, 30),
    );
  });
});

describe("buildCutTimeline", () => {
  const scenes = [scene("one"), scene("two"), scene("three")];
  const media = new Map([
    ["one", { narrationSeconds: 2, recordingSeconds: null }],
    ["two", { narrationSeconds: 4, recordingSeconds: null }],
  ]);
  const timeline = buildCutTimeline("full", scenes, media, 30);

  it("places scenes back to back with no gaps or overlaps", () => {
    let cursor = 0;
    for (const timing of timeline.scenes) {
      expect(timing.startFrame).toBe(cursor);
      cursor += timing.durationFrames;
    }
    expect(timeline.totalFrames).toBe(cursor);
    expect(timeline.totalSeconds).toBeCloseTo(cursor / 30);
  });

  it("starts narration after the lead-in", () => {
    expect(timeline.scenes[0]?.narrationOffsetFrames).toBe(12);
  });

  it("gives a scene without media the default length", () => {
    expect(timeline.scenes[2]).toMatchObject({ durationFrames: 90, narrationSeconds: null });
  });
});

describe("buildChapters", () => {
  const scenes = [
    scene("one", { chapterTitle: "The problem" }),
    scene("two"),
    scene("three", { chapterTitle: "How it works" }),
    scene("four", { chapterTitle: "Too soon" }),
    scene("five", { chapterTitle: "In the product" }),
  ];
  const media = new Map(
    scenes.map((s) => [
      s.id,
      { narrationSeconds: s.id === "three" ? 3 : 12, recordingSeconds: null },
    ]),
  );
  const chapters = buildChapters(buildCutTimeline("full", scenes, media, 30), scenes);

  it("starts the first chapter at zero, as YouTube requires", () => {
    expect(chapters[0]).toEqual({ title: "The problem", startSeconds: 0 });
  });

  it("drops a chapter that would start less than ten seconds after the previous one", () => {
    expect(chapters.map((chapter) => chapter.title)).toEqual([
      "The problem",
      "How it works",
      "In the product",
    ]);
  });

  it("returns none when there are fewer than three, since YouTube ignores those", () => {
    const two = scenes.slice(0, 3);
    expect(buildChapters(buildCutTimeline("full", two, media, 30), two)).toEqual([]);
  });

  it("formats times as minutes and seconds", () => {
    expect(formatChapterTime(0)).toBe("0:00");
    expect(formatChapterTime(75.9)).toBe("1:15");
  });
});

describe("render configuration", () => {
  it("defines the required delivery formats", () => {
    expect(FORMATS["youtube-landscape"]).toMatchObject({
      width: 1920,
      height: 1080,
      fps: 30,
      orientation: "landscape",
    });
    expect(FORMATS["youtube-shorts"]).toMatchObject({
      width: 1080,
      height: 1920,
      fps: 30,
      orientation: "portrait",
    });
    expect(FORMATS["social-landscape"].width / FORMATS["social-landscape"].height).toBeCloseTo(
      16 / 9,
    );
    expect(FORMATS["social-portrait"].width / FORMATS["social-portrait"].height).toBeCloseTo(
      9 / 16,
    );
  });

  it("keeps a safe area inside every format, larger at the bottom of vertical video", () => {
    for (const format of Object.values(FORMATS)) {
      expect(format.safeArea.left + format.safeArea.right).toBeLessThan(format.width / 2);
      expect(format.safeArea.top + format.safeArea.bottom).toBeLessThan(format.height / 2);
    }
    expect(FORMATS["youtube-shorts"].safeArea.bottom).toBeGreaterThan(
      FORMATS["youtube-shorts"].safeArea.top,
    );
  });

  it("renders final quality at full size and preview at half", () => {
    expect(outputDimensions(FORMATS["youtube-landscape"], QUALITIES.final)).toEqual({
      width: 1920,
      height: 1080,
      fps: 30,
    });
    expect(outputDimensions(FORMATS["youtube-shorts"], QUALITIES.preview)).toEqual({
      width: 540,
      height: 960,
      fps: 30,
    });
  });

  it("always produces even dimensions, which H.264 requires", () => {
    const odd = outputDimensions(FORMATS["youtube-landscape"], {
      ...QUALITIES.final,
      scale: 2 / 3,
    });
    expect(odd.width % 2).toBe(0);
    expect(odd.height % 2).toBe(0);
    expect(odd).toMatchObject({ width: 1280, height: 720 });
  });

  it("uses a lower CRF, meaning higher quality, for final renders", () => {
    expect(QUALITIES.final.crf).toBeLessThan(QUALITIES.preview.crf);
  });
});
