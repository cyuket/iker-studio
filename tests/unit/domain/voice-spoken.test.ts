import { describe, expect, it } from "vitest";
import { parseScript, type LintIssue } from "../../../src/domain/script";
import { VoiceDirectionSchema } from "../../../src/domain/voice-direction";
import { lintSpoken, numbersIn, properNouns, stem } from "../../../src/domain/voice-spoken";
import { scriptMarkdown } from "../../helpers/video";

const script = parseScript(
  scriptMarkdown({
    hook: "A user signs up twice with different details. Three weeks later, they do it again.",
    demo: "Here is the setting that sends a matching face to review.",
  }),
);

function lint(spoken: Record<string, string>): LintIssue[] {
  const direction = VoiceDirectionSchema.parse({
    schemaVersion: 1,
    videoId: "v",
    scenes: Object.fromEntries(Object.entries(spoken).map(([id, text]) => [id, { spoken: text }])),
  });
  return lintSpoken(script, direction, new Set(["comparison"]));
}
const rulesOf = (issues: LintIssue[]): string[] => issues.map((i) => `${i.severity}:${i.rule}`);

describe("lintSpoken", () => {
  it("accepts a conversational rewording that says the same thing", () => {
    expect(
      lint({
        hook: "Someone signs up twice, with different details. Three weeks later, they do it again.",
      }),
    ).toEqual([]);
  });

  it("applies the script's banned phrases to the spoken text", () => {
    const issues = lint({
      hook: "A game-changing user signs up twice with different details. Three weeks later, again.",
    });
    expect(rulesOf(issues)).toContain("error:banned-phrase");
    expect(issues[0]?.sceneId).toBe("hook");
  });

  it("applies the script's claim checks to the spoken text", () => {
    const issues = lint({
      demo: "Here is the setting that guarantees a matching face goes to review.",
    });
    expect(rulesOf(issues)).toContain("warning:absolute-claim");
  });

  it("rejects a number the script scene does not contain", () => {
    const issues = lint({
      hook: "A user signs up twice with different details. Five weeks later, they do it again.",
    });
    expect(issues.find((i) => i.rule === "new-number")?.message).toContain("5");
    expect(rulesOf(issues)).toContain("error:new-number");
  });

  it("treats a number written as a word and as digits as the same number", () => {
    const issues = lint({
      hook: "A user signs up twice with different details. 3 weeks later, they do it again.",
    });
    expect(rulesOf(issues)).not.toContain("error:new-number");
    // Digits are still flagged as written for the eye.
    expect(rulesOf(issues)).toContain("warning:digits");
  });

  it("rejects a percentage that was never in the script", () => {
    const issues = lint({
      demo: "Here is the setting that sends ninety percent of matching faces to review.",
    });
    expect(rulesOf(issues)).toContain("error:new-number");
  });

  it("rejects a name or address the script does not mention", () => {
    const issues = lint({
      demo: "Here in Acme is the setting that sends a matching face to review.",
    });
    expect(issues.find((i) => i.rule === "new-name")?.message).toContain("acme");
  });

  it("lists new content words for a person to read, without blocking", () => {
    const issues = lint({
      demo: "Here is the setting that instantly sends a matching face to review.",
    });
    const added = issues.find((i) => i.rule === "new-words");
    expect(added?.severity).toBe("warning");
    expect(added?.message).toContain("instantly");
  });

  it("does not call an inflection of a script word new", () => {
    const issues = lint({ demo: "Here are the settings that send matching faces to a reviewer." });
    expect(rulesOf(issues)).not.toContain("warning:new-words");
  });

  it.each([
    [
      "corporate phrasing",
      "We leverage the setting that sends a matching face to review.",
      "corporate-phrase",
    ],
    ["a dash", "Here is the setting — it sends a matching face to review.", "dash"],
    [
      "text written for the eye",
      "Here is the setting (it sends a matching face to review).",
      "written-for-the-eye",
    ],
    [
      "stiff full forms",
      "Here is the setting. It does not send a matching face to review.",
      "uncontracted",
    ],
  ])("warns about %s", (_name, text, rule) => {
    expect(rulesOf(lint({ demo: text }))).toContain(`warning:${rule}`);
  });

  it("warns when a sentence is too long to say in one breath", () => {
    const long = `Here is the setting that sends ${"a matching face and ".repeat(8)}a face to review.`;
    expect(rulesOf(lint({ demo: long }))).toContain("warning:long-sentence");
  });

  it("warns when the spoken version changes the scene's length a lot", () => {
    expect(rulesOf(lint({ demo: "Here is the setting." }))).toContain("warning:length-changed");
  });

  it("only checks scenes that have a spoken version", () => {
    expect(lint({}).length).toBe(0);
  });
});

describe("helpers", () => {
  it("reads quantities from digits, words and percent signs", () => {
    expect(numbersIn("Three weeks, 21 days, 5% and twenty-two more")).toEqual(
      expect.arrayContaining(["3", "21", "5", "%", "20", "2"]),
    );
  });

  it("finds names, addresses and initialisms but not sentence openers", () => {
    expect(properNouns("In Iker this is KYC. Start at useiker.com now.")).toEqual(
      expect.arrayContaining(["iker", "kyc", "useiker.com"]),
    );
    expect(properNouns("Start here. Then go.")).toEqual([]);
  });

  it("stems inflections to a shared form", () => {
    expect(stem("matches")).toBe(stem("match"));
    expect(stem("verifying")).toBe(stem("verify"));
    expect(stem("verified")).toBe(stem("verify"));
    expect(stem("faces")).toBe(stem("face"));
    expect(stem("reviewer")).toBe(stem("review"));
    expect(stem("customer's")).toBe(stem("customers"));
  });
});
