import { describe, expect, it } from "vitest";
import { finishingFilters, parsePeakLevel } from "../../../src/infrastructure/media/ffmpeg";

const request = {
  input: "in.mp3",
  output: "out.mp3",
  gainDb: 0,
  compression: false,
  fadeInSeconds: 0,
  fadeOutSeconds: 0,
  durationSeconds: 10,
};

describe("finishingFilters", () => {
  it("does nothing by default", () => {
    expect(finishingFilters(request)).toBe("anull");
  });

  it("applies one fixed gain, never a dynamic normaliser", () => {
    const filters = finishingFilters({ ...request, gainDb: 3.126 });
    expect(filters).toBe("volume=3.13dB");
    expect(filters).not.toMatch(/loudnorm|dynaudnorm|alimiter/);
  });

  it("adds gentle compression only when asked, before the gain", () => {
    expect(finishingFilters({ ...request, compression: true, gainDb: -2 })).toBe(
      "acompressor=threshold=-18dB:ratio=2:attack=20:release=250:makeup=1,volume=-2.00dB",
    );
  });

  it("places the fade-out at the very end of the clip", () => {
    expect(finishingFilters({ ...request, fadeInSeconds: 0.008, fadeOutSeconds: 0.008 })).toBe(
      "afade=t=in:st=0:d=0.008,afade=t=out:st=9.9920:d=0.008",
    );
  });
});

describe("parsePeakLevel", () => {
  it("reads the overall peak, which astats prints last", () => {
    const stderr = [
      "[Parsed_astats_0 @ 0x1] Channel: 1",
      "[Parsed_astats_0 @ 0x1] Peak level dB: -7.250000",
      "[Parsed_astats_0 @ 0x1] Overall",
      "[Parsed_astats_0 @ 0x1] Peak level dB: -6.380000",
    ].join("\n");
    expect(parsePeakLevel(stderr)).toBe(-6.38);
  });

  it("treats digital silence as a very low level, not as missing", () => {
    expect(parsePeakLevel("Peak level dB: -inf")).toBe(-120);
  });

  it("is null when the filter printed nothing", () => {
    expect(parsePeakLevel("no stats here")).toBeNull();
  });
});
