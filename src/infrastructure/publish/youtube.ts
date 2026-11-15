import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { Readable } from "node:stream";
import { z } from "zod";
import type { PublishRequest, VideoPublisher } from "../../application/ports";
import { StudioError } from "../../domain/errors";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_URL =
  "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";
const THUMBNAIL_URL = "https://www.googleapis.com/upload/youtube/v3/thumbnails/set";
/** Upload-only scope: this tool can add videos but cannot read or manage the channel. */
const SCOPE = "https://www.googleapis.com/auth/youtube.upload";

const StoredTokenSchema = z.object({ refreshToken: z.string().min(1) });
const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
});
const VideoResponseSchema = z.object({ id: z.string().min(1) });

export interface YouTubeOptions {
  clientId: string;
  clientSecret: string;
  /** Where the refresh token is kept: outside the repository, readable by the owner only. */
  tokenFile: string;
  fetch?: typeof fetch;
}

async function exchange(
  options: YouTubeOptions,
  body: Record<string, string>,
): Promise<z.infer<typeof TokenResponseSchema>> {
  const response = await (options.fetch ?? fetch)(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: options.clientId,
      client_secret: options.clientSecret,
      ...body,
    }),
  });
  if (!response.ok) {
    throw new StudioError(
      "EXTERNAL_SERVICE",
      `Google refused the token request (HTTP ${response.status}).`,
      {
        hint: "Run `pnpm studio publish-auth` again to re-authorise.",
      },
    );
  }
  return TokenResponseSchema.parse(await response.json());
}

/**
 * One-time authorisation using the OAuth loopback flow for installed apps. Prints a URL
 * for the operator to open; the refresh token is stored with owner-only permissions.
 */
export async function authoriseYouTube(
  options: YouTubeOptions,
  announce: (url: string) => void,
): Promise<void> {
  const state = randomBytes(16).toString("hex");
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const redirectUri = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const code = new Promise<string>((resolve, reject) => {
    server.on("request", (request, response) => {
      const url = new URL(request.url ?? "/", redirectUri);
      const received = url.searchParams.get("code");
      if (url.searchParams.get("state") !== state || !received) {
        response.writeHead(400).end("Authorisation failed. You can close this tab.");
        reject(
          new StudioError(
            "EXTERNAL_SERVICE",
            "Authorisation was cancelled or the response was invalid.",
          ),
        );
        return;
      }
      response.writeHead(200).end("Authorised. You can close this tab and return to the terminal.");
      resolve(received);
    });
  });

  const query = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  announce(`${AUTH_URL}?${query.toString()}`);
  try {
    const tokens = await exchange(options, {
      code: await code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });
    if (!tokens.refresh_token) {
      throw new StudioError("EXTERNAL_SERVICE", "Google did not return a refresh token.", {
        hint: "Remove the app's access at myaccount.google.com/permissions and authorise again.",
      });
    }
    await mkdir(path.dirname(options.tokenFile), { recursive: true, mode: 0o700 });
    await writeFile(options.tokenFile, JSON.stringify({ refreshToken: tokens.refresh_token }), {
      mode: 0o600,
    });
    await chmod(options.tokenFile, 0o600);
  } finally {
    server.close();
  }
}

/** YouTube's own explanation of a refusal, when it sent one. Never includes credentials. */
async function apiReason(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  const body: unknown = (() => {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  })();
  const parsed = z
    .object({
      error: z.object({
        message: z.string(),
        errors: z.array(z.object({ reason: z.string() })).optional(),
      }),
    })
    .safeParse(body);
  if (!parsed.success) return text.trim() ? ` YouTube says: ${text.trim().slice(0, 300)}` : "";
  const reason = parsed.data.error.errors?.[0]?.reason;
  return ` YouTube says: ${parsed.data.error.message}${reason ? ` (${reason})` : ""}`;
}

export function createYouTubePublisher(options: YouTubeOptions): VideoPublisher {
  const doFetch = options.fetch ?? fetch;

  const accessToken = async (): Promise<string> => {
    const stored = await readFile(options.tokenFile, "utf8").catch(() => null);
    const parsed = StoredTokenSchema.safeParse(stored === null ? null : JSON.parse(stored));
    if (!parsed.success) {
      throw new StudioError("CONFIG_INVALID", "YouTube has not been authorised on this machine.", {
        hint: "Run `pnpm studio publish-auth` once, or publish manually from the export package.",
      });
    }
    const tokens = await exchange(options, {
      refresh_token: parsed.data.refreshToken,
      grant_type: "refresh_token",
    });
    return tokens.access_token;
  };

  const sendFile = async (
    url: string,
    token: string,
    file: string,
    contentType: string,
  ): Promise<Response> => {
    const { size } = await stat(file);
    return doFetch(url, {
      method: url === THUMBNAIL_URL || url.startsWith(`${THUMBNAIL_URL}?`) ? "POST" : "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
        "Content-Length": String(size),
      },
      body: Readable.toWeb(createReadStream(file)) as ReadableStream,
      duplex: "half",
    } as RequestInit);
  };

  return {
    async publish(request: PublishRequest) {
      const token = await accessToken();
      const session = await doFetch(UPLOAD_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": "video/mp4",
        },
        body: JSON.stringify({
          snippet: {
            title: request.title,
            description: request.description,
            tags: request.tags,
            categoryId: "28",
          },
          status: { privacyStatus: request.privacy, selfDeclaredMadeForKids: false },
        }),
      });
      const uploadUrl = session.headers.get("location");
      if (!session.ok || !uploadUrl) {
        throw new StudioError(
          "EXTERNAL_SERVICE",
          `YouTube did not start the upload (HTTP ${session.status}).${await apiReason(session)}`,
          {
            hint: "Check that the YouTube Data API v3 is enabled for the OAuth project and has quota left.",
          },
        );
      }
      const uploaded = await sendFile(uploadUrl, token, request.file, "video/mp4");
      if (!uploaded.ok) {
        throw new StudioError(
          "EXTERNAL_SERVICE",
          `YouTube rejected the video upload (HTTP ${uploaded.status}).${await apiReason(uploaded)}`,
        );
      }
      const { id } = VideoResponseSchema.parse(await uploaded.json());

      // Custom thumbnails need a verified channel; a refusal must not fail a finished upload.
      let thumbnailSet = false;
      if (request.thumbnail) {
        const response = await sendFile(
          `${THUMBNAIL_URL}?videoId=${encodeURIComponent(id)}`,
          token,
          request.thumbnail,
          "image/png",
        );
        thumbnailSet = response.ok;
      }
      return { videoId: id, url: `https://www.youtube.com/watch?v=${id}`, thumbnailSet };
    },

    async setThumbnail(videoId: string, file: string) {
      const response = await sendFile(
        `${THUMBNAIL_URL}?videoId=${encodeURIComponent(videoId)}`,
        await accessToken(),
        file,
        "image/png",
      );
      if (!response.ok) {
        throw new StudioError(
          "EXTERNAL_SERVICE",
          `YouTube did not accept the thumbnail (HTTP ${response.status}).${await apiReason(response)}`,
          { hint: "Custom thumbnails need a phone-verified channel: youtube.com/verify." },
        );
      }
    },
  };
}
