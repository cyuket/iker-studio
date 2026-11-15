import { describe, expect, it } from "vitest";
import { StudioError } from "../../../src/domain/errors";
import { estimateCut, lintScript, parseResearch, parseScript } from "../../../src/domain/script";
import { RESEARCH, scriptMarkdown } from "../../helpers/video";

const rules = (markdown: string, facts: string[] = []) =>
  lintScript(parseScript(markdown), new Set(facts)).map(
    (issue) => `${issue.severity}:${issue.rule}`,
  );

describe("parseScript", () => {
  it("reads front matter, cuts, scenes, narration and direction", () => {
    const script = parseScript(scriptMarkdown());
    expect(script.title).toBe("Finding duplicate customers");
    expect(script.cuts).toHaveLength(1);
    const cut = script.cuts[0];
    expect(cut).toMatchObject({
      id: "full",
      format: "youtube-landscape",
      targetSeconds: { min: 5, max: 60 },
    });
    expect(cut?.scenes.map((scene) => [scene.id, scene.type])).toEqual([
      ["hook", "PROBLEM"],
      ["demo", "DEMO"],
      ["cta", "CTA"],
    ]);
    expect(cut?.scenes[0]?.direction).toEqual(["Open on the scenario."]);
    expect(cut?.scenes[0]?.narration).toBe("A user signs up twice with different details.");
  });

  it("never treats direction lines as narration", () => {
    const script = parseScript(scriptMarkdown());
    expect(script.cuts[0]?.scenes[0]?.narration).not.toContain("Open on the scenario");
  });

  it.each([
    ["missing front matter", "# cut: full (youtube-landscape, 5-60s)\n"],
    ["an unknown format", scriptMarkdown().replace("youtube-landscape, 5-60s", "tiktok, 5-60s")],
    ["an unknown scene type", scriptMarkdown().replace("(PROBLEM)", "(TEASE)")],
    ["a duplicate scene id", scriptMarkdown().replace("## demo (DEMO)", "## hook (DEMO)")],
  ])("rejects %s", (_name, markdown) => {
    expect(() => parseScript(markdown)).toThrow(StudioError);
  });
});

describe("lintScript", () => {
  it("accepts a clean script", () => {
    expect(rules(scriptMarkdown())).toEqual([]);
  });

  it("rejects generic marketing phrases", () => {
    expect(
      rules(
        scriptMarkdown({ hook: "Unlock the power of identity with a game-changing solution." }),
      ),
    ).toEqual(expect.arrayContaining(["error:banned-phrase"]));
  });

  it("rejects unfinished placeholder text", () => {
    expect(rules(scriptMarkdown({ demo: "TODO: narration for this scene" }))).toContain(
      "error:placeholder",
    );
  });

  it("requires a CTA scene in every cut", () => {
    expect(rules(scriptMarkdown().replace("## cta (CTA)", "## closing (OUTCOME)"))).toContain(
      "error:missing-cta",
    );
  });

  it("flags absolute and quantified claims that have no evidence", () => {
    const found = rules(scriptMarkdown({ demo: "This eliminates fraud and cuts reviews by 80%." }));
    expect(found).toContain("warning:absolute-claim");
    expect(found).toContain("warning:quantified-claim");
  });

  it("accepts a quantified sentence once it is tied to a research fact", () => {
    const sentence = "The default threshold is 60 percent.";
    const markdown = scriptMarkdown({ demo: sentence }).replace(
      "claims: []",
      `claims:\n  - text: "${sentence}"\n    fact: threshold`,
    );
    expect(rules(markdown, ["threshold"])).not.toContain("warning:quantified-claim");
  });

  it("does not let one backed sentence excuse a different claim in the same scene", () => {
    const backed = "The default threshold is 60 percent.";
    const markdown = scriptMarkdown({ demo: `${backed} This eliminates fraud.` }).replace(
      "claims: []",
      `claims:\n  - text: "${backed}"\n    fact: threshold`,
    );
    const found = rules(markdown, ["threshold"]);
    expect(found).not.toContain("warning:quantified-claim");
    expect(found).toContain("warning:absolute-claim");
  });

  it("rejects a claim that cites a fact missing from research", () => {
    const markdown = scriptMarkdown().replace(
      "claims: []",
      'claims:\n  - text: "anything"\n    fact: missing',
    );
    expect(rules(markdown)).toContain("error:claim-without-fact");
  });

  it("warns when a cut is outside its duration target", () => {
    expect(rules(scriptMarkdown().replace("5-60s", "50-60s"))).toContain("warning:duration-target");
  });
});

describe("estimateCut", () => {
  it("estimates from word count at the narration pace plus scene padding", () => {
    const cut = parseScript(
      scriptMarkdown({ hook: Array(150).fill("word").join(" "), demo: "", cta: "" }),
    ).cuts[0];
    if (!cut) throw new Error("no cut");
    // 150 words at 150 wpm is 60s, plus padding for that scene, plus two silent scenes.
    expect(estimateCut(cut).seconds).toBeCloseTo(60 + 0.9 + 3 + 3, 5);
  });
});

describe("parseResearch", () => {
  it("returns the listed facts", () => {
    expect(parseResearch(RESEARCH).map((fact) => fact.id)).toEqual(["comparison"]);
  });
  it("returns nothing when there is no front matter", () => {
    expect(parseResearch("# notes only")).toEqual([]);
  });
});
