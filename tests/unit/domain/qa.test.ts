import { describe, expect, it } from "vitest";
import { buildCues, estimateWordTimings } from "../../../src/domain/captions";
import { FORMATS } from "../../../src/domain/formats";
import { buildMetadata, metadataIssues } from "../../../src/domain/metadata";
import { evaluateQa, summariseQa, type QaInputs } from "../../../src/domain/qa";
import { parseScript } from "../../../src/domain/script";
import { CutSchema } from "../../../src/domain/storyboard";
import { buildCutTimeline } from "../../../src/domain/timeline";
import { scriptMarkdown } from "../../helpers/video";

const format = FORMATS["youtube-landscape"];
const cut = CutSchema.parse({
  id: "full",
  format: "youtube-landscape",
  targetSeconds: { min: 5, max: 60 },
  scenes: [
    {
      id: "hook",
      type: "PROBLEM",
      narration: "A user signs up twice.",
      estimatedDurationSeconds: 3,
      visual: { kind: "statement", headline: "Twice" },
    },
    {
      id: "demo",
      type: "DEMO",
      narration: "Here is the setting.",
      estimatedDurationSeconds: 3,
      visual: { kind: "product", scenarioId: "flow" },
    },
    {
      id: "cta",
      type: "CTA",
      narration: "Start free.",
      estimatedDurationSeconds: 3,
      visual: { kind: "cta", headline: "Try it", action: "Start free", url: "example.com" },
    },
  ],
});
const timeline = buildCutTimeline(
  "full",
  cut.scenes,
  new Map(cut.scenes.map((scene) => [scene.id, { narrationSeconds: 3, recordingSeconds: null }])),
  30,
);

function inputs(overrides: Partial<QaInputs> = {}): QaInputs {
  return {
    cut,
    format,
    expected: { width: 1920, height: 1080, fps: 30 },
    media: {
      durationSeconds: timeline.totalSeconds,
      formatName: "mov,mp4,m4a,3gp,3g2,mj2",
      video: { codec: "h264", width: 1920, height: 1080, fps: 30, pixelFormat: "yuv420p" },
      audio: { codec: "aac", sampleRate: 48000, channels: 2 },
    },
    timeline,
    cues: buildCues(estimateWordTimings("A user signs up twice.", 3), format.captions),
    missingAssets: [],
    blackIntervals: [],
    silenceIntervals: [],
    loudness: { integratedLufs: -14.2, truePeakDbtp: -1.6 },
    recordings: [
      { scenarioId: "flow", target: "iker", readable: true, durationSeconds: 12, verified: true },
    ],
    scriptApproved: true,
    scriptApprovalAutomated: false,
    storyboardInSync: true,
    voiceProvider: "elevenlabs",
    estimatedTiming: false,
    pendingPronunciations: [],
    brand: { hasLogo: true, placeholders: [] },
    sensitive: { secrets: [], personalData: [] },
    ...overrides,
  };
}

const statusOf = (id: string, overrides: Partial<QaInputs> = {}) =>
  evaluateQa(inputs(overrides)).find((check) => check.id === id)?.status;

describe("evaluateQa", () => {
  it("passes a clean render, leaving only what a person must judge", () => {
    const checks = evaluateQa(inputs());
    expect(checks.filter((check) => check.status === "fail" || check.status === "warn")).toEqual(
      [],
    );
    expect(checks.filter((check) => check.status === "manual").map((check) => check.id)).toEqual([
      "safe-areas",
    ]);
    expect(summariseQa(checks)).toEqual({ passed: true, failures: 0, warnings: 0, manual: 1 });
  });

  it.each<[string, Partial<QaInputs>]>([
    ["missing-assets", { missingAssets: ["audio/hook.mp3"] }],
    [
      "video-metadata",
      {
        media: {
          ...inputs().media,
          video: { codec: "vp9", width: 1920, height: 1080, fps: 30, pixelFormat: "yuv420p" },
        },
      },
    ],
    ["video-metadata", { media: { ...inputs().media, audio: null } }],
    [
      "aspect-ratio",
      {
        media: {
          ...inputs().media,
          video: { codec: "h264", width: 1080, height: 1080, fps: 30, pixelFormat: "yuv420p" },
        },
      },
    ],
    [
      "resolution",
      {
        media: {
          ...inputs().media,
          video: { codec: "h264", width: 1280, height: 720, fps: 30, pixelFormat: "yuv420p" },
        },
      },
    ],
    ["black-frames", { blackIntervals: [{ startSeconds: 2, endSeconds: 3 }] }],
    ["silence", { silenceIntervals: [{ startSeconds: 1, endSeconds: 9 }] }],
    ["audio-levels", { loudness: { integratedLufs: -14, truePeakDbtp: -0.2 } }],
    [
      "subtitle-overflow",
      { cues: [{ index: 1, startSeconds: 0, endSeconds: 1, lines: ["x".repeat(60)], words: [] }] },
    ],
    [
      "recordings",
      {
        recordings: [
          {
            scenarioId: "flow",
            target: "iker",
            readable: false,
            durationSeconds: 0,
            verified: true,
          },
        ],
      },
    ],
    ["duration", { media: { ...inputs().media, durationSeconds: timeline.totalSeconds + 2 } }],
    ["script-approval", { scriptApproved: false }],
    ["script-approval", { storyboardInSync: false }],
    ["script-approval", { scriptApprovalAutomated: true }],
    [
      "sensitive-information",
      { sensitive: { secrets: ["bearer-token pattern in script.md"], personalData: [] } },
    ],
    [
      "sensitive-information",
      { sensitive: { secrets: [], personalData: ["email ja***********om in storyboard.json"] } },
    ],
  ])("fails %s", (id, overrides) => {
    expect(statusOf(id, overrides)).toBe("fail");
  });

  it("fails when narration runs past the end of its scene", () => {
    const squeezed = {
      ...timeline,
      scenes: timeline.scenes.map((t, i) => (i === 0 ? { ...t, narrationSeconds: 30 } : t)),
    };
    expect(statusOf("narration-overflow", { timeline: squeezed })).toBe("fail");
  });

  it("fails a cut with no call to action", () => {
    const noCta = { ...cut, scenes: cut.scenes.filter((scene) => scene.type !== "CTA") };
    expect(statusOf("cta", { cut: noCta })).toBe("fail");
  });

  it("fails a cut longer than its platform allows", () => {
    const shorts = FORMATS["youtube-shorts"];
    expect(
      statusOf("duration", {
        format: shorts,
        media: { ...inputs().media, durationSeconds: 200 },
        timeline: { ...timeline, totalSeconds: 200 },
      }),
    ).toBe("fail");
  });

  it("accepts short pauses and silence inside scenes that have no narration", () => {
    expect(statusOf("silence", { silenceIntervals: [{ startSeconds: 4, endSeconds: 6 }] })).toBe(
      "pass",
    );
    const quiet = {
      ...timeline,
      scenes: timeline.scenes.map((t, i) => (i === 1 ? { ...t, narrationSeconds: null } : t)),
    };
    const second = quiet.scenes[1];
    if (!second) throw new Error("no scene");
    const start = second.startFrame / 30;
    expect(
      statusOf("silence", {
        timeline: quiet,
        silenceIntervals: [{ startSeconds: start, endSeconds: start + second.durationFrames / 30 }],
      }),
    ).toBe("pass");
  });

  it("treats a recording that outlasts its narration as a pacing warning, not a failure", () => {
    const demo = timeline.scenes[1];
    if (!demo) throw new Error("no scene");
    const start = demo.startFrame / 30;
    const check = evaluateQa(
      inputs({
        silenceIntervals: [
          { startSeconds: start + 0.5, endSeconds: start + demo.durationFrames / 30 - 0.2 },
        ],
      }),
    ).find((c) => c.id === "silence");
    expect(check?.status).toBe("pass");
    const long = {
      ...timeline,
      scenes: timeline.scenes.map((t, i) => (i === 1 ? { ...t, durationFrames: 600 } : t)),
    };
    const longCheck = evaluateQa(
      inputs({
        timeline: long,
        silenceIntervals: [{ startSeconds: start + 4, endSeconds: start + 18 }],
      }),
    ).find((c) => c.id === "silence");
    expect(longCheck?.status).toBe("warn");
    expect(longCheck?.details[0]).toContain('Scene "demo"');
  });

  it("warns, rather than passes, about synthetic footage, stand-in voices and unapproved pronunciations", () => {
    const checks = evaluateQa(
      inputs({
        recordings: [
          {
            scenarioId: "flow",
            target: "synthetic",
            readable: true,
            durationSeconds: 12,
            verified: true,
          },
        ],
        voiceProvider: "system",
        estimatedTiming: true,
        pendingPronunciations: ["Iker"],
      }),
    );
    const footage = checks.find((check) => check.id === "footage-provenance");
    const voice = checks.find((check) => check.id === "voice-provenance");
    expect(footage?.status).toBe("warn");
    expect(footage?.details.join(" ")).toContain("not the real product");
    expect(voice?.status).toBe("warn");
    expect(voice?.details.join(" ")).toMatch(/stand-in voice.*estimated.*Iker/s);
    expect(summariseQa(checks).passed).toBe(true);
  });

  it("tells the reviewer when a voice performance or spoken wording lacks a person's sign-off", () => {
    const voiceOf = (voicePerformance: QaInputs["voicePerformance"]) =>
      evaluateQa(inputs(voicePerformance ? { voicePerformance } : {})).find(
        (check) => check.id === "voice-provenance",
      );
    const signedOff = {
      preset: "natural-educator",
      selected: true,
      spokenWording: true,
      directionApproved: true,
    };
    const baseline = voiceOf(undefined)?.details ?? [];
    expect(voiceOf(signedOff)?.details).toEqual(baseline);
    expect(voiceOf({ ...signedOff, selected: false })?.details.join(" ")).toContain(
      "no person recorded choosing it",
    );
    expect(voiceOf({ ...signedOff, directionApproved: false })?.status).toBe("warn");
    expect(voiceOf({ ...signedOff, directionApproved: false })?.details.join(" ")).toContain(
      "spoken wording differs from script.md",
    );
  });

  it("warns about loudness that is off target without calling it clipping", () => {
    expect(statusOf("audio-levels", { loudness: { integratedLufs: -20, truePeakDbtp: -6 } })).toBe(
      "warn",
    );
  });

  it("never reports the safe-area check as passed, because pixels are not analysed", () => {
    expect(statusOf("safe-areas")).toBe("manual");
  });
});

describe("buildMetadata", () => {
  const script = parseScript(scriptMarkdown());
  const chapters = [
    { title: "The problem", startSeconds: 0 },
    { title: "How it works", startSeconds: 31 },
    { title: "In the product", startSeconds: 75 },
  ];
  const metadata = buildMetadata({
    script,
    chapters,
    disclosures: ["The demonstration uses simulated data."],
  });

  it("offers exactly the script's three titles", () => {
    expect(metadata.titles).toEqual(script.titleCandidates);
  });

  it("writes a description from the script with chapters, CTA and disclosures", () => {
    expect(metadata.youtubeDescription).toContain(script.hook);
    expect(metadata.youtubeDescription).toContain(
      "0:00 The problem\n0:31 How it works\n1:15 In the product",
    );
    expect(metadata.youtubeDescription).toContain("Start free: example.com");
    expect(metadata.youtubeDescription).toContain("The demonstration uses simulated data.");
  });

  it("credits licensed music in the description and the long captions, and nowhere without it", () => {
    const credit =
      '"Lobby Time" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0';
    const withMusic = buildMetadata({ script, chapters, disclosures: [], credits: [credit] });
    expect(withMusic.youtubeDescription).toContain(`Music\n${credit}`);
    expect(withMusic.linkedinCaption).toContain(credit);
    expect(withMusic.shortsCaption).toContain(credit);
    const handWritten = buildMetadata({
      script: { ...script, social: { shorts: "Short caption #Shorts" } },
      chapters,
      disclosures: [],
      credits: [credit],
    });
    expect(handWritten.shortsCaption).toBe(`Short caption #Shorts\n\nMusic\n${credit}`);
    expect(metadata.youtubeDescription).not.toContain("Music\n");
  });

  it("keeps the X caption within the platform limit and includes the link", () => {
    const long = buildMetadata({
      script: { ...script, hook: "word ".repeat(120).trim() },
      chapters: [],
      disclosures: [],
    });
    expect(long.xCaption.length).toBeLessThanOrEqual(280);
    expect(long.xCaption).toContain("example.com");
    expect(metadataIssues(long)).toEqual([]);
  });

  it("prefers hand-written social captions when the script provides them", () => {
    const custom = buildMetadata({
      script: { ...script, social: { linkedin: "Written by a person." } },
      chapters: [],
      disclosures: [],
    });
    expect(custom.linkedinCaption).toBe("Written by a person.");
  });

  it("reports a title that is too long for YouTube", () => {
    expect(metadataIssues({ ...metadata, titles: ["x".repeat(101)] })).toHaveLength(1);
  });
});
