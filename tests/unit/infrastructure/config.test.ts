import { describe, expect, it } from "vitest";
import { StudioError } from "../../../src/domain/errors";
import { createRedactor } from "../../../src/domain/redaction";
import { createConfig } from "../../../src/infrastructure/config/env";
import { createLogger } from "../../../src/infrastructure/logging/logger";

const SECRET = "super-secret-demo-password";

describe("createConfig", () => {
  it("works with an empty environment for everything that needs no integration", () => {
    const config = createConfig({});
    expect(config.general()).toMatchObject({
      nodeEnv: "development",
      outputDirectory: "output",
      defaultFps: 30,
      resolutionScale: 1,
      renderConcurrency: undefined,
    });
    expect(config.configured()).toEqual({
      elevenLabs: false,
      demo: false,
      r2: false,
      youTube: false,
    });
    expect(config.secretValues()).toEqual([]);
  });

  it("validates an integration only when it is used", () => {
    const config = createConfig({ R2_ACCOUNT_ID: "abc" });
    expect(() => config.general()).not.toThrow();
    expect(() => config.r2()).toThrow(StudioError);
    expect(() => config.elevenLabs()).toThrow(/ELEVENLABS_API_KEY/);
  });

  it("names every missing variable and never echoes a value", () => {
    const config = createConfig({ IKER_DEMO_BASE_URL: "not a url", IKER_DEMO_PASSWORD: SECRET });
    let message = "";
    try {
      config.demo();
    } catch (error) {
      message = `${(error as StudioError).message} ${(error as StudioError).hint ?? ""}`;
    }
    expect(message).toContain("IKER_DEMO_USERNAME");
    expect(message).toContain("IKER_DEMO_BASE_URL");
    expect(message).not.toContain(SECRET);
    expect(message).not.toContain("not a url");
  });

  it("accepts a saved session in place of a username and password", () => {
    const config = createConfig({
      IKER_DEMO_BASE_URL: "http://localhost:3000",
      IKER_DEMO_AUTH: "session",
    });
    expect(config.configured().demo).toBe(true);
    expect(config.demo()).toMatchObject({ credentials: null });
  });

  it("requires both username and password in password mode", () => {
    const config = createConfig({
      IKER_DEMO_BASE_URL: "https://staging.iker.example",
      IKER_DEMO_AUTH: "password",
    });
    expect(() => config.demo()).toThrow(/IKER_DEMO_USERNAME.*IKER_DEMO_PASSWORD/s);
  });

  it("treats blank values as unset", () => {
    expect(
      createConfig({ ELEVENLABS_API_KEY: "  ", ELEVENLABS_VOICE_ID: "v" }).configured().elevenLabs,
    ).toBe(false);
  });

  it("applies defaults and parses optional numbers", () => {
    const eleven = createConfig({
      ELEVENLABS_API_KEY: "k",
      ELEVENLABS_VOICE_ID: "v",
      ELEVENLABS_USD_PER_1K_CREDITS: "0.3",
    }).elevenLabs();
    expect(eleven).toEqual({
      apiKey: "k",
      voiceId: "v",
      modelId: "eleven_multilingual_v2",
      outputFormat: undefined,
      usdPerThousandCredits: 0.3,
    });
  });

  it("normalises the demo URL and extra production hosts", () => {
    const demo = createConfig({
      IKER_DEMO_BASE_URL: "https://staging.iker.example/",
      IKER_DEMO_USERNAME: "demo@example.com",
      IKER_DEMO_PASSWORD: SECRET,
      IKER_PRODUCTION_HOSTS: " App.Example.com , other.example.com ",
    }).demo();
    expect(demo.baseUrl).toBe("https://staging.iker.example");
    expect(demo.credentials).toEqual({ username: "demo@example.com", password: SECRET });
    expect(demo.extraProductionHosts).toEqual(["app.example.com", "other.example.com"]);
  });

  it.each([
    ["DEFAULT_FPS", "29"],
    ["DEFAULT_RESOLUTION", "4k"],
    ["RENDER_CONCURRENCY", "0"],
    ["NODE_ENV", "staging"],
  ])("rejects an invalid %s", (name, value) => {
    expect(() => createConfig({ [name]: value }).general()).toThrow(StudioError);
  });

  it("maps resolution names to a scale of the 1080-line base", () => {
    expect(createConfig({ DEFAULT_RESOLUTION: "720p" }).general().resolutionScale).toBeCloseTo(
      2 / 3,
    );
    expect(createConfig({ DEFAULT_RESOLUTION: "2160p" }).general().resolutionScale).toBe(2);
  });

  it("keeps publishing off unless switched on explicitly", () => {
    const base = { YOUTUBE_CLIENT_ID: "id", YOUTUBE_CLIENT_SECRET: "secret" };
    expect(createConfig(base).youTube().publishingEnabled).toBe(false);
    expect(
      createConfig({ ...base, YOUTUBE_PUBLISHING_ENABLED: "yes" }).youTube().publishingEnabled,
    ).toBe(false);
    expect(
      createConfig({ ...base, YOUTUBE_PUBLISHING_ENABLED: "TRUE" }).youTube().publishingEnabled,
    ).toBe(true);
  });

  it("lists every configured secret for redaction", () => {
    const config = createConfig({
      ELEVENLABS_API_KEY: "key-1",
      IKER_DEMO_PASSWORD: SECRET,
      R2_SECRET_ACCESS_KEY: "r2-secret",
      YOUTUBE_CLIENT_SECRET: "yt-secret",
      R2_BUCKET_NAME: "not-secret",
    });
    expect(config.secretValues().sort()).toEqual(
      ["key-1", "r2-secret", SECRET, "yt-secret"].sort(),
    );
  });
});

describe("createLogger", () => {
  const lines: string[] = [];
  const logger = (
    format: "pretty" | "json",
    level: "debug" | "info" | "warn" | "error" = "info",
  ) => {
    lines.length = 0;
    return createLogger({
      level,
      format,
      redact: createRedactor([SECRET]),
      write: (line) => lines.push(line),
      now: () => new Date("2026-01-01T00:00:00Z"),
    });
  };

  it("redacts secrets from messages and fields in both formats", () => {
    logger("pretty").info(`login with ${SECRET}`, { password: SECRET });
    logger("json").error("failed", {
      detail: `value=${SECRET}`,
      error: new Error(`bad ${SECRET}`),
    });
    expect(lines.join("\n")).not.toContain(SECRET);
    expect(lines.join("\n")).toContain("[redacted]");
  });

  it("writes structured JSON with time, level, message and bound fields", () => {
    logger("json").child({ component: "render" }).warn("slow frame", { frame: 12 });
    expect(JSON.parse(lines[0] ?? "{}")).toEqual({
      time: "2026-01-01T00:00:00.000Z",
      level: "warn",
      message: "slow frame",
      component: "render",
      frame: 12,
    });
  });

  it("drops messages below the configured level", () => {
    const log = logger("pretty", "warn");
    log.debug("a");
    log.info("b");
    log.warn("c");
    expect(lines).toEqual(["WARN c"]);
  });
});
