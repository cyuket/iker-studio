import { describe, expect, it } from "vitest";
import { StudioError } from "../../../src/domain/errors";
import { hashOf, stableStringify } from "../../../src/domain/hash";
import {
  createManifest,
  invalidateDownstream,
  isStageCurrent,
  parseManifest,
  slugify,
  withHistory,
  type Manifest,
} from "../../../src/domain/manifest";
import { STAGE_IDS, downstreamOf } from "../../../src/domain/stages";
import { VoiceSettingsSchema } from "../../../src/domain/voice";

const NOW = "2026-01-01T00:00:00.000Z";
const HASH = "a".repeat(64);

function manifest(): Manifest {
  return createManifest({
    id: "stop-chasing-payments",
    title: "Stop chasing payments in DMs",
    topic: "Deposits tracked on the booking",
    audience: "Service business owners",
    contentType: "BUSINESS_EDUCATION",
    template: "business-explainer",
    format: "youtube-landscape",
    durationTarget: { minSeconds: 120, maxSeconds: 180 },
    voice: VoiceSettingsSchema.parse({ provider: "elevenlabs" }),
    now: NOW,
  });
}

describe("createManifest", () => {
  it("produces a valid manifest with every stage pending", () => {
    const created = manifest();
    expect(parseManifest(JSON.parse(JSON.stringify(created)), "test")).toEqual(created);
    expect(Object.keys(created.stages)).toEqual([...STAGE_IDS]);
    expect(Object.values(created.stages).every((stage) => stage.status === "pending")).toBe(true);
    expect(created.approvals).toEqual({ script: null, final: {} });
  });
});

describe("manifests written before voice presets existed", () => {
  it("still parse, with no preset, no selection and an empty extended ledger", () => {
    const old = JSON.parse(JSON.stringify(manifest())) as Record<string, unknown>;
    delete old.voiceSelection;
    const voice = old.voice as Record<string, unknown>;
    delete voice.preset;
    delete voice.finishing;
    old.usage = { synthesisedCharacters: 7492, synthesisRequests: 44, cacheHits: 19 };
    old.approvals = {
      script: { subjectHash: HASH, approvedBy: "Reviewer", approvedAt: NOW, note: "" },
      final: {},
    };
    const parsed = parseManifest(old, "old manifest");
    expect(parsed.voice.preset).toBeNull();
    expect(parsed.voice.finishing).toMatchObject({ level: true, compression: false });
    expect(parsed.voiceSelection).toBeNull();
    expect(parsed.usage).toEqual({
      synthesisedCharacters: 7492,
      synthesisRequests: 44,
      cacheHits: 19,
      generatedSeconds: 0,
      credits: 0,
      regenerations: 0,
    });
    expect(parsed.approvals.script?.voiceDirectionHash).toBeUndefined();
  });

  it("rejects a preset that does not exist", () => {
    const bad = JSON.parse(JSON.stringify(manifest())) as { voice: Record<string, unknown> };
    bad.voice.preset = "shouty-salesman";
    expect(() => parseManifest(bad, "bad")).toThrow(StudioError);
  });
});

describe("parseManifest", () => {
  it.each([
    ["a wrong schema version", (m: Record<string, unknown>) => (m.schemaVersion = 2)],
    ["an id with spaces", (m: Record<string, unknown>) => (m.id = "Not A Slug")],
    [
      "a missing stage",
      (m: Record<string, unknown>) => delete (m.stages as Record<string, unknown>).render,
    ],
    ["an unknown format", (m: Record<string, unknown>) => (m.format = "imax")],
    ["a malformed hash", (m: Record<string, unknown>) => (m.script = { version: 1, hash: "abc" })],
    [
      "negative usage",
      (m: Record<string, unknown>) =>
        (m.usage = { synthesisedCharacters: -1, synthesisRequests: 0, cacheHits: 0 }),
    ],
  ])("rejects %s", (_name, corrupt) => {
    const raw = JSON.parse(JSON.stringify(manifest())) as Record<string, unknown>;
    corrupt(raw);
    expect(() => parseManifest(raw, "manifest.json")).toThrow(StudioError);
  });

  it("names the file in the error so the operator knows what to restore", () => {
    expect(() => parseManifest({}, "output/x/manifest.json")).toThrow(/output\/x\/manifest\.json/);
  });
});

describe("stage state", () => {
  it("is current only when completed against the same input hash", () => {
    const base = manifest();
    const done: Manifest = {
      ...base,
      stages: {
        ...base.stages,
        script: { ...base.stages.script, status: "completed", inputHash: HASH },
      },
    };
    expect(isStageCurrent(done, "script", HASH)).toBe(true);
    expect(isStageCurrent(done, "script", "b".repeat(64))).toBe(false);
    expect(isStageCurrent(base, "script", HASH)).toBe(false);
  });

  it("invalidates every stage downstream of a change and nothing upstream", () => {
    const base = manifest();
    const stages = Object.fromEntries(
      STAGE_IDS.map((id) => [id, { ...base.stages[id], status: "completed", inputHash: HASH }]),
    ) as Manifest["stages"];
    const invalidated = invalidateDownstream({ ...base, stages }, "storyboard");
    expect(invalidated.stages.script.status).toBe("completed");
    expect(invalidated.stages.storyboard.status).toBe("completed");
    for (const id of downstreamOf("storyboard"))
      expect(invalidated.stages[id].status).toBe("pending");
  });

  it("treats recording and voice as independent of each other", () => {
    expect(downstreamOf("voice")).not.toContain("recording");
    expect(downstreamOf("recording")).not.toContain("voice");
    expect(downstreamOf("voice")).toEqual(
      expect.arrayContaining(["motion", "render", "qa", "export"]),
    );
  });
});

describe("history", () => {
  it("keeps only the most recent events", () => {
    let current = manifest();
    for (let i = 0; i < 250; i++)
      current = withHistory(current, { at: NOW, stage: "render", event: `run ${i}`, detail: "" });
    expect(current.history).toHaveLength(200);
    expect(current.history.at(-1)?.event).toBe("run 249");
  });
});

describe("slugify", () => {
  it.each([
    [
      "How Face Deduplication Stops Multi-Account Fraud",
      "how-face-deduplication-stops-multi-account-fraud",
    ],
    ["  Café — KYC/KYB!  ", "cafe-kyc-kyb"],
  ])("turns %j into %j", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe("hashing", () => {
  it("does not depend on object key order", () => {
    expect(hashOf({ a: 1, b: { c: 2, d: 3 } })).toBe(hashOf({ b: { d: 3, c: 2 }, a: 1 }));
  });
  it("depends on array order", () => {
    expect(hashOf([1, 2])).not.toBe(hashOf([2, 1]));
  });
  it("ignores undefined properties, as JSON does", () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe(stableStringify({ a: 1 }));
  });
});
