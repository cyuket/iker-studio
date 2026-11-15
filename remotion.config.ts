import { Config } from "@remotion/cli/config";

/**
 * Settings for `remotion studio`, `remotion still` and `remotion render` run from the CLI.
 * The Node pipeline calls @remotion/renderer directly and passes its own options, so this
 * file only shapes local review and one-off renders.
 */
Config.setEntryPoint("src/remotion/index.ts");
// PNG frames keep flat brand colour and hairlines free of JPEG ringing.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
