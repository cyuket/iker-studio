import { createHash } from "node:crypto";

/** JSON with object keys sorted, so equal values always serialise to equal strings. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => [k, sortKeys(v)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

export function sha256(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Content hash of any JSON-serialisable value. */
export function hashOf(value: unknown): string {
  return sha256(stableStringify(value));
}

/** Short form used in file names; the full hash is always kept in the manifest. */
export function shortHash(hash: string): string {
  return hash.slice(0, 16);
}
