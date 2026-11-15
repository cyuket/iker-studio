import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".srt": "application/x-subrip",
  ".vtt": "text/vtt; charset=utf-8",
};

export function contentTypeFor(file: string): string {
  return CONTENT_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}

export interface StaticServer {
  /** e.g. http://127.0.0.1:53123 */
  origin: string;
  close(): Promise<void>;
}

export interface StaticServerOptions {
  /** URL prefix to directory. Only files inside these directories are ever served. */
  mounts: Readonly<Record<string, string>>;
  /** Serve `<dir>/index.html` for directory paths and `<path>.html` for extensionless ones. */
  htmlFallback?: boolean;
}

/**
 * Loopback-only file server with Range support, used to hand local media to the renderer
 * and to host the synthetic demo fixture. It binds to 127.0.0.1 so nothing on the network
 * can reach generated assets.
 */
export async function startStaticServer(options: StaticServerOptions): Promise<StaticServer> {
  const mounts = Object.entries(options.mounts)
    .map(([prefix, dir]) => ({
      prefix: `/${prefix.replace(/^\/+|\/+$/g, "")}`,
      dir: path.resolve(dir),
    }))
    .sort((a, b) => b.prefix.length - a.prefix.length);

  const server = createServer((request, response) => {
    serve(request, response, mounts, options.htmlFallback ?? false).catch(() => {
      if (!response.headersSent) response.writeHead(500);
      response.end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

async function serve(
  request: IncomingMessage,
  response: ServerResponse,
  mounts: readonly { prefix: string; dir: string }[],
  htmlFallback: boolean,
): Promise<void> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405).end();
    return;
  }
  const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  const mount = mounts.find(
    (m) => m.prefix === "/" || pathname === m.prefix || pathname.startsWith(`${m.prefix}/`),
  );
  if (!mount) {
    response.writeHead(404).end();
    return;
  }
  const relative = mount.prefix === "/" ? pathname : pathname.slice(mount.prefix.length);
  const file = await resolveFile(mount.dir, relative, htmlFallback);
  if (!file) {
    response.writeHead(404).end();
    return;
  }

  const { size } = await stat(file);
  const headers: Record<string, string | number> = {
    "Content-Type": contentTypeFor(file),
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? "");
  let start = 0;
  let end = size - 1;
  if (range && (range[1] || range[2])) {
    if (range[1]) {
      start = Number(range[1]);
      if (range[2]) end = Math.min(Number(range[2]), size - 1);
    } else {
      start = Math.max(0, size - Number(range[2]));
    }
    if (start > end || start >= size) {
      response.writeHead(416, { "Content-Range": `bytes */${size}` }).end();
      return;
    }
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
    response.writeHead(206, { ...headers, "Content-Length": end - start + 1 });
  } else {
    response.writeHead(200, { ...headers, "Content-Length": size });
  }
  if (request.method === "HEAD" || size === 0) {
    response.end();
    return;
  }
  createReadStream(file, { start, end }).pipe(response);
}

/** Resolves a request path to a file, refusing anything that escapes the mounted directory. */
async function resolveFile(
  dir: string,
  relative: string,
  htmlFallback: boolean,
): Promise<string | null> {
  const candidate = path.resolve(dir, `.${path.posix.normalize(`/${relative}`)}`);
  if (candidate !== dir && !candidate.startsWith(`${dir}${path.sep}`)) return null;
  const candidates = htmlFallback
    ? [candidate, path.join(candidate, "index.html"), `${candidate}.html`]
    : [candidate];
  for (const file of candidates) {
    const info = await stat(file).catch(() => null);
    if (info?.isFile()) return file;
  }
  return null;
}
