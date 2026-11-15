import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import type { S3Client } from "@aws-sdk/client-s3";
import { beforeEach, describe, expect, it } from "vitest";
import { sha256 } from "../../../src/domain/hash";
import { createR2ObjectStore } from "../../../src/infrastructure/storage/r2-object-store";

interface Stored {
  body: Buffer;
  contentType: string | undefined;
  metadata: Record<string, string>;
  acl: unknown;
  lastModified: Date;
}

/** In-memory stand-in for the S3 API surface the adapter uses. */
class FakeBucket {
  readonly objects = new Map<string, Stored>();
  readonly commands: string[] = [];
  /** Simulates a store that silently truncates uploads. */
  corruptUploads = false;

  client(): S3Client {
    return {
      send: (command: { constructor: { name: string }; input: Record<string, unknown> }) =>
        this.handle(command),
    } as unknown as S3Client;
  }

  private async handle(command: {
    constructor: { name: string };
    input: Record<string, unknown>;
  }): Promise<unknown> {
    const { input } = command;
    const key = input.Key as string;
    this.commands.push(command.constructor.name);
    switch (command.constructor.name) {
      case "PutObjectCommand": {
        const chunks: Buffer[] = [];
        for await (const chunk of input.Body as Readable) chunks.push(chunk as Buffer);
        const body = Buffer.concat(chunks);
        this.objects.set(key, {
          body: this.corruptUploads ? body.subarray(0, 3) : body,
          contentType: input.ContentType as string | undefined,
          metadata: input.Metadata as Record<string, string>,
          acl: input.ACL,
          lastModified: new Date("2026-01-01T00:00:00Z"),
        });
        return {};
      }
      case "HeadObjectCommand": {
        const object = this.objects.get(key);
        if (!object) throw new Error("NotFound");
        return {
          ContentLength: object.body.length,
          Metadata: object.metadata,
          LastModified: object.lastModified,
        };
      }
      case "GetObjectCommand": {
        const object = this.objects.get(key);
        if (!object) throw new Error("NoSuchKey");
        return { Body: Readable.from(object.body), Metadata: object.metadata };
      }
      case "ListObjectsV2Command": {
        const prefix = input.Prefix as string;
        const keys = [...this.objects.keys()].filter((k) => k.startsWith(prefix)).sort();
        // Two per page, to exercise pagination.
        const start = input.ContinuationToken ? Number(input.ContinuationToken) : 0;
        const page = keys.slice(start, start + 2);
        const more = start + 2 < keys.length;
        return {
          Contents: page.map((k) => ({
            Key: k,
            Size: this.objects.get(k)?.body.length,
            LastModified: this.objects.get(k)?.lastModified,
          })),
          IsTruncated: more,
          NextContinuationToken: more ? String(start + 2) : undefined,
        };
      }
      case "DeleteObjectCommand":
        this.objects.delete(key);
        return {};
      default:
        throw new Error(`unexpected command ${command.constructor.name}`);
    }
  }
}

let bucket: FakeBucket;
let dir: string;
let file: string;
const CONTENT = "rendered video bytes";

const store = () =>
  createR2ObjectStore({
    accountId: "acct",
    accessKeyId: "id",
    secretAccessKey: "secret",
    bucket: "videos",
    client: bucket.client(),
  });

beforeEach(async () => {
  bucket = new FakeBucket();
  dir = await mkdtemp(path.join(os.tmpdir(), "studio-r2-"));
  file = path.join(dir, "final.mp4");
  await writeFile(file, CONTENT);
});

describe("R2 object store", () => {
  it("uploads with content type and checksum metadata, and never sets a public ACL", async () => {
    const stored = await store().upload(file, "videos/demo/full/final.mp4", "video/mp4");
    const object = bucket.objects.get("videos/demo/full/final.mp4");
    expect(object?.contentType).toBe("video/mp4");
    expect(object?.metadata).toEqual({ sha256: sha256(CONTENT) });
    expect(object?.acl).toBeUndefined();
    expect(stored).toMatchObject({
      key: "videos/demo/full/final.mp4",
      sizeBytes: CONTENT.length,
      sha256: sha256(CONTENT),
    });
  });

  it("verifies the upload by reading the object back", async () => {
    await store().upload(file, "k", "video/mp4");
    expect(bucket.commands).toEqual(["PutObjectCommand", "HeadObjectCommand"]);
  });

  it("fails when the stored object does not match what was sent", async () => {
    bucket.corruptUploads = true;
    await expect(store().upload(file, "k", "video/mp4")).rejects.toMatchObject({
      code: "EXTERNAL_SERVICE",
      message: expect.stringContaining("could not be verified") as string,
    });
  });

  it("downloads to disk and checks the checksum", async () => {
    await store().upload(file, "k", "video/mp4");
    const target = path.join(dir, "nested", "copy.mp4");
    await store().download("k", target);
    expect(await readFile(target, "utf8")).toBe(CONTENT);
  });

  it("rejects a download whose bytes do not match the recorded checksum", async () => {
    await store().upload(file, "k", "video/mp4");
    const object = bucket.objects.get("k");
    if (object) object.body = Buffer.from("tampered");
    await expect(store().download("k", path.join(dir, "copy.mp4"))).rejects.toMatchObject({
      message: expect.stringContaining("Checksum mismatch") as string,
    });
  });

  it("lists every object under a prefix across pages", async () => {
    for (const key of ["videos/a/1", "videos/a/2", "videos/a/3", "assets/x"])
      await store().upload(file, key, "video/mp4");
    const listed = await store().list("videos/");
    expect(listed.map((object) => object.key)).toEqual(["videos/a/1", "videos/a/2", "videos/a/3"]);
  });

  it("removes an object", async () => {
    await store().upload(file, "k", "video/mp4");
    await store().remove("k");
    expect(bucket.objects.has("k")).toBe(false);
  });
});

describe("signed URLs", () => {
  it("signs a time-limited link against the account's R2 endpoint without exposing the secret", async () => {
    const real = createR2ObjectStore({
      accountId: "acct123",
      accessKeyId: "AKIDEXAMPLE",
      secretAccessKey: "very-secret-value",
      bucket: "videos",
    });
    const url = new URL(await real.signedUrl("videos/demo/full/final.mp4", 900));
    expect(url.hostname).toBe("videos.acct123.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/videos/demo/full/final.mp4");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/);
    expect(url.toString()).not.toContain("very-secret-value");
  });
});
