import { defineConfig } from "tsup";

// The CLI is bundled for production use; the Remotion project under src/remotion is
// bundled separately by Remotion at render time and is therefore not an entry here.
export default defineConfig({
  entry: { cli: "src/cli/main.ts" },
  format: "esm",
  target: "node22",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  skipNodeModulesBundle: true,
  banner: { js: "#!/usr/bin/env node" },
});
