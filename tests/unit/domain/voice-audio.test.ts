import { describe, expect, it } from "vitest";
import {
  clipFindings,
  edgeSilence,
  FinishingSchema,
  internalSilences,
  levelGainDb,
  loudnessSpread,
  median,
  mergeSilences,
  silenceBetween,
  soundBeforeSpeech,
  summariseAcousticPauses,
  paceOf,
  planFinishing,
  sentenceEndSeconds,
  summarisePauses,
  wordGaps,
  type ClipMeasurement,
} from "../../../src/domain/voice-audio";

const word = (text: string, startSeconds: number, endSeconds: number) => ({
  text,
  startSeconds,
  endSeconds,
});
// 6 words over 4 s with one 1 s pause and one 0.1 s gap.
const WORDS = [
  word("They", 0, 0.5),
  word("pass", 0.5, 1),
  word("again.", 1.1, 1.5),
  word("Every", 2.5, 3),
  word("check", 3, 3.5),
  word("passes.", 3.5, 4),
];

const clip = (overrides: Partial<ClipMeasurement> = {}): ClipMeasurement => ({
  durationSeconds: 10,
  integratedLufs: -26,
  truePeakDbtp: -6,
  loudnessRange: 3,
  samplePeakDb: -6.5,
  startEdgeDb: -80,
  endEdgeDb: -70,
  silences: [
    { startSeconds: 0, endSeconds: 0.2 },
    { startSeconds: 4, endSeconds: 4.6 },
    { startSeconds: 6, endSeconds: 6.1 },
    { startSeconds: 9.7, endSeconds: 10 },
  ],
  ...overrides,
});
const finishing = FinishingSchema.parse({});

describe("pace and pauses", () => {
  it("counts only gaps a listener would notice", () => {
    expect(wordGaps(WORDS)).toEqual([{ afterWord: "again.", atSeconds: 1.5, seconds: 1 }]);
    expect(wordGaps(WORDS, 0.05)).toHaveLength(2);
  });

  it("gives words per minute over the speech span, and with pauses removed", () => {
    const pace = paceOf(WORDS);
    expect(pace?.wordsPerMinute).toBeCloseTo(90, 5);
    expect(pace?.articulationWordsPerMinute).toBeCloseTo(120, 5);
    expect(paceOf([])).toBeNull();
  });

  it("summarises pauses", () => {
    expect(summarisePauses(WORDS)).toEqual({
      count: 1,
      totalSeconds: 1,
      longestSeconds: 1,
      medianSeconds: 1,
      share: 0.25,
    });
    expect(summarisePauses([]).count).toBe(0);
  });

  it("takes the median of odd and even lists", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  it("finds where the nth sentence ends", () => {
    expect(sentenceEndSeconds(WORDS, 1)).toBe(1.5);
    expect(sentenceEndSeconds(WORDS, 2)).toBe(4);
    expect(sentenceEndSeconds(WORDS, 3)).toBeNull();
  });
});

describe("clip edges and silences", () => {
  it("separates silence at the edges from pauses inside the clip", () => {
    expect(edgeSilence(clip())).toEqual({
      leadingSeconds: 0.2,
      trailingSeconds: expect.closeTo(0.3, 5) as number,
    });
    expect(internalSilences(clip())).toEqual([{ startSeconds: 4, endSeconds: 4.6 }]);
  });

  it("reports no edge silence when the clip starts and ends on sound", () => {
    expect(edgeSilence(clip({ silences: [{ startSeconds: 4, endSeconds: 4.6 }] }))).toEqual({
      leadingSeconds: 0,
      trailingSeconds: 0,
    });
  });

  it("flags clipping and edges loud enough to click", () => {
    expect(clipFindings(clip())).toEqual({
      clipped: false,
      startMayClick: false,
      endMayClick: false,
    });
    expect(clipFindings(clip({ samplePeakDb: 0 })).clipped).toBe(true);
    expect(clipFindings(clip({ truePeakDbtp: 0.4 })).clipped).toBe(true);
    expect(clipFindings(clip({ startEdgeDb: -30 })).startMayClick).toBe(true);
    expect(clipFindings(clip({ endEdgeDb: -12 })).endMayClick).toBe(true);
  });
});

describe("pauses read from the audio", () => {
  it("joins stretches the detector split, and leaves real gaps apart", () => {
    expect(
      mergeSilences([
        { startSeconds: 1.31, endSeconds: 1.8 },
        { startSeconds: 1.17, endSeconds: 1.31 },
        { startSeconds: 3, endSeconds: 3.4 },
      ]),
    ).toEqual([
      { startSeconds: 1.17, endSeconds: 1.8 },
      { startSeconds: 3, endSeconds: 3.4 },
    ]);
  });

  it("summarises pauses inside the clip, ignoring its edges", () => {
    const summary = summariseAcousticPauses(clip());
    expect(summary.count).toBe(1);
    expect(summary.longestSeconds).toBeCloseTo(0.6, 5);
    expect(summary.share).toBeCloseTo(0.6 / 9.5, 5);
  });

  it("finds the silence between two words even when their timings overlap it", () => {
    // Timings say the gap is 0.2 s; the waveform is silent for 1.1 s around it.
    const before = word("again.", 14.9, 16.1);
    const after = word("Because", 16.3, 16.9);
    const measurement = { silences: [{ startSeconds: 15.7, endSeconds: 16.8 }] };
    expect(silenceBetween(measurement, before, after)).toBeCloseTo(1.1, 5);
    expect(silenceBetween({ silences: [] }, before, after)).toBe(0);
  });

  it("measures sound before the first word", () => {
    const words = [word("Someone", 0.8, 1.2)];
    expect(
      soundBeforeSpeech({ silences: [{ startSeconds: 0.34, endSeconds: 0.68 }] }, words),
    ).toBeCloseTo(0.46, 5);
    expect(soundBeforeSpeech({ silences: [{ startSeconds: 0, endSeconds: 0.9 }] }, words)).toBe(0);
    expect(soundBeforeSpeech({ silences: [] }, [])).toBe(0);
  });
});

describe("finishing", () => {
  it("is conservative by default: level on, compression off", () => {
    expect(finishing).toEqual({
      level: true,
      targetLufs: -23,
      toleranceLu: 1,
      compression: false,
      edgeFade: "auto",
    });
  });

  it("applies one fixed gain to reach the clip target", () => {
    expect(levelGainDb(clip({ integratedLufs: -26, truePeakDbtp: -8 }), finishing)).toBe(3);
    expect(levelGainDb(clip({ integratedLufs: -20, truePeakDbtp: -3 }), finishing)).toBe(-3);
  });

  it("leaves a clip alone when it is already within tolerance", () => {
    expect(levelGainDb(clip({ integratedLufs: -23.6 }), finishing)).toBe(0);
  });

  it("never raises the peak above the ceiling", () => {
    expect(levelGainDb(clip({ integratedLufs: -28, truePeakDbtp: -4 }), finishing)).toBe(2);
  });

  it("does nothing when levelling is off or loudness is unmeasurable", () => {
    expect(levelGainDb(clip(), { ...finishing, level: false })).toBe(0);
    expect(levelGainDb(clip({ integratedLufs: null }), finishing)).toBe(0);
  });

  it("needs no processing for a clean clip on target", () => {
    expect(planFinishing(clip({ integratedLufs: -23 }), finishing)).toEqual({
      gainDb: 0,
      compression: false,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
      needed: false,
    });
  });

  it("fades an edge only when it measured loud, and never when fades are off", () => {
    const loud = clip({ integratedLufs: -23, endEdgeDb: -20 });
    expect(planFinishing(loud, finishing)).toMatchObject({
      fadeInSeconds: 0,
      fadeOutSeconds: 0.008,
      needed: true,
    });
    expect(planFinishing(loud, { ...finishing, edgeFade: "never" }).needed).toBe(false);
  });

  it("compresses only when asked", () => {
    expect(
      planFinishing(clip({ integratedLufs: -23 }), { ...finishing, compression: true }),
    ).toMatchObject({
      compression: true,
      needed: true,
    });
  });
});

describe("loudnessSpread", () => {
  it("reports the spread and the clips far from the median", () => {
    const spread = loudnessSpread(
      [
        { id: "a", integratedLufs: -26 },
        { id: "b", integratedLufs: -26.4 },
        { id: "c", integratedLufs: -24 },
        { id: "d", integratedLufs: null },
      ],
      1,
    );
    expect(spread?.spreadLu).toBeCloseTo(2.4, 5);
    expect(spread?.outliers).toEqual(["c"]);
  });

  it("is null when nothing was measured", () => {
    expect(loudnessSpread([{ id: "a", integratedLufs: null }], 1)).toBeNull();
  });
});
