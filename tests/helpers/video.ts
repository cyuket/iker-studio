import { approveScript } from "../../src/application/approval";
import { checkScript, createVideo, updateStoryboard } from "../../src/application/authoring";
import { renderStoryboardPreview } from "../../src/application/storyboard-preview";
import { PROJECT_ROOT, type TestCore } from "./fakes";

export const TEMPLATE = {
  schemaVersion: 1,
  id: "test-template",
  name: "Test template",
  description: "Two narrated scenes and a call to action.",
  contentTypes: ["PRODUCT_TUTORIAL"],
  thumbnailVariants: ["statement", "split", "product"],
  cuts: [
    {
      id: "full",
      format: "youtube-landscape",
      targetSeconds: { min: 5, max: 60 },
      scenes: [
        {
          id: "hook",
          type: "PROBLEM",
          title: "Hook",
          guidance: "Open with the problem.",
          visual: { kind: "statement", headline: "The problem" },
        },
        {
          id: "demo",
          type: "DEMO",
          title: "Demo",
          guidance: "Show it.",
          visual: { kind: "product", scenarioId: "synthetic-smoke" },
        },
        {
          id: "cta",
          type: "CTA",
          title: "CTA",
          guidance: "Say what to do next.",
          visual: { kind: "cta", headline: "Try it", action: "Start free", url: "example.com" },
        },
      ],
    },
  ],
};

export function scriptMarkdown(
  overrides: { hook?: string; demo?: string; cta?: string } = {},
): string {
  return `---
schemaVersion: 1
title: "Finding duplicate customers"
contentType: PRODUCT_TUTORIAL
audience: "Fraud teams"
audienceProblem: "The same person can open more than one account."
hook: "A user signs up twice with different details."
coreExplanation: "Each new selfie is compared with customers already verified."
demonstration: "The workflow setting and a matched verification."
businessOutcome: "Repeat sign-ups reach a reviewer during onboarding."
callToAction:
  label: "Start free"
  url: "example.com"
titleCandidates:
  - "Finding duplicate customers"
  - "One person, two accounts"
  - "What identity checks miss"
keywords: ["identity verification", "fraud"]
claims: []
---

# cut: full (youtube-landscape, 5-60s)

## hook (PROBLEM) — Hook

> Open on the scenario.

${overrides.hook ?? "A user signs up twice with different details."}

## demo (DEMO) — Demo

${overrides.demo ?? "Here is the setting that sends a matching face to review."}

## cta (CTA) — Next step

${overrides.cta ?? "Start free at example dot com."}
`;
}

export const RESEARCH = `---
facts:
  - id: comparison
    statement: "Each new selfie is compared with people the organisation has already verified."
    source: "docs/how-to-duplicate-customers.md"
---
`;

export function seedTemplate(core: TestCore): void {
  core.files.seed(
    `${PROJECT_ROOT}/templates/test-template/template.json`,
    JSON.stringify(TEMPLATE),
  );
}

/** Creates a video and takes it through script check, storyboard and script approval. */
export async function createApprovedVideo(core: TestCore, id = "demo-video"): Promise<string> {
  seedTemplate(core);
  await createVideo(core, {
    topic: "Duplicates",
    id,
    contentType: "PRODUCT_TUTORIAL",
    template: "test-template",
    voiceProvider: "elevenlabs",
    demo: false,
  });
  const paths = core.layout.video(id);
  core.files.seed(paths.script, scriptMarkdown());
  core.files.seed(paths.research, RESEARCH);
  await checkScript(core, id);
  await updateStoryboard(core, id, [], renderStoryboardPreview);
  await approveScript(core, { videoId: id, approvedBy: "Test Reviewer", note: "" });
  return id;
}
