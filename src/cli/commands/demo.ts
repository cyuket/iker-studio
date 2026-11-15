import type { Command } from "commander";
import { StudioError } from "../../domain/errors";
import { captureDemoSession, snapshotDemoPage } from "../../infrastructure/recording/demo-login";
import { assertSafeIkerBaseUrl } from "../../infrastructure/recording/target-guard";
import type { Container } from "../container";
import type { Output } from "../output";

type Context = () => { container: Container; out: Output };

/** Validates the configured demo environment and returns its origin. Production is refused. */
function demoOrigin(container: Container): string {
  const demo = container.config.demo();
  return assertSafeIkerBaseUrl(demo.baseUrl, { extraDeniedHosts: demo.extraProductionHosts });
}

export function registerDemoCommands(program: Command, context: Context): void {
  program
    .command("demo-login")
    .description("open a browser for you to sign in to the demo business, and save the session")
    .action(async () => {
      const { container, out } = context();
      const origin = demoOrigin(container);
      const seen = await captureDemoSession({
        origin,
        ...container.demoSession,
        announce: (message) => out.line(message),
      });
      out.line(`\nSaved a session (signed in at ${seen.path}).`);
      out.line(
        "It is stored outside the repository, readable only by you, and reused until it expires.",
      );
      out.result({ origin, signedInAt: seen.path });
    });

  program
    .command("demo-snapshot")
    .description("print the accessibility tree of one demo page (read-only), for writing scenarios")
    .requiredOption("--path <path>", "page path, e.g. /bookings")
    .option("--out <file>", "write the tree to a file instead of printing it")
    .option(
      "--open <role:name...>",
      'open a tab or disclosure first, e.g. "tab:Upcoming"; "button:~More" matches part of a name (navigation only, never a control that saves)',
    )
    .option("--screenshot <file>", "also save a full-page picture")
    .action(
      async (options: { path: string; out?: string; open?: string[]; screenshot?: string }) => {
        const { container, out } = context();
        if (!options.path.startsWith("/")) {
          throw new StudioError("VALIDATION_FAILED", "--path must start with a slash.");
        }
        const origin = demoOrigin(container);
        const snapshot = await snapshotDemoPage({
          origin,
          path: options.path,
          sessionFile: container.demoSession.sessionFile,
          viewport: { width: 1440, height: 900 },
          open: (options.open ?? []).map((entry) => {
            const separator = entry.indexOf(":");
            if (separator < 1) {
              throw new StudioError(
                "VALIDATION_FAILED",
                `--open "${entry}" must look like role:name.`,
              );
            }
            return { role: entry.slice(0, separator), name: entry.slice(separator + 1) };
          }),
          screenshotFile: options.screenshot ?? null,
        });
        if (options.out) {
          await container.core.files.writeText(options.out, snapshot.tree);
          out.line(snapshot.url);
          out.line(`Written: ${options.out}`);
        } else {
          out.line(`${snapshot.url}\n`);
          out.line(snapshot.tree);
        }
        out.result(snapshot);
      },
    );
}
