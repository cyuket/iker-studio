import { spawn } from "node:child_process";
import { copyFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { listTemplateIds, loadTemplate } from "../../application/templates";
import { ensureBrowser } from "@remotion/renderer";
import { StudioError } from "../../domain/errors";
import type { Container } from "../container";
import { runDoctor } from "../doctor";
import type { Output } from "../output";
import { validateTemplateDemo } from "../../application/template-validation";

type Context = () => { container: Container; out: Output };

function runInherited(command: string, args: readonly string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], { cwd, stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(
            new StudioError(
              "DEPENDENCY_MISSING",
              `${command} ${args.join(" ")} exited with code ${code}.`,
            ),
          ),
    );
  });
}

export function registerSetupCommands(program: Command, context: Context): void {
  program
    .command("doctor")
    .description("check that this machine can record, narrate and render")
    .action(async () => {
      const { container, out } = context();
      const checks = await runDoctor(container);
      const symbol = { ok: "ok  ", fail: "FAIL", optional: "--  " } as const;
      for (const check of checks) {
        out.line(`${symbol[check.status]}  ${check.name}: ${check.detail}`);
        if (check.fix) out.line(`      Fix: ${check.fix}`);
      }
      const failures = checks.filter((check) => check.status === "fail");
      out.result({ ok: failures.length === 0, checks });
      if (failures.length > 0) {
        throw new StudioError("DEPENDENCY_MISSING", `${failures.length} check(s) failed.`, {
          hint: "Apply the fixes above, then run `pnpm studio doctor` again.",
        });
      }
      out.line("\nReady. Integrations marked -- are optional and can be added later.");
    });

  program
    .command("init")
    .description("prepare a fresh clone: .env, working directories and browsers")
    .option("--skip-browsers", "do not download the recording and rendering browsers")
    .action(async (options: { skipBrowsers?: boolean }) => {
      const { container, out } = context();
      const { core, projectRoot } = container;
      const envFile = path.join(projectRoot, ".env");
      const created: string[] = [];
      if (!(await core.files.exists(envFile))) {
        await copyFile(path.join(projectRoot, ".env.example"), envFile);
        created.push(".env");
      }
      await core.files.ensureDir(core.layout.outputRoot);
      await core.files.ensureDir(core.layout.cacheDir);
      if (!options.skipBrowsers) {
        out.line("Installing the recording browser (Playwright Chromium)...");
        await runInherited("pnpm", ["exec", "playwright", "install", "chromium"], projectRoot);
        out.line("Installing the rendering browser (Chrome Headless Shell)...");
        await ensureBrowser({ logLevel: "error" });
      }
      out.line(
        created.length
          ? `Created ${created.join(", ")} from .env.example. Fill in the values you need.`
          : ".env already exists; left untouched.",
      );
      out.line("Next: `pnpm studio doctor`.");
      out.result({ created, browsersInstalled: !options.skipBrowsers });
    });

  const templates = program.command("templates").description("list and validate video templates");
  templates
    .command("list")
    .description("show the available templates")
    .action(async () => {
      const { container, out } = context();
      const loaded = await Promise.all(
        (await listTemplateIds(container.core)).map((id) => loadTemplate(container.core, id)),
      );
      out.table(
        ["Template", "Name", "Content types", "Cuts"],
        loaded.map((t) => [
          t.id,
          t.name,
          t.contentTypes.join(", "),
          t.cuts.map((c) => `${c.id} (${c.format})`).join(", "),
        ]),
      );
      out.result(
        loaded.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          contentTypes: t.contentTypes,
          cuts: t.cuts.map((c) => c.id),
        })),
      );
    });
  templates
    .command("validate")
    .description("validate every template and its demo script and storyboard")
    .action(async () => {
      const { container, out } = context();
      const ids = await listTemplateIds(container.core);
      if (ids.length === 0) throw new StudioError("NOT_FOUND", "No templates found in templates/.");
      const results = [];
      for (const id of ids) {
        const problems = await validateTemplateDemo(container.core, id);
        results.push({ id, problems });
        out.line(
          `${problems.length ? "FAIL" : "ok  "}  ${id}${problems.length ? `\n      ${problems.join("\n      ")}` : ""}`,
        );
      }
      out.result(results);
      if (results.some((result) => result.problems.length > 0)) {
        throw new StudioError("VALIDATION_FAILED", "One or more templates are invalid.");
      }
    });

  program
    .command("scenarios")
    .description("list the recording scenarios and whether each has been verified")
    .action(() => {
      const { container, out } = context();
      const all = container.recording.scenarios.all();
      out.table(
        ["Scenario", "Target", "Status", "Feature"],
        all.map((s) => [s.id, s.target, s.status, s.feature]),
      );
      out.line(
        "\nsynthetic = bundled labelled fixture. iker = the demo environment in IKER_DEMO_BASE_URL.",
      );
      out.line("unverified = written from source code and docs, not yet run end to end.");
      out.result(
        all.map((s) => ({
          id: s.id,
          target: s.target,
          status: s.status,
          feature: s.feature,
          prerequisites: s.prerequisites,
          evidence: s.evidence,
        })),
      );
    });
}
