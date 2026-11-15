import { describe, expect, it } from "vitest";
import { capabilitiesFor, isKnownModel, KNOWN_MODELS } from "../../../src/domain/voice-models";
import {
  effectiveSettings,
  PRESET_IDS,
  presetLevers,
  VOICE_PRESETS,
} from "../../../src/domain/voice-presets";

describe("model capability table", () => {
  it("gives eleven_v4 tags and context but no SSML, speed or style", () => {
    const v4 = capabilitiesFor("eleven_v4");
    expect(v4.audioTags).toBe(true);
    expect(v4.ssmlBreak).toBe(false);
    expect(v4.contextText).toBe(true);
    expect(v4.settings).toMatchObject({ stability: true, similarityBoost: true });
    expect(v4.settings.speed).toBe(false);
    expect(v4.settings.style).toBe(false);
    expect(v4.markupInAlignment).toBe(true);
  });

  it("gives eleven_v3 tags but no context, since stitching is documented as unavailable", () => {
    const v3 = capabilitiesFor("eleven_v3");
    expect(v3.audioTags).toBe(true);
    expect(v3.contextText).toBe(false);
    expect(v3.requestStitching).toBe(false);
  });

  it("gives the v2 models SSML breaks and never tags", () => {
    for (const id of ["eleven_multilingual_v2", "eleven_flash_v2_5", "eleven_turbo_v2_5"]) {
      const model = capabilitiesFor(id);
      expect(model.ssmlBreak).toBe(true);
      expect(model.audioTags).toBe(false);
      expect(model.maxBreakSeconds).toBe(3);
    }
  });

  it("treats an unknown model conservatively: plain text and two settings", () => {
    const unknown = capabilitiesFor("eleven_v9_preview");
    expect(isKnownModel("eleven_v9_preview")).toBe(false);
    expect(unknown.family).toBe("unknown");
    expect(unknown.audioTags).toBe(false);
    expect(unknown.ssmlBreak).toBe(false);
    expect(unknown.contextText).toBe(false);
    expect(unknown.emphasisByCapitals).toBe(false);
    expect(unknown.creditsPerCharacter).toBe(1);
  });

  it("records a source and a date for every claim of every known model", () => {
    for (const model of KNOWN_MODELS) {
      const claims = Object.values(model.claims);
      expect(claims.length).toBeGreaterThan(0);
      for (const claim of claims) {
        expect(claim.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(claim.note.length).toBeGreaterThan(10);
        if (claim.evidence === "documented")
          expect(claim.source).toMatch(/^https:\/\/elevenlabs\.io\//);
      }
    }
  });
});

describe("voice presets", () => {
  it("keeps one voice identity: similarity is the same in every preset", () => {
    const values = new Set(PRESET_IDS.map((id) => VOICE_PRESETS[id].settings.similarityBoost));
    expect(values.size).toBe(1);
  });

  it("keeps every setting inside the range the API accepts", () => {
    for (const id of PRESET_IDS) {
      const { stability, similarityBoost, style, speed } = VOICE_PRESETS[id].settings;
      for (const value of [stability, similarityBoost, style]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
      expect(speed).toBeGreaterThanOrEqual(0.7);
      expect(speed).toBeLessThanOrEqual(1.2);
    }
  });

  it("does not claim speed or style on a model that ignores them", () => {
    const settings = effectiveSettings(
      VOICE_PRESETS["cinematic-storyteller"],
      capabilitiesFor("eleven_v4"),
    );
    expect(settings).toEqual({ stability: 0.35, similarityBoost: 0.75, style: null, speed: null });
    const levers = presetLevers(
      VOICE_PRESETS["cinematic-storyteller"],
      capabilitiesFor("eleven_v4"),
    );
    expect(levers.join(" ")).not.toMatch(/speed|style 0/);
  });

  it("uses speed and style where the model honours them", () => {
    const settings = effectiveSettings(
      VOICE_PRESETS["cinematic-storyteller"],
      capabilitiesFor("eleven_multilingual_v2"),
    );
    expect(settings).toEqual({ stability: 0.35, similarityBoost: 0.75, style: 0.3, speed: 0.93 });
  });

  it("never lets a preset use laughter, sighs or other non-verbal sounds", () => {
    for (const id of PRESET_IDS) {
      expect(VOICE_PRESETS[id].narrationStyle).not.toMatch(/laugh|sigh|chuckl|giggl|breath|gasp/i);
    }
  });
});
