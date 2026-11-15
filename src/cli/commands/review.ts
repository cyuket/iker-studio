import path from "node:path";
import type { Command } from "commander";
import { reviewScenes } from "../../application/scene-review";
import type { Container } from "../container";
import type { Output } from "../output";
import { plural, videoOption } from "../shared";

type Context = () => { container: Container; out: Output };

export function registerReviewCommands(program: Command, context: Context): void {
  program
    .command("scene-review")
    .description(
      "look at every scene before a full render: key frames, a clip and direction problems",
    )
    .addOption(videoOption())
    .option("--cut <id>", "cut to review (default: the first cut)")
    .option("--scene <id...>", "review only these scenes")
    .option("--baseline <dir>", "frames from an earlier version to show beside the new ones")
    .action(
      async (options: { video: string; cut?: string; scene?: string[]; baseline?: string }) => {
        const { container, out } = context();
        const before = path.join(
          container.core.layout.video(options.video).root,
          "review",
          "before",
          "frames",
        );
        const outcome = await reviewScenes(container.render, {
          videoId: options.video,
          ...(options.cut === undefined ? {} : { cutId: options.cut }),
          ...(options.scene === undefined ? {} : { sceneIds: options.scene }),
          baselineDir: options.baseline ?? before,
        });
        for (const scene of outcome.scenes) {
          out.line(
            `${scene.concerns.length ? "FIX " : "look"}  ${scene.sceneId}: ${plural(scene.frames.length, "frame")}${scene.clip ? ", clip" : ""}`,
          );
          for (const concern of scene.concerns) out.line(`        ${concern}`);
        }
        out.line(`\nReport:        ${outcome.report}`);
        out.line(`Contact sheet: ${outcome.contactSheet}`);
        out.line("Open the report and judge each scene. Rendering without errors is not a pass.");
        out.result(outcome);
      },
    );
}
