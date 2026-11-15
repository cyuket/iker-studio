import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  openBrowser,
  renderMedia,
  renderStill,
  selectComposition,
  type HeadlessBrowser,
} from "@remotion/renderer";
import type {
  Logger,
  SceneRenderRequest,
  SceneStillRequest,
  VideoRenderer,
} from "../../application/ports";
import { StudioError, errorMessage } from "../../domain/errors";
import { sha256 } from "../../domain/hash";
import { COMPOSITION_IDS, type ThumbnailRenderProps } from "../../domain/render-props";
import { listFiles } from "../fs/node-file-system";

export interface RemotionRendererOptions {
  projectRoot: string;
  concurrency: number | undefined;
  /** Company licence key, when the organisation needs one. See docs/LICENSING.md. */
  licenseKey: string | null;
  logger: Logger;
}

/** File extension of scene segments: H.264 video with uncompressed audio. */
export const SEGMENT_EXTENSION = "mkv";

/**
 * Renders scenes and stills with Remotion. One bundle and one browser are shared by every
 * render in a command, since both are expensive to create.
 */
export function createRemotionRenderer(options: RemotionRendererOptions): VideoRenderer {
  const entryPoint = path.join(options.projectRoot, "src", "remotion", "index.ts");
  const log = options.logger.child({ component: "remotion" });
  let serveUrl: string | null = null;
  let browser: HeadlessBrowser | null = null;

  const session = (): { serveUrl: string; browser: HeadlessBrowser } => {
    if (!serveUrl || !browser) throw new Error("Renderer used before open()");
    return { serveUrl, browser };
  };
  const licence = options.licenseKey === null ? {} : { licenseKey: options.licenseKey };

  const failed = (what: string, error: unknown): StudioError =>
    new StudioError("RENDER_FAILED", `Rendering ${what} failed: ${errorMessage(error)}`, {
      hint: "Open the scene in `pnpm studio preview --studio` to reproduce it frame by frame.",
      cause: error,
    });

  return {
    async open() {
      if (serveUrl) return;
      await ensureBrowser({ logLevel: "error" });
      log.info("Bundling the Remotion project");
      serveUrl = await bundle({ entryPoint, enableCaching: true });
      browser = await openBrowser("chrome", { logLevel: "error" });
    },

    async renderScene(request: SceneRenderRequest) {
      const current = session();
      // Props travel as JSON; the cast only tells Remotion's loosely typed API so.
      const inputProps = request.props as unknown as Record<string, unknown>;
      try {
        const composition = await selectComposition({
          serveUrl: current.serveUrl,
          id: COMPOSITION_IDS.scene,
          inputProps,
          puppeteerInstance: current.browser,
          logLevel: "error",
        });
        await renderMedia({
          serveUrl: current.serveUrl,
          composition,
          inputProps,
          puppeteerInstance: current.browser,
          codec: "h264-mkv",
          // Uncompressed audio in segments: AAC adds padding to every file, which would
          // accumulate as drift and clicks when segments are joined.
          audioCodec: "pcm-16",
          enforceAudioTrack: true,
          pixelFormat: "yuv420p",
          colorSpace: "bt709",
          crf: request.crf,
          jpegQuality: request.jpegQuality,
          scale: request.scale,
          concurrency: options.concurrency ?? null,
          outputLocation: request.output,
          overwrite: true,
          logLevel: "error",
          ...licence,
        });
      } catch (error) {
        throw failed(`scene "${request.props.scene.id}"`, error);
      }
    },

    async renderThumbnail(props: ThumbnailRenderProps, output: string) {
      const current = session();
      const inputProps = props as unknown as Record<string, unknown>;
      try {
        const composition = await selectComposition({
          serveUrl: current.serveUrl,
          id: COMPOSITION_IDS.thumbnail,
          inputProps,
          puppeteerInstance: current.browser,
          logLevel: "error",
        });
        await renderStill({
          serveUrl: current.serveUrl,
          composition,
          inputProps,
          puppeteerInstance: current.browser,
          imageFormat: "png",
          output,
          overwrite: true,
          logLevel: "error",
          ...licence,
        });
      } catch (error) {
        throw failed(`thumbnail "${props.variant}"`, error);
      }
    },

    async renderSceneStill(request: SceneStillRequest) {
      const current = session();
      const inputProps = request.props as unknown as Record<string, unknown>;
      try {
        const composition = await selectComposition({
          serveUrl: current.serveUrl,
          id: COMPOSITION_IDS.scene,
          inputProps,
          puppeteerInstance: current.browser,
          logLevel: "error",
        });
        await renderStill({
          serveUrl: current.serveUrl,
          composition,
          inputProps,
          puppeteerInstance: current.browser,
          frame: Math.min(Math.max(0, request.frame), composition.durationInFrames - 1),
          scale: request.scale,
          imageFormat: "png",
          output: request.output,
          overwrite: true,
          logLevel: "error",
          ...licence,
        });
      } catch (error) {
        throw failed(`a still of scene "${request.props.scene.id}"`, error);
      }
    },

    async sourceHash() {
      const require = createRequire(import.meta.url);
      const { version } = require("remotion/package.json") as { version: string };
      const parts: string[] = [`remotion@${version}`];
      // Domain types shape the props, so a change there can change a frame as well.
      for (const dir of ["src/remotion", "src/domain"]) {
        for (const { file } of await listFiles(path.join(options.projectRoot, dir))) {
          parts.push(`${path.relative(options.projectRoot, file)}:${sha256(await readFile(file))}`);
        }
      }
      return sha256(parts.join("\n"));
    },

    async close() {
      const open = browser;
      browser = null;
      serveUrl = null;
      if (open) await open.close({ silent: true });
    },
  };
}
