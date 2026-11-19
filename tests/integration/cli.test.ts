import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { beforeAll, describe, expect, it } from "vitest";

const exec = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..", "..");
const SECRET = "integration-test-password-not-real";

interface Result {
  code: number;
  stdout: string;
  stderr: string;
}

let outputDir: string;

/** Runs the CLI the way `pnpm studio` does, against a throwaway output directory. */
async function studio(...args: string[]): Promise<Result> {
  const env = {
    ...process.env,
    OUTPUT_DIRECTORY: outputDir,
    IKER_DEMO_PASSWORD: SECRET,
    LOG_LEVEL: "info",
  };
  try {
    const { stdout, stderr } = await exec(
      path.join(ROOT, "node_modules", ".bin", "tsx"),
      [path.join(ROOT, "src", "cli", "main.ts"), ...args],
      { cwd: ROOT, env },
    );
    return { code: 0, stdout, stderr };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string };
    return { code: failed.code ?? -1, stdout: failed.stdout ?? "", stderr: failed.stderr ?? "" };
  }
}

beforeAll(async () => {
  outputDir = await mkdtemp(path.join(os.tmpdir(), "studio cli "));
});

describe("studio CLI", () => {
  it("prints help listing every required command and exits 0", async () => {
    const result = await studio("--help");
    expect(result.code).toBe(0);
    for (const command of [
      "doctor",
      "init",
      "create",
      "plan",
      "script",
      "storyboard",
      "preview-voice",
      "record",
      "narrate",
      "preview",
      "render",
      "qa",
      "approve",
      "export",
      "status",
      "costs",
      "cache",
    ]) {
      expect(result.stdout, command).toMatch(new RegExp(`^  ${command}\\b`, "m"));
    }
  });

  it("has help for each command, including the cache subcommands", async () => {
    for (const args of [
      ["render", "--help"],
      ["narrate", "--help"],
      ["cache", "inspect", "--help"],
      ["cache", "clean", "--help"],
    ]) {
      const result = await studio(...args);
      expect(result.code, args.join(" ")).toBe(0);
      expect(result.stdout).toContain("Usage: studio");
    }
  });

  it.each([
    ["an unknown command", ["launch"]],
    ["a missing required option", ["render"]],
    ["an invalid choice", ["render", "--video", "x", "--quality", "ultra"]],
    ["an invalid content type", ["create", "--topic", "x", "--type", "PODCAST"]],
    ["a missing topic", ["create"]],
  ])("exits 2 with a usage message for %s", async (_name, args) => {
    const result = await studio(...args);
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/error:/i);
    expect(result.stderr).toContain("--help");
  });

  it("exits 1 with a clear message and a hint when the video does not exist", async () => {
    const result = await studio("render", "--video", "no-such-video");
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('There is no video with the id "no-such-video".');
    expect(result.stderr).toContain("pnpm studio create");
  });

  it("emits machine-readable errors on stdout with --json", async () => {
    const result = await studio("status", "--video", "no-such-video", "--json");
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("validates input before doing work", async () => {
    const badId = await studio("create", "--topic", "A topic", "--id", "Not A Valid Id");
    expect(badId.code).toBe(1);
    expect(badId.stderr).toContain("lowercase words separated by hyphens");
    const badTemplate = await studio("create", "--topic", "A topic", "--template", "nope");
    expect(badTemplate.code).toBe(1);
    expect(badTemplate.stderr).toContain(
      "Templates: business-explainer, day-in-the-life, faq-answer, feature-announcement, how-your-client-sees-it, monthly-money-check-in, myth-vs-fact, product-tutorial, quick-sketch",
    );
  });

  it("creates a video, reports status as JSON, and refuses to create it twice", async () => {
    const created = await studio(
      "create",
      "--topic",
      "CLI test video",
      "--id",
      "cli-test",
      "--json",
    );
    expect(created.code).toBe(0);
    expect(JSON.parse(created.stdout)).toMatchObject({ id: "cli-test" });

    const status = await studio("status", "--video", "cli-test", "--json");
    expect(status.code).toBe(0);
    const inspection = JSON.parse(status.stdout) as {
      stages: { id: string; status: string }[];
      nextCommand: string;
    };
    expect(inspection.stages.find((stage) => stage.id === "idea")?.status).toBe("completed");
    expect(inspection.nextCommand).toContain("pnpm studio script --video cli-test");

    const again = await studio("create", "--topic", "CLI test video", "--id", "cli-test");
    expect(again.code).toBe(1);
    expect(again.stderr).toContain("already exists");
  });

  it("rejects the untouched script skeleton, naming what is unfinished", async () => {
    const result = await studio("script", "--video", "cli-test");
    expect(result.code).toBe(1);
    expect(result.stdout).toContain("Unfinished placeholder text.");
    expect(result.stderr).toContain("The script has");
  });

  it("blocks later stages with the command that unblocks them", async () => {
    const narrate = await studio("narrate", "--video", "cli-test");
    expect(narrate.code).toBe(1);
    expect(narrate.stderr).toContain("pnpm studio storyboard --video cli-test");
    const exported = await studio("export", "--video", "cli-test");
    expect(exported.code).toBe(1);
  });

  it("requires confirmation before deleting caches", async () => {
    const result = await studio("cache", "clean", "--narration");
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Add --yes to confirm");
  });

  it("refuses to publish without confirmation and never prints a configured secret", async () => {
    const result = await studio(
      "publish",
      "--video",
      "cli-test",
      "--cut",
      "full",
      "--confirm",
      "wrong",
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Publishing needs explicit confirmation");
    const everything = [
      result,
      await studio("doctor"),
      await studio("status", "--video", "cli-test"),
    ]
      .map((r) => r.stdout + r.stderr)
      .join("\n");
    expect(everything).not.toContain(SECRET);
  });

  it("lists scenarios with their target and verification status", async () => {
    const result = await studio("scenarios", "--json");
    const scenarios = JSON.parse(result.stdout) as { id: string; target: string; status: string }[];
    expect(
      scenarios.filter((s) => s.target === "synthetic").every((s) => s.status === "verified"),
    ).toBe(true);
    expect(scenarios.filter((s) => s.target === "synthetic").map((s) => s.id)).toEqual([
      "synthetic-smoke",
      "synthetic-new-booking",
      "synthetic-record-payment",
    ]);
    // No Iker scenario has had a green take against a demo environment yet.
    const onProduct = scenarios.filter((s) => s.target === "iker");
    expect(onProduct.length).toBeGreaterThanOrEqual(14);
    expect(onProduct.every((s) => s.id.startsWith("iker-") && s.status === "unverified")).toBe(
      true,
    );
  });

  it("validates the shipped templates", async () => {
    const result = await studio("templates", "validate");
    expect(result.code).toBe(0);
    expect(result.stdout.match(/^ok {4}/gm)).toHaveLength(9);
  });
});
