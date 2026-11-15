import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createYouTubePublisher } from "../../../src/infrastructure/publish/youtube";

const CLIENT_SECRET = "client-secret-never-real";
const REFRESH_TOKEN = "refresh-token-never-real";

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
}

let dir: string;
let tokenFile: string;
let video: string;
let thumbnail: string;
let calls: Call[];

function publisher(responses: Response[]) {
  const queue = [...responses];
  const fetchFake = (async (url: string | URL | Request, init?: RequestInit) => {
    const body = init?.body;
    calls.push({
      url: typeof url === "string" ? url : url instanceof URL ? url.href : url.url,
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body:
        typeof body === "string"
          ? body
          : body instanceof URLSearchParams
            ? body.toString()
            : body
              ? await new Response(body as ReadableStream).text()
              : null,
    });
    const next = queue.shift();
    if (!next) throw new Error("unexpected extra request");
    return next;
  }) as typeof fetch;
  return createYouTubePublisher({
    clientId: "client-id",
    clientSecret: CLIENT_SECRET,
    tokenFile,
    fetch: fetchFake,
  });
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

const request = () => ({
  file: video,
  title: "Finding duplicate customers",
  description: "What the video covers.",
  tags: ["identity verification"],
  privacy: "private" as const,
  thumbnail,
});

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "studio-youtube-"));
  tokenFile = path.join(dir, "token.json");
  video = path.join(dir, "final.mp4");
  thumbnail = path.join(dir, "thumb.png");
  await writeFile(tokenFile, JSON.stringify({ refreshToken: REFRESH_TOKEN }));
  await writeFile(video, "video-bytes");
  await writeFile(thumbnail, "png-bytes");
  calls = [];
});

describe("YouTube publisher", () => {
  it("refreshes the token, opens a resumable upload, sends the file and sets the thumbnail", async () => {
    const result = await publisher([
      json(200, { access_token: "access-1" }),
      json(200, {}, { location: "https://upload.example.test/session-1" }),
      json(200, { id: "yt123" }),
      json(200, {}),
    ]).publish(request());

    expect(result).toEqual({
      videoId: "yt123",
      url: "https://www.youtube.com/watch?v=yt123",
      thumbnailSet: true,
    });
    const [token, session, upload, thumb] = calls;
    expect(token?.url).toBe("https://oauth2.googleapis.com/token");
    expect(token?.body).toContain("grant_type=refresh_token");
    expect(session?.url).toContain("uploadType=resumable");
    expect(session?.headers.Authorization).toBe("Bearer access-1");
    expect(JSON.parse(session?.body ?? "{}")).toMatchObject({
      snippet: { title: "Finding duplicate customers", tags: ["identity verification"] },
      status: { privacyStatus: "private", selfDeclaredMadeForKids: false },
    });
    expect(upload).toMatchObject({
      url: "https://upload.example.test/session-1",
      method: "PUT",
      body: "video-bytes",
    });
    expect(thumb?.url).toContain("thumbnails/set?videoId=yt123");
    expect(thumb).toMatchObject({ method: "POST", body: "png-bytes" });
  });

  it("keeps a finished upload when YouTube refuses the thumbnail", async () => {
    const result = await publisher([
      json(200, { access_token: "access-1" }),
      json(200, {}, { location: "https://upload.example.test/session-1" }),
      json(200, { id: "yt123" }),
      json(403, { error: "forbidden" }),
    ]).publish(request());
    expect(result).toMatchObject({ videoId: "yt123", thumbnailSet: false });
  });

  it("explains how to authorise when no token is stored, without calling Google", async () => {
    await writeFile(tokenFile, "{}");
    await expect(publisher([]).publish(request())).rejects.toMatchObject({
      code: "CONFIG_INVALID",
      hint: expect.stringContaining("publish-auth") as string,
    });
    expect(calls).toEqual([]);
  });

  it("stops before uploading when the token or the upload session is refused", async () => {
    await expect(
      publisher([json(400, { error: "invalid_grant" })]).publish(request()),
    ).rejects.toMatchObject({ code: "EXTERNAL_SERVICE" });
    calls = [];
    await expect(
      publisher([
        json(200, { access_token: "access-1" }),
        json(403, { error: "quotaExceeded" }),
      ]).publish(request()),
    ).rejects.toMatchObject({
      code: "EXTERNAL_SERVICE",
      hint: expect.stringContaining("quota") as string,
    });
    expect(calls.map((call) => call.method)).toEqual(["POST", "POST"]);
  });

  it("never puts the client secret or refresh token in an error", async () => {
    const error = await publisher([json(400, { error: "invalid_grant" })])
      .publish(request())
      .catch((caught: unknown) => caught as Error & { hint?: string });
    const text = `${(error as Error).message} ${(error as { hint?: string }).hint ?? ""}`;
    expect(text).not.toContain(CLIENT_SECRET);
    expect(text).not.toContain(REFRESH_TOKEN);
  });
});
