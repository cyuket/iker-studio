import path from "node:path";
import type { AssetServer } from "../../application/ports";
import { StudioError } from "../../domain/errors";
import { startStaticServer } from "./static-server";

/**
 * Serves the given directories on loopback so the renderer can fetch local media. Remotion
 * loads assets over HTTP; serving them ourselves avoids copying large recordings into the
 * bundle's public folder on every render.
 */
export async function startAssetServer(
  directories: Readonly<Record<string, string>>,
): Promise<AssetServer> {
  const mounts = Object.entries(directories).map(([name, dir]) => ({
    name,
    dir: path.resolve(dir),
  }));
  const server = await startStaticServer({
    mounts: Object.fromEntries(mounts.map((mount) => [mount.name, mount.dir])),
  });
  return {
    urlFor(absolutePath) {
      const resolved = path.resolve(absolutePath);
      const mount = mounts.find((m) => resolved.startsWith(`${m.dir}${path.sep}`));
      if (!mount) {
        throw new StudioError(
          "NOT_FOUND",
          `${absolutePath} is outside the directories being served.`,
        );
      }
      const relative = path.relative(mount.dir, resolved).split(path.sep).map(encodeURIComponent);
      return `${server.origin}/${mount.name}/${relative.join("/")}`;
    },
    close: () => server.close(),
  };
}
