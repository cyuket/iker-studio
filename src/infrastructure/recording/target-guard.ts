import { StudioError } from "../../domain/errors";
import type { Scenario } from "../../domain/recording";

/**
 * Hosts that serve real businesses' bookings and money records. Iker's production web app
 * is `useiker.com` (and every subdomain, including `www`). Iker has no Sandbox mode, so
 * record against a local copy of the web app (`http://localhost:3000`) with seeded demo
 * data, or a dedicated staging host. `staging.iker.example` appears in examples only.
 */
export const KNOWN_PRODUCTION_HOSTS: readonly string[] = ["useiker.com"];

const LOOPBACK_HOSTS: readonly string[] = ["localhost", "127.0.0.1", "[::1]"];

export interface TargetGuardOptions {
  /** Hostnames to refuse in addition to the built-in production hosts. */
  extraDeniedHosts?: readonly string[];
}

const normaliseHost = (host: string): string => host.trim().toLowerCase().replace(/\.$/, "");

function parseBaseUrl(baseUrl: string): URL {
  try {
    return new URL(baseUrl);
  } catch {
    throw new StudioError("UNSAFE_TARGET", "The demo base URL is not a valid URL.", {
      hint: "Set it to an origin such as https://staging.iker.example, with no path or credentials.",
    });
  }
}

function assertNoEmbeddedCredentials(url: URL): void {
  if (url.username === "" && url.password === "") return;
  throw new StudioError(
    "UNSAFE_TARGET",
    "The demo base URL must not contain a username or password.",
    {
      hint: "Remove the credentials from the URL and supply the demo account through the environment.",
    },
  );
}

function assertTransport(url: URL, host: string): void {
  if (url.protocol === "https:") return;
  if (url.protocol === "http:" && LOOPBACK_HOSTS.includes(host)) return;
  throw new StudioError(
    "UNSAFE_TARGET",
    `Refusing to record ${url.protocol}//${host}: it is not encrypted.`,
    {
      hint: "Use an https:// address. Plain http is accepted only for localhost and 127.0.0.1.",
    },
  );
}

const matches = (host: string, entries: readonly string[]): boolean =>
  entries.some((entry) => host === entry || host.endsWith(`.${entry}`));

/** True for a host that also serves live customer data. */
export function isLiveHost(baseUrl: string): boolean {
  return matches(normaliseHost(parseBaseUrl(baseUrl).hostname), KNOWN_PRODUCTION_HOSTS);
}

function assertNotProduction(host: string, denied: readonly string[]): void {
  if (!matches(host, denied)) return;
  throw new StudioError("UNSAFE_TARGET", `Refusing to record ${host}: it is a production host.`, {
    hint: "Record a non-production environment such as https://staging.iker.example, such as a local copy at http://localhost:3000. Iker has no Sandbox, so production is never recorded.",
  });
}

/**
 * Validates where a `iker` scenario is about to run, so that a recording can never sign
 * in to, click through or film an environment holding real customers' data. Returns the
 * normalised origin to record against.
 */
export function assertSafeIkerBaseUrl(baseUrl: string, options: TargetGuardOptions = {}): string {
  const url = parseBaseUrl(baseUrl);
  const host = normaliseHost(url.hostname);
  assertNoEmbeddedCredentials(url);
  assertTransport(url, host);
  // Production and any host the operator added are refused. There is no opt-in: Iker has
  // no Sandbox, so a production host always holds real businesses' records.
  assertNotProduction(host, [
    ...KNOWN_PRODUCTION_HOSTS.map(normaliseHost),
    ...(options.extraDeniedHosts ?? []).map(normaliseHost),
  ]);
  return url.origin;
}

/** The bundled fixture is only ever served from this machine; anything else is a mix-up. */
function assertLoopbackBaseUrl(baseUrl: string): string {
  const url = parseBaseUrl(baseUrl);
  if (LOOPBACK_HOSTS.includes(normaliseHost(url.hostname))) return url.origin;
  throw new StudioError(
    "UNSAFE_TARGET",
    "Synthetic scenarios run only against the local demo fixture.",
    {
      hint: "Serve fixtures/synthetic-demo locally and pass its http://127.0.0.1 origin.",
    },
  );
}

/** Checks a base URL against the rules for the scenario's target and returns its origin. */
export function assertSafeRecordingTarget(
  target: Scenario["target"],
  baseUrl: string,
  options: TargetGuardOptions = {},
): string {
  return target === "iker"
    ? assertSafeIkerBaseUrl(baseUrl, options)
    : assertLoopbackBaseUrl(baseUrl);
}
