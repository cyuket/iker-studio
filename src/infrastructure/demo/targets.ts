import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { DemoTarget, DemoTargets } from "../../application/ports";
import { StudioError } from "../../domain/errors";
import { sha256 } from "../../domain/hash";
import type { Config } from "../config/env";
import { listFiles } from "../fs/node-file-system";
import { startStaticServer } from "../http/static-server";
import { assertSafeIkerBaseUrl } from "../recording/target-guard";

/** Host shown in the browser frame of synthetic footage. `.example` can never be a real site. */
const SYNTHETIC_DISPLAY_HOST = "demo-console.example";

/** Sign-in values for the bundled fixture. They unlock nothing: the fixture accepts any input. */
const SYNTHETIC_CREDENTIALS = {
  username: "demo.operator@example.com",
  password: "synthetic-demo-only",
};

async function fixtureFingerprint(dir: string): Promise<string> {
  const parts: string[] = [];
  for (const { file } of await listFiles(dir)) {
    parts.push(`${path.relative(dir, file)}:${sha256(await readFile(file))}`);
  }
  if (parts.length === 0) {
    throw new StudioError("NOT_FOUND", `The synthetic demo fixture is missing from ${dir}.`);
  }
  return sha256(parts.join("\n"));
}

export interface DemoTargetOptions {
  fixtureDir: string;
  /** Where `pnpm studio demo-login` saves the signed-in session. */
  sessionFile: string;
}

export function createDemoTargets(config: Config, options: DemoTargetOptions): DemoTargets {
  return {
    async open(target): Promise<DemoTarget> {
      if (target === "synthetic") {
        const fingerprint = await fixtureFingerprint(options.fixtureDir);
        const server = await startStaticServer({
          mounts: { "/": options.fixtureDir },
          htmlFallback: true,
        });
        return {
          baseUrl: server.origin,
          credentials: SYNTHETIC_CREDENTIALS,
          session: null,
          expect: null,
          displayHost: SYNTHETIC_DISPLAY_HOST,
          fingerprint,
          close: () => server.close(),
        };
      }
      const demo = config.demo();
      const origin = assertSafeIkerBaseUrl(demo.baseUrl, {
        extraDeniedHosts: demo.extraProductionHosts,
      });
      if (demo.credentials === null && !existsSync(options.sessionFile)) {
        throw new StudioError("CONFIG_INVALID", "There is no saved demo session to record with.", {
          hint: "Run `pnpm studio demo-login` and sign in in the window that opens.",
        });
      }
      return {
        baseUrl: origin,
        credentials: demo.credentials,
        session: demo.credentials === null ? { storageStateFile: options.sessionFile } : null,
        // Iker has no environments to confirm on the page. Safety comes from the host guard:
        // production is always refused, so only a local copy or staging can be filmed.
        expect: null,
        displayHost: new URL(origin).host,
        // Changing the host triggers a retake; no account detail is stored.
        fingerprint: sha256(origin),
        close: () => Promise.resolve(),
      };
    },
  };
}
