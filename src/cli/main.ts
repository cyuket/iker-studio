import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command, CommanderError } from "commander";
import { StudioError, errorMessage } from "../domain/errors";
import { registerAuthoringCommands } from "./commands/authoring";
import { registerDemoCommands } from "./commands/demo";
import { registerReviewCommands } from "./commands/review";
import { registerProductionCommands } from "./commands/production";
import { registerSetupCommands } from "./commands/setup";
import { registerVoiceCommands } from "./commands/voice";
import { createContainer, type Container } from "./container";
import { createOutput, type Output } from "./output";

/** Exit codes: 0 success, 1 the command failed, 2 the command was used incorrectly. */
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;

function findProjectRoot(): string {
  // Both src/cli/main.ts and dist/cli.js sit below the project root.
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.basename(here) === "dist" ? path.dirname(here) : path.resolve(here, "..", "..");
}

export function buildProgram(getContext: () => { container: Container; out: Output }): Command {
  const program = new Command()
    .name("studio")
    .description(
      "Iker Video Studio: turn a script into a recorded, narrated, rendered and checked video.",
    )
    .option("--json", "print the result as JSON on stdout (logs stay on stderr)")
    .showHelpAfterError("(run with --help for usage)")
    .exitOverride();
  registerSetupCommands(program, getContext);
  registerAuthoringCommands(program, getContext);
  registerProductionCommands(program, getContext);
  registerDemoCommands(program, getContext);
  registerVoiceCommands(program, getContext);
  registerReviewCommands(program, getContext);
  return program;
}

function report(error: unknown, json: boolean, redact: (text: string) => string): number {
  if (error instanceof CommanderError) {
    // Commander has already printed usage problems; help and version are not failures.
    return error.exitCode === 0 ? 0 : EXIT_USAGE;
  }
  const known = error instanceof StudioError;
  const message = redact(errorMessage(error));
  const hint = known && error.hint ? redact(error.hint) : null;
  if (json) {
    process.stdout.write(
      `${JSON.stringify({ ok: false, error: { code: known ? error.code : "UNEXPECTED", message, hint } }, null, 2)}\n`,
    );
  }
  process.stderr.write(`\nError: ${message}\n`);
  if (hint) process.stderr.write(`${hint}\n`);
  if (!known && error instanceof Error && error.stack && process.env.LOG_LEVEL === "debug") {
    process.stderr.write(`${redact(error.stack)}\n`);
  }
  return EXIT_FAILURE;
}

async function main(argv: readonly string[]): Promise<number> {
  const json = argv.includes("--json");
  // Held in an object so the catch block sees the container the command created.
  const state: { container: Container | null } = { container: null };
  const getContext = () => {
    state.container ??= createContainer(findProjectRoot());
    return { container: state.container, out: createOutput(json) };
  };
  try {
    await buildProgram(getContext).parseAsync([...argv]);
    return 0;
  } catch (error) {
    return report(error, json, state.container?.redact ?? ((text) => text));
  }
}

process.exitCode = await main(process.argv);
