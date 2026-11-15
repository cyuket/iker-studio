import { StudioError } from "../../domain/errors";

/**
 * Resolves a scenario path against the recording origin. A path that resolves anywhere else
 * (an absolute URL, or `//host`) is refused: the origin has been safety-checked, and a
 * scenario must not be able to steer the browser away from it.
 */
export function resolveScenarioUrl(origin: string, path: string): string {
  const url = new URL(path, origin);
  if (url.origin !== new URL(origin).origin) {
    throw new StudioError("UNSAFE_TARGET", `Scenario path "${path}" leaves the recording origin.`, {
      hint: "Scenario paths must be relative to the base URL, for example /verification/sessions.",
    });
  }
  return url.href;
}

/** A URL reduced to origin and path: query strings and fragments can carry tokens. */
export function withoutQuery(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "(no page loaded)";
  }
}
