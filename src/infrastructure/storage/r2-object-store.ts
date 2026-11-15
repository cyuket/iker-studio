import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ObjectStore, StoredObject } from "../../application/ports";
import { StudioError } from "../../domain/errors";
import { sha256File } from "../fs/node-file-system";

export interface R2Options {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Injected in tests; production builds the client from the credentials. */
  client?: S3Client;
}

const SHA_METADATA = "sha256";

/**
 * Cloudflare R2 through its S3-compatible API. Objects are private: nothing here sets a
 * public ACL or touches bucket-level public access, and sharing is only by signed URL.
 */
export function createR2ObjectStore(options: R2Options): ObjectStore {
  const client =
    options.client ??
    new S3Client({
      region: "auto",
      endpoint: `https://${options.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    });
  const Bucket = options.bucket;

  const head = async (key: string): Promise<StoredObject> => {
    const result = await client.send(new HeadObjectCommand({ Bucket, Key: key }));
    return {
      key,
      sizeBytes: result.ContentLength ?? 0,
      sha256: result.Metadata?.[SHA_METADATA] ?? null,
      lastModified: result.LastModified ?? null,
    };
  };

  return {
    async upload(file, key, contentType) {
      const [{ size }, sha256] = await Promise.all([stat(file), sha256File(file)]);
      await client.send(
        new PutObjectCommand({
          Bucket,
          Key: key,
          Body: createReadStream(file),
          ContentLength: size,
          ContentType: contentType,
          Metadata: { [SHA_METADATA]: sha256 },
        }),
      );
      // Read the object back rather than trusting the PUT response.
      const stored = await head(key);
      if (stored.sizeBytes !== size || stored.sha256 !== sha256) {
        throw new StudioError("EXTERNAL_SERVICE", `Upload of ${key} could not be verified.`, {
          hint: "Run the export again; the object in the bucket may be incomplete.",
        });
      }
      return stored;
    },

    async download(key, file) {
      const result = await client.send(new GetObjectCommand({ Bucket, Key: key }));
      if (!(result.Body instanceof Readable)) {
        throw new StudioError("EXTERNAL_SERVICE", `R2 returned no data for ${key}.`);
      }
      await mkdir(path.dirname(file), { recursive: true });
      await pipeline(result.Body, createWriteStream(file));
      const expected = result.Metadata?.[SHA_METADATA];
      if (expected && expected !== (await sha256File(file))) {
        throw new StudioError("EXTERNAL_SERVICE", `Checksum mismatch after downloading ${key}.`, {
          hint: "Download it again; do not use the local copy.",
        });
      }
    },

    async list(prefix) {
      const objects: StoredObject[] = [];
      let ContinuationToken: string | undefined;
      do {
        const page = await client.send(
          new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken }),
        );
        for (const item of page.Contents ?? []) {
          if (item.Key === undefined) continue;
          objects.push({
            key: item.Key,
            sizeBytes: item.Size ?? 0,
            sha256: null,
            lastModified: item.LastModified ?? null,
          });
        }
        ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (ContinuationToken);
      return objects;
    },

    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },

    signedUrl(key, expiresSeconds) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket, Key: key }), {
        expiresIn: expiresSeconds,
      });
    },
  };
}
