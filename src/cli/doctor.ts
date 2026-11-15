import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { chromium } from "playwright";
import { loadBrand, loadPronunciations } from "../application/context";
import { listTemplateIds, loadTemplate } from "../application/templates";
import { errorMessage } from "../domain/errors";
import { toolVersion } from "../infrastructure/media/ffmpeg";
import type { Container } from "./container";

const exec = promisify(execFile);

export interface DoctorCheck {
  name: string;
  /** `optional` checks describe integrations the project works without. */
  status: "ok" | "fail" | "optional";
  detail: string;
  fix?: string;
}

const FFMPEG_FIX =
  "macOS: `brew install ffmpeg`. Debian/Ubuntu: `sudo apt-get install -y ffmpeg`. See docs/TROUBLESHOOTING.md.";

async function commandVersion(command: string, args: readonly string[]): Promise<string | null> {
  try {
    const { stdout } = await exec(command, [...args]);
    return stdout.trim().split("\n")[0] ?? null;
  } catch {
    return null;
  }
}

async function attempt(
  name: string,
  work: () => Promise<string>,
  fix?: string,
): Promise<DoctorCheck> {
  try {
    return { name, status: "ok", detail: await work() };
  } catch (error) {
    return { name, status: "fail", detail: errorMessage(error), ...(fix ? { fix } : {}) };
  }
}

function versionAtLeast(actual: string, minimum: readonly [number, number]): boolean {
  const [major = 0, minor = 0] = actual.replace(/^v/, "").split(".").map(Number);
  return major > minimum[0] || (major === minimum[0] && minor >= minimum[1]);
}

/** Checks everything a render depends on and reports what to do about each problem. */
export async function runDoctor(container: Container): Promise<DoctorCheck[]> {
  const { core, config, projectRoot } = container;
  const checks: DoctorCheck[] = [];

  checks.push(
    versionAtLeast(process.version, [22, 12])
      ? { name: "Node.js", status: "ok", detail: process.version }
      : {
          name: "Node.js",
          status: "fail",
          detail: `${process.version} is too old`,
          fix: "Install Node.js 22.12 or newer (24 LTS recommended).",
        },
  );

  const pnpm = await commandVersion("pnpm", ["--version"]);
  checks.push(
    pnpm
      ? { name: "pnpm", status: "ok", detail: pnpm }
      : { name: "pnpm", status: "fail", detail: "not found", fix: "Run `corepack enable`." },
  );

  for (const tool of ["ffmpeg", "ffprobe"] as const) {
    const version = await toolVersion(tool);
    checks.push(
      version
        ? { name: tool, status: "ok", detail: version }
        : { name: tool, status: "fail", detail: "not found on PATH", fix: FFMPEG_FIX },
    );
  }
  checks.push(
    await attempt(
      "FFmpeg H.264 encoder",
      async () => {
        const { stdout } = await exec("ffmpeg", ["-hide_banner", "-encoders"]);
        if (!stdout.includes("libx264"))
          throw new Error("this FFmpeg build has no libx264 encoder");
        return "libx264 available";
      },
      FFMPEG_FIX,
    ),
  );

  const git = await commandVersion("git", ["--version"]);
  checks.push(
    git
      ? { name: "git", status: "ok", detail: git }
      : { name: "git", status: "fail", detail: "not found", fix: "Install Git." },
  );

  const browser = chromium.executablePath();
  checks.push(
    existsSync(browser)
      ? { name: "Recording browser", status: "ok", detail: "Playwright Chromium installed" }
      : {
          name: "Recording browser",
          status: "fail",
          detail: "Playwright Chromium is not installed",
          fix: "Run `pnpm playwright:install`.",
        },
  );

  checks.push(
    await attempt(
      "Brand",
      async () => `${(await loadBrand(core)).brand.productName}, brand.json valid`,
    ),
  );
  checks.push(
    await attempt("Pronunciations", async () => {
      const entries = await loadPronunciations(core);
      const pending = entries.filter((entry) => entry.status === "pending").length;
      return `${entries.length} terms, ${pending} awaiting approval`;
    }),
  );
  checks.push(
    await attempt("Templates", async () => {
      const ids = await listTemplateIds(core);
      if (ids.length === 0) throw new Error("no templates found in templates/");
      for (const id of ids) await loadTemplate(core, id);
      return `${ids.length} valid: ${ids.join(", ")}`;
    }),
  );
  checks.push(
    await attempt("Recording scenarios", () => {
      const all = container.recording.scenarios.all();
      const unverified = all.filter((scenario) => scenario.status === "unverified").length;
      return Promise.resolve(
        `${all.length} defined, ${unverified} not yet verified against their target`,
      );
    }),
  );
  checks.push(
    await attempt("Synthetic demo fixture", () => {
      if (!existsSync(path.join(core.layout.fixtureDir, "index.html")))
        throw new Error("fixtures/synthetic-demo is missing");
      return Promise.resolve("present");
    }),
  );

  checks.push(
    await attempt(
      "Environment",
      () => {
        const general = config.general();
        return Promise.resolve(`output in ${general.outputDirectory}/, ${general.defaultFps} fps`);
      },
      "Fix the value in .env; see .env.example for accepted values.",
    ),
  );

  checks.push(
    await attempt(
      "Secrets not tracked by Git",
      async () => {
        const tracked = await exec("git", ["ls-files", ".env"], { cwd: projectRoot }).then(
          (r) => r.stdout.trim(),
          () => "",
        );
        if (tracked) throw new Error(".env is tracked by Git");
        return ".env is not tracked";
      },
      "Run `git rm --cached .env` and rotate every credential in it.",
    ),
  );

  const configured = config.configured();
  const integration = (
    name: string,
    ready: boolean,
    purpose: string,
    validate: () => unknown,
  ): DoctorCheck => {
    if (!ready) return { name, status: "optional", detail: `not configured; ${purpose}` };
    try {
      validate();
      return { name, status: "ok", detail: "configured" };
    } catch (error) {
      return {
        name,
        status: "fail",
        detail: errorMessage(error),
        fix: "Correct the variables in .env.",
      };
    }
  };
  checks.push(
    integration("ElevenLabs", configured.elevenLabs, "needed for production narration", () =>
      config.elevenLabs(),
    ),
  );
  checks.push(
    integration("Iker demo environment", configured.demo, "needed to record the real product", () =>
      config.demo(),
    ),
  );
  checks.push(
    integration("Cloudflare R2", configured.r2, "needed only for remote storage", () =>
      config.r2(),
    ),
  );
  checks.push(
    integration("YouTube", configured.youTube, "needed only for direct publishing", () =>
      config.youTube(),
    ),
  );

  if (process.platform === "darwin") {
    const say = await commandVersion("which", ["say"]);
    checks.push({
      name: "System voice",
      status: say ? "ok" : "optional",
      detail: say ? "macOS `say` available as an offline stand-in voice" : "not available",
    });
  }
  return checks;
}
