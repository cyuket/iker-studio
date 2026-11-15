import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Logger, RecordResult } from "../../src/application/ports";
import { StudioError } from "../../src/domain/errors";
import { RecordingTimelineSchema, ScenarioSchema, type Scenario } from "../../src/domain/recording";
import { createRedactor } from "../../src/domain/redaction";
import { startStaticServer, type StaticServer } from "../../src/infrastructure/http/static-server";
import { createPlaywrightRecorder } from "../../src/infrastructure/recording/playwright-recorder";
import { findScenario } from "../../src/scenarios";

const run = promisify(execFile);

const FIXTURE = path.resolve(import.meta.dirname, "../../fixtures/synthetic-demo");
const CREDENTIALS = { username: "demo.operator@example.com", password: "Synthetic-Pass-7391-zq" };
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

let server: StaticServer;
let workDir: string;
const logLines: string[] = [];

/** Keeps every log line so the tests can prove no credential was logged. */
function capturingLogger(): Logger {
  const write = (message: string, fields?: Record<string, unknown>): void => {
    logLines.push(`${message} ${JSON.stringify(fields ?? {})}`);
  };
  const logger: Logger = {
    debug: write,
    info: write,
    warn: write,
    error: write,
    child: () => logger,
  };
  return logger;
}

function scenario(id: string): Scenario {
  const found = findScenario(id);
  if (!found) throw new Error(`Unknown scenario ${id}`);
  return found;
}

async function record(target: Scenario, credentials: typeof CREDENTIALS | null = CREDENTIALS) {
  const outputDir = path.join(workDir, target.id);
  const recorder = createPlaywrightRecorder({
    logger: capturingLogger(),
    redact: createRedactor([CREDENTIALS.password]),
  });
  const result = await recorder.record({
    scenario: target,
    baseUrl: server.origin,
    credentials,
    outputDir,
    headless: true,
    session: null,
    expect: null,
  });
  return { result, outputDir };
}

async function probe(file: string) {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height:format=duration",
    "-of",
    "json",
    file,
  ]);
  const parsed = JSON.parse(stdout) as {
    streams: { width: number; height: number }[];
    format: { duration: string };
  };
  return { ...parsed.streams[0], durationSeconds: Number(parsed.format.duration) };
}

async function readTree(dir: string): Promise<string> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  const texts = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && /\.(txt|json|log)$/.test(entry.name))
      .map((entry) => readFile(path.join(entry.parentPath, entry.name), "utf8")),
  );
  return texts.join("\n");
}

async function expectGoodRecording(
  target: Scenario,
  { result, outputDir }: { result: RecordResult; outputDir: string },
) {
  expect(result.videoFile).toBe(path.join(outputDir, "capture.webm"));
  const video = await probe(result.videoFile);
  expect(video.width).toBe(target.viewport.width);
  expect(video.height).toBe(target.viewport.height);

  const timeline = RecordingTimelineSchema.parse(result.timeline);
  expect(timeline.scenarioId).toBe(target.id);
  expect(timeline.events).toHaveLength(target.steps.length);
  // The encoder pads the end of a capture by up to a second; it never cuts it short.
  expect(video.durationSeconds).toBeGreaterThanOrEqual(timeline.durationSeconds - 0.2);
  expect(video.durationSeconds).toBeLessThanOrEqual(timeline.durationSeconds + 1.5);

  const expectedShots = target.steps.flatMap((step) =>
    step.action === "screenshot" ? [step.name] : [],
  );
  expect(Object.keys(result.screenshots).sort()).toEqual([...expectedShots].sort());
  for (const [name, file] of Object.entries(result.screenshots)) {
    expect(file).toBe(path.join(outputDir, "screenshots", `${name}.png`));
    expect((await readFile(file)).subarray(0, 4)).toEqual(PNG_SIGNATURE);
  }

  for (const event of timeline.events) {
    expect(event.endSeconds).toBeGreaterThanOrEqual(event.startSeconds);
    expect(event.endSeconds).toBeLessThanOrEqual(timeline.durationSeconds);
    if (!event.region) continue;
    for (const edge of [
      event.region.x,
      event.region.y,
      event.region.x + event.region.width,
      event.region.y + event.region.height,
    ]) {
      expect(edge).toBeGreaterThanOrEqual(0);
      expect(edge).toBeLessThanOrEqual(1.0001);
    }
  }

  const serialised = JSON.stringify(result);
  expect(serialised).not.toContain(CREDENTIALS.password);
  expect(serialised).not.toContain(CREDENTIALS.username);
  expect(existsSync(path.join(outputDir, "debug"))).toBe(false);
  return { video, timeline };
}

beforeAll(async () => {
  server = await startStaticServer({ mounts: { "/": FIXTURE }, htmlFallback: true });
  workDir = await mkdtemp(path.join(os.tmpdir(), "studio-recording-"));
});

afterAll(async () => {
  await server.close();
  await rm(workDir, { recursive: true, force: true });
});

describe("Playwright recorder against the synthetic fixture", () => {
  it("records the smoke scenario", async () => {
    const target = scenario("synthetic-smoke");
    const { timeline } = await expectGoodRecording(target, await record(target));

    expect(timeline.durationSeconds).toBeGreaterThan(1);
    expect(timeline.durationSeconds).toBeLessThan(10);
    // Sign-in and the opening navigation run before the capture starts.
    expect(timeline.events.slice(0, 3).every((event) => event.endSeconds === 0)).toBe(true);
    const highlight = timeline.events.find((event) => event.action === "highlight");
    expect(highlight?.region).not.toBeNull();
  });

  it.each(["synthetic-new-booking", "synthetic-record-payment"])(
    "records %s at a watchable length",
    async (id) => {
      const target = scenario(id);
      const { timeline } = await expectGoodRecording(target, await record(target));

      expect(timeline.durationSeconds).toBeGreaterThanOrEqual(15);
      expect(timeline.durationSeconds).toBeLessThanOrEqual(40);
      const labels = timeline.events.flatMap((event) =>
        event.label === null ? [] : [event.label],
      );
      expect(labels.length).toBeGreaterThan(0);
    },
  );

  it("types, scrolls, masks and waits on page state", async () => {
    const detail = "/bookings/demo-booking-2041";
    const target = ScenarioSchema.parse({
      ...scenario("synthetic-smoke"),
      id: "synthetic-all-steps",
      preflight: [],
      steps: [
        { action: "authenticate" },
        {
          action: "mask",
          targets: [{ text: "sample.client.a@example.com" }, { text: "0800 000 0001" }],
        },
        { action: "navigate", path: "/bookings" },
        { action: "waitForState", condition: { textVisible: "Sample Client C" } },
        {
          action: "type",
          target: { label: "Search client name" },
          text: "Client A",
          note: "Find the booking",
        },
        { action: "waitFor", target: { role: "row", name: "Sample Client C" }, state: "hidden" },
        { action: "click", target: { role: "link", name: "Sample Client A" } },
        { action: "waitForState", condition: { urlIncludes: detail } },
        { action: "waitForState", condition: { networkIdle: true } },
        { action: "scroll", target: { role: "heading", name: "Details" } },
        { action: "verify", target: { text: "sample.client.a@example.com" } },
        { action: "screenshot", name: "masked-client" },
      ],
    });

    const { timeline } = await expectGoodRecording(target, await record(target));

    const typing = timeline.events.find((event) => event.action === "type");
    expect(typing).toMatchObject({ label: "Find the booking" });
    expect(typing?.region).not.toBeNull();
    expect(JSON.stringify(timeline)).not.toContain('"Client A"');
    expect(timeline.events.find((event) => event.action === "scroll")?.region).not.toBeNull();
  });

  it("fails clearly on a missing element and leaves credential-free diagnostics", async () => {
    const smoke = scenario("synthetic-smoke");
    const broken = ScenarioSchema.parse({
      ...smoke,
      id: "synthetic-broken",
      steps: [
        ...smoke.steps,
        { action: "click", target: { role: "button", name: "Does not exist" } },
      ],
    });
    const outputDir = path.join(workDir, broken.id);

    const error = await record(broken).then(
      () => null,
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(StudioError);
    const failure = error as StudioError;
    expect(failure.code).toBe("RECORDING_FAILED");
    expect(failure.message).toContain(`step ${broken.steps.length}`);
    expect(failure.message).toContain('button "Does not exist"');
    expect(failure.hint).toContain(path.join(outputDir, "debug"));

    const summary = await readFile(path.join(outputDir, "debug", "failure.txt"), "utf8");
    expect(summary).toContain("action: click");
    expect(summary).toContain('target: button "Does not exist"');
    expect(summary).toContain(`url: ${server.origin}/dashboard`);
    expect((await stat(path.join(outputDir, "debug", "failure.png"))).size).toBeGreaterThan(1_000);
    // A partial capture is removed so it cannot be mistaken for a finished one.
    expect(existsSync(path.join(outputDir, "capture.webm"))).toBe(false);

    const everything = `${failure.message}\n${failure.hint ?? ""}\n${await readTree(outputDir)}`;
    expect(everything).not.toContain(CREDENTIALS.password);
    expect(everything).not.toContain(CREDENTIALS.username);
  });

  it("names the missing element and page when preflight fails", async () => {
    const smoke = scenario("synthetic-smoke");
    const broken = ScenarioSchema.parse({
      ...smoke,
      id: "synthetic-preflight",
      preflight: [{ path: "/dashboard", expect: [{ role: "heading", name: "No such heading" }] }],
    });

    const error = await record(broken).then(
      () => null,
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(StudioError);
    const failure = error as StudioError;
    expect(failure.code).toBe("RECORDING_FAILED");
    expect(failure.message).toContain('heading "No such heading"');
    expect(failure.message).toContain("/dashboard");
    const summary = await readFile(path.join(workDir, broken.id, "debug", "failure.txt"), "utf8");
    expect(summary).toContain("action: preflight");
    expect(summary).not.toContain(CREDENTIALS.password);
  });

  it("refuses to sign in without a demo account", async () => {
    await expect(record(scenario("synthetic-smoke"), null)).rejects.toMatchObject({
      code: "RECORDING_FAILED",
      message: expect.stringContaining("no demo account") as unknown,
    });
  });

  it("refuses a production host before opening a browser", async () => {
    const recorder = createPlaywrightRecorder({
      logger: capturingLogger(),
      redact: (text) => text,
    });
    const target = ScenarioSchema.parse({
      ...scenario("synthetic-smoke"),
      id: "iker-guard",
      target: "iker",
    });
    await expect(
      recorder.record({
        scenario: target,
        baseUrl: "https://useiker.com",
        credentials: CREDENTIALS,
        outputDir: path.join(workDir, "guard"),
        headless: true,
        session: null,
        expect: null,
      }),
    ).rejects.toMatchObject({ code: "UNSAFE_TARGET" });
    expect(existsSync(path.join(workDir, "guard"))).toBe(false);
  });

  it("never logs the demo account", () => {
    const logged = logLines.join("\n");
    expect(logLines.length).toBeGreaterThan(0);
    expect(logged).not.toContain(CREDENTIALS.password);
    expect(logged).not.toContain(CREDENTIALS.username);
  });
});
