import { findOverflowingLines, type CaptionCue } from "./captions";
import { LOUDNESS_TARGET, type FormatSpec, type RenderDimensions } from "./formats";
import type { Cut } from "./storyboard";
import { enabledScenes } from "./storyboard";
import type { CutTimeline } from "./timeline";
import type { VoiceProvider } from "./voice";

/**
 * `manual` marks a property software cannot judge reliably. It is listed so the reviewer
 * knows to look, and is never counted as a pass.
 */
export type QaStatus = "pass" | "warn" | "fail" | "manual";

export interface QaCheck {
  id: string;
  title: string;
  status: QaStatus;
  details: string[];
}

export interface QaMedia {
  durationSeconds: number;
  formatName: string;
  video: { codec: string; width: number; height: number; fps: number; pixelFormat: string } | null;
  audio: { codec: string; sampleRate: number; channels: number } | null;
}

export interface QaInterval {
  startSeconds: number;
  endSeconds: number;
}

export interface QaInputs {
  cut: Cut;
  format: FormatSpec;
  expected: RenderDimensions;
  media: QaMedia;
  timeline: CutTimeline;
  cues: readonly CaptionCue[];
  missingAssets: readonly string[];
  blackIntervals: readonly QaInterval[];
  silenceIntervals: readonly QaInterval[];
  loudness: { integratedLufs: number; truePeakDbtp: number } | null;
  recordings: readonly {
    scenarioId: string;
    target: "synthetic" | "iker";
    readable: boolean;
    durationSeconds: number;
    verified: boolean;
  }[];
  scriptApproved: boolean;
  /** True when the only approval on the script was recorded by automation. */
  scriptApprovalAutomated: boolean;
  storyboardInSync: boolean;
  voiceProvider: VoiceProvider;
  estimatedTiming: boolean;
  pendingPronunciations: readonly string[];
  /**
   * How the narration was performed. Optional: callers that do not supply it get the same
   * checks as before. When present, a reviewer is told about anything a person has not
   * signed off: a performance nobody chose, or wording spoken that nobody approved.
   */
  voicePerformance?: {
    preset: string | null;
    /** A person recorded this preset as their choice after listening to auditions. */
    selected: boolean;
    /** The video has a voice-optimised wording that differs from script.md. */
    spokenWording: boolean;
    /** The current approval covers the spoken wording and direction as they are now. */
    directionApproved: boolean;
  };
  brand: { hasLogo: boolean; placeholders: readonly string[] };
  sensitive: { secrets: readonly string[]; personalData: readonly string[] };
}

const check = (id: string, title: string, status: QaStatus, details: string[] = []): QaCheck => ({
  id,
  title,
  status,
  details,
});

const seconds = (value: number): string => `${value.toFixed(2)}s`;
const span = (interval: QaInterval): string =>
  `${seconds(interval.startSeconds)} to ${seconds(interval.endSeconds)}`;

/** Longest stretch without narration that is normal between sentences and scenes. */
const MAX_NATURAL_PAUSE_SECONDS = 3.5;
/** Encoders round to whole audio and video frames, so allow a few frames of difference. */
const DURATION_TOLERANCE_SECONDS = 0.25;

export function evaluateQa(input: QaInputs): QaCheck[] {
  const scenes = enabledScenes(input.cut);
  const { media, expected, format } = input;
  const checks: QaCheck[] = [];

  checks.push(
    check(
      "missing-assets",
      "All referenced assets exist",
      input.missingAssets.length ? "fail" : "pass",
      input.missingAssets.map((asset) => `Missing: ${asset}`),
    ),
  );

  const metadataProblems: string[] = [];
  if (!media.video) metadataProblems.push("No video stream.");
  if (!media.audio) metadataProblems.push("No audio stream.");
  if (media.video && media.video.codec !== "h264")
    metadataProblems.push(`Video codec is ${media.video.codec}, expected h264.`);
  if (media.video && media.video.pixelFormat !== "yuv420p")
    metadataProblems.push(`Pixel format is ${media.video.pixelFormat}, expected yuv420p.`);
  if (media.video && Math.abs(media.video.fps - expected.fps) > 0.01)
    metadataProblems.push(`Frame rate is ${media.video.fps}, expected ${expected.fps}.`);
  if (media.audio && media.audio.codec !== "aac")
    metadataProblems.push(`Audio codec is ${media.audio.codec}, expected aac.`);
  if (!media.formatName.includes("mp4"))
    metadataProblems.push(`Container is ${media.formatName}, expected mp4.`);
  checks.push(
    check(
      "video-metadata",
      "Video metadata is valid",
      metadataProblems.length ? "fail" : "pass",
      metadataProblems,
    ),
  );

  if (media.video) {
    const actualRatio = media.video.width / media.video.height;
    const wantedRatio = format.width / format.height;
    checks.push(
      check(
        "aspect-ratio",
        "Aspect ratio matches the format",
        Math.abs(actualRatio - wantedRatio) < 0.01 ? "pass" : "fail",
        [`${media.video.width}x${media.video.height} for ${format.label}`],
      ),
    );
    const sized = media.video.width === expected.width && media.video.height === expected.height;
    checks.push(
      check("resolution", "Resolution matches the render settings", sized ? "pass" : "fail", [
        `Rendered ${media.video.width}x${media.video.height}, expected ${expected.width}x${expected.height}.`,
      ]),
    );
  }

  checks.push(
    check(
      "black-frames",
      "No unexpected black frames",
      input.blackIntervals.length ? "fail" : "pass",
      input.blackIntervals.map((interval) => `Black from ${span(interval)}`),
    ),
  );

  checks.push(silenceCheck(input));

  if (input.loudness && Number.isFinite(input.loudness.integratedLufs)) {
    const { integratedLufs, truePeakDbtp } = input.loudness;
    const clipping = truePeakDbtp > -1;
    const offTarget = Math.abs(integratedLufs - LOUDNESS_TARGET.integratedLufs) > 1.5;
    checks.push(
      check(
        "audio-levels",
        "Audio is not clipping and loudness is on target",
        clipping ? "fail" : offTarget ? "warn" : "pass",
        [
          `True peak ${truePeakDbtp.toFixed(1)} dBTP (limit -1.0).`,
          `Integrated loudness ${integratedLufs.toFixed(1)} LUFS (target ${LOUDNESS_TARGET.integratedLufs}).`,
        ],
      ),
    );
  } else {
    checks.push(
      check("audio-levels", "Audio is not clipping and loudness is on target", "warn", [
        "The audio track is silent, so levels could not be measured.",
      ]),
    );
  }

  const overflowing = input.timeline.scenes
    .filter((timing) => {
      const available = (timing.durationFrames - timing.narrationOffsetFrames) / input.timeline.fps;
      return timing.narrationSeconds !== null && timing.narrationSeconds > available + 0.05;
    })
    .map((timing) => `Scene "${timing.sceneId}" narration runs past the end of the scene.`);
  checks.push(
    check(
      "narration-overflow",
      "Narration fits inside every scene",
      overflowing.length ? "fail" : "pass",
      overflowing,
    ),
  );

  const wide = findOverflowingLines(input.cues, format.captions);
  checks.push(
    check(
      "subtitle-overflow",
      "Subtitles fit the format",
      wide.length ? "fail" : "pass",
      wide.map((line) => `Too long for ${format.captions.maxCharsPerLine} characters: "${line}"`),
    ),
  );

  checks.push(
    check("safe-areas", "Text stays inside the safe area", "manual", [
      "The design system lays every scene out inside the format's safe area, but rendered pixels are not analysed.",
      "Check the contact sheet: the outlined rectangle on each frame is the safe area.",
    ]),
  );

  const abrupt = scenes
    .filter((scene) => scene.animation.enter === "none")
    .map((scene) => `Scene "${scene.id}" has no entrance.`);
  checks.push(
    check(
      "scene-transitions",
      "Every scene has a transition",
      abrupt.length ? "warn" : "pass",
      abrupt,
    ),
  );

  const broken = input.recordings
    .filter((recording) => !recording.readable || recording.durationSeconds < 1)
    .map(
      (recording) =>
        `Recording "${recording.scenarioId}" is unreadable or shorter than one second.`,
    );
  checks.push(
    check("recordings", "Recordings are intact", broken.length ? "fail" : "pass", broken),
  );

  checks.push(durationCheck(input));

  const brandProblems: string[] = [];
  if (!input.brand.hasLogo)
    brandProblems.push("No logo is configured; the product name is rendered as text.");
  if (
    !scenes.some(
      (scene) =>
        scene.visual.kind === "outro" ||
        scene.visual.kind === "cta" ||
        scene.visual.kind === "title",
    )
  ) {
    brandProblems.push("No intro, outro or CTA scene carries the brand.");
  }
  brandProblems.push(
    ...input.brand.placeholders.map((item) => `Placeholder brand asset in use: ${item}`),
  );
  checks.push(
    check("branding", "Branding is present", brandProblems.length ? "warn" : "pass", brandProblems),
  );

  checks.push(
    check(
      "cta",
      "The cut has a call to action",
      scenes.some((scene) => scene.type === "CTA") ? "pass" : "fail",
    ),
  );

  const scriptProblems: string[] = [];
  if (!input.scriptApproved) scriptProblems.push("The current script has not been approved.");
  else if (input.scriptApprovalAutomated) {
    scriptProblems.push(
      "The script was approved by automation to exercise the pipeline. A person has not reviewed it.",
    );
  }
  if (!input.storyboardInSync)
    scriptProblems.push(
      "The storyboard is out of date with the script; run `pnpm studio storyboard`.",
    );
  checks.push(
    check(
      "script-approval",
      "The script is approved by a person and in sync",
      scriptProblems.length ? "fail" : "pass",
      scriptProblems,
    ),
  );

  const exposure = [
    ...input.sensitive.secrets.map((item) => `Possible secret: ${item}`),
    ...input.sensitive.personalData.map((item) => `Possible personal data: ${item}`),
  ];
  checks.push(
    check(
      "sensitive-information",
      "No sensitive information in text artefacts",
      exposure.length ? "fail" : "pass",
      [
        ...exposure,
        "Recorded pixels are not scanned. Review the contact sheet for anything that should have been masked.",
      ],
    ),
  );

  checks.push(...provenanceChecks(input));
  return checks;
}

function silenceCheck(input: QaInputs): QaCheck {
  const title = "No unexpected silence";
  if (input.voiceProvider === "silent") {
    return check("silence", title, "warn", [
      "Narration was generated with the silent stand-in voice, so the whole track is silent.",
    ]);
  }
  const fps = input.timeline.fps;
  const scenes = enabledScenes(input.cut);
  const bounds = input.timeline.scenes.map((timing) => ({
    timing,
    scene: scenes.find((scene) => scene.id === timing.sceneId),
    start: timing.startFrame / fps,
    end: (timing.startFrame + timing.durationFrames) / fps,
  }));
  const within = (interval: QaInterval, start: number, end: number): boolean =>
    interval.startSeconds >= start - 1 && interval.endSeconds <= end + 1;

  const failures: string[] = [];
  const pacing: string[] = [];
  for (const interval of input.silenceIntervals) {
    if (interval.endSeconds - interval.startSeconds <= MAX_NATURAL_PAUSE_SECONDS) continue;
    const home = bounds.find((bound) => within(interval, bound.start, bound.end));
    // Scenes without narration are silent by design.
    if (home?.timing.narrationSeconds === null) continue;
    const visual = home?.scene?.visual;
    if (home && visual?.kind === "product" && visual.mode === "video") {
      // The recording outlasts its narration: nothing is broken, but the viewer watches in silence.
      pacing.push(
        `Scene "${home.timing.sceneId}" plays ${seconds(interval.endSeconds - interval.startSeconds)} of recording with no narration.`,
      );
    } else {
      failures.push(`Silent from ${span(interval)}`);
    }
  }
  return check("silence", title, failures.length ? "fail" : pacing.length ? "warn" : "pass", [
    ...failures,
    ...pacing,
  ]);
}

function durationCheck(input: QaInputs): QaCheck {
  const { media, timeline, cut, format } = input;
  const details: string[] = [
    `Rendered ${seconds(media.durationSeconds)}; timeline ${seconds(timeline.totalSeconds)}.`,
  ];
  let status: QaStatus = "pass";
  if (Math.abs(media.durationSeconds - timeline.totalSeconds) > DURATION_TOLERANCE_SECONDS) {
    status = "fail";
    details.push("The file length does not match the timeline.");
  }
  if (format.maxDurationSeconds !== null && media.durationSeconds > format.maxDurationSeconds) {
    status = "fail";
    details.push(`${format.label} allows at most ${format.maxDurationSeconds}s.`);
  }
  if (
    media.durationSeconds < cut.targetSeconds.min ||
    media.durationSeconds > cut.targetSeconds.max
  ) {
    if (status === "pass") status = "warn";
    details.push(`Outside the target of ${cut.targetSeconds.min}-${cut.targetSeconds.max}s.`);
  }
  return check("duration", "Duration matches the timeline and target", status, details);
}

/** Facts a reviewer must know about where the footage and voice came from. */
function provenanceChecks(input: QaInputs): QaCheck[] {
  const checks: QaCheck[] = [];
  const synthetic = input.recordings.filter((recording) => recording.target === "synthetic");
  const unverified = input.recordings.filter((recording) => !recording.verified);
  const footage: string[] = [
    ...synthetic.map(
      (r) =>
        `"${r.scenarioId}" is a synthetic demo, not the real product. Its scenes carry an on-screen label.`,
    ),
    ...unverified.map(
      (r) => `"${r.scenarioId}" comes from a scenario that has not been verified end to end.`,
    ),
  ];
  checks.push(
    check(
      "footage-provenance",
      "Product footage is real and verified",
      footage.length ? "warn" : "pass",
      footage,
    ),
  );

  const voice: string[] = [];
  if (input.voiceProvider !== "elevenlabs")
    voice.push(
      `Narration uses the "${input.voiceProvider}" stand-in voice, not the production voice.`,
    );
  if (input.estimatedTiming)
    voice.push(
      "Caption timing is estimated from audio length rather than taken from the speech API.",
    );
  const performance = input.voicePerformance;
  if (performance?.preset && !performance.selected)
    voice.push(
      `Narration uses the "${performance.preset}" preset, but no person recorded choosing it after listening.`,
    );
  if (performance?.spokenWording && !performance.directionApproved)
    voice.push(
      "The spoken wording differs from script.md and its current form is not covered by the script approval.",
    );
  voice.push(
    ...input.pendingPronunciations.map(
      (term) => `Pronunciation of "${term}" has not been approved.`,
    ),
  );
  checks.push(
    check(
      "voice-provenance",
      "Narration uses the approved production voice",
      voice.length ? "warn" : "pass",
      voice,
    ),
  );
  return checks;
}

export interface QaSummary {
  passed: boolean;
  failures: number;
  warnings: number;
  manual: number;
}

export function summariseQa(checks: readonly QaCheck[]): QaSummary {
  const count = (status: QaStatus): number => checks.filter((c) => c.status === status).length;
  const failures = count("fail");
  return { passed: failures === 0, failures, warnings: count("warn"), manual: count("manual") };
}

/** What a person confirms before approving. These are judgements software cannot make. */
export const MANUAL_REVIEW_CHECKLIST: readonly string[] = [
  "I watched the whole video with sound on.",
  "Narration is accurate, and every claim is supported by the research notes.",
  "Pronunciation of product and brand names is correct.",
  "Captions match the speech and are readable.",
  "Product footage shows only demo or synthetic data: no real customer information.",
  "Synthetic or simulated footage is clearly labelled on screen and in the description.",
  "Text and key interface elements sit inside the safe area on every scene.",
  "Pacing, motion and visual hierarchy meet the brand standard.",
  "The title, thumbnail and description describe what the video actually shows.",
  "Music and sound effects, if any, are licensed for this use.",
];
