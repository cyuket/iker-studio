import { describe, expect, it } from "vitest";
import { StudioError } from "../../../src/domain/errors";
import {
  assertSafeIkerBaseUrl,
  assertSafeRecordingTarget,
  isLiveHost,
  KNOWN_PRODUCTION_HOSTS,
} from "../../../src/infrastructure/recording/target-guard";
import { resolveScenarioUrl, withoutQuery } from "../../../src/infrastructure/recording/urls";

function unsafe(run: () => unknown): StudioError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(StudioError);
    const studioError = error as StudioError;
    expect(studioError.code).toBe("UNSAFE_TARGET");
    expect(studioError.hint).toBeTruthy();
    return studioError;
  }
  throw new Error("Expected the target to be refused");
}

describe("assertSafeIkerBaseUrl", () => {
  it("accepts staging and returns its origin", () => {
    expect(assertSafeIkerBaseUrl("https://staging.iker.example")).toBe(
      "https://staging.iker.example",
    );
    expect(assertSafeIkerBaseUrl("https://staging.iker.example/overview?x=1")).toBe(
      "https://staging.iker.example",
    );
  });

  it("accepts plain http only on this machine", () => {
    expect(assertSafeIkerBaseUrl("http://localhost:3000")).toBe("http://localhost:3000");
    expect(assertSafeIkerBaseUrl("http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
    expect(unsafe(() => assertSafeIkerBaseUrl("http://staging.iker.example")).message).toContain(
      "not encrypted",
    );
    expect(unsafe(() => assertSafeIkerBaseUrl("http://192.168.1.20:3000")).message).toContain(
      "not encrypted",
    );
  });

  it.each(KNOWN_PRODUCTION_HOSTS)("refuses the production host %s", (host) => {
    expect(unsafe(() => assertSafeIkerBaseUrl(`https://${host}`)).message).toContain(
      "production host",
    );
  });

  it("refuses production however the host is written", () => {
    unsafe(() => assertSafeIkerBaseUrl("https://USEIKER.COM"));
    unsafe(() => assertSafeIkerBaseUrl("https://useiker.com./overview"));
    unsafe(() => assertSafeIkerBaseUrl("https://app.useiker.com:443/auth/sign-in"));
    unsafe(() => assertSafeIkerBaseUrl("https://eu.useiker.com"));
  });

  it("refuses www and every other subdomain of production", () => {
    unsafe(() => assertSafeIkerBaseUrl("https://www.useiker.com"));
    unsafe(() => assertSafeIkerBaseUrl("https://admin.useiker.com"));
  });

  it("does not mistake a lookalike for production", () => {
    expect(assertSafeIkerBaseUrl("https://notuseiker.com")).toBe("https://notuseiker.com");
  });

  it("refuses hosts on the caller's extra deny-list", () => {
    const options = { extraDeniedHosts: ["Dashboard.Example.com"] };
    unsafe(() => assertSafeIkerBaseUrl("https://dashboard.example.com", options));
    unsafe(() => assertSafeIkerBaseUrl("https://eu.dashboard.example.com", options));
    expect(assertSafeIkerBaseUrl("https://staging.iker.example", options)).toBe(
      "https://staging.iker.example",
    );
  });

  it("refuses a URL that carries credentials, without repeating them", () => {
    const error = unsafe(() =>
      assertSafeIkerBaseUrl("https://operator:hunter2-secret@staging.iker.example"),
    );
    expect(`${error.message} ${error.hint ?? ""}`).not.toContain("hunter2-secret");
  });

  it("refuses values that are not URLs or use another scheme", () => {
    unsafe(() => assertSafeIkerBaseUrl("staging.iker.example"));
    unsafe(() => assertSafeIkerBaseUrl(""));
    unsafe(() => assertSafeIkerBaseUrl("file:///etc/hosts"));
  });
});

describe("assertSafeRecordingTarget", () => {
  it("applies the Iker rules to iker scenarios", () => {
    expect(assertSafeRecordingTarget("iker", "https://staging.iker.example")).toBe(
      "https://staging.iker.example",
    );
    unsafe(() => assertSafeRecordingTarget("iker", "https://useiker.com"));
    unsafe(() =>
      assertSafeRecordingTarget("iker", "https://x.example.com", {
        extraDeniedHosts: ["example.com"],
      }),
    );
  });

  it("keeps synthetic scenarios on the local fixture", () => {
    expect(assertSafeRecordingTarget("synthetic", "http://127.0.0.1:53123")).toBe(
      "http://127.0.0.1:53123",
    );
    unsafe(() => assertSafeRecordingTarget("synthetic", "https://staging.iker.example"));
  });
});

describe("resolveScenarioUrl", () => {
  it("resolves scenario paths against the origin, keeping any query", () => {
    expect(resolveScenarioUrl("https://staging.iker.example", "/verification/sessions")).toBe(
      "https://staging.iker.example/verification/sessions",
    );
    expect(resolveScenarioUrl("http://127.0.0.1:4000", "/transactions?history=1")).toBe(
      "http://127.0.0.1:4000/transactions?history=1",
    );
  });

  it("refuses a path that would leave the checked origin", () => {
    unsafe(() =>
      resolveScenarioUrl("https://staging.iker.example", "https://useiker.com/overview"),
    );
    unsafe(() => resolveScenarioUrl("https://staging.iker.example", "//useiker.com/overview"));
  });
});

describe("withoutQuery", () => {
  it("drops the query string and fragment, which can carry tokens", () => {
    expect(withoutQuery("https://staging.iker.example/auth/callback?token=abc123#frag")).toBe(
      "https://staging.iker.example/auth/callback",
    );
  });

  it("copes with a page that never loaded", () => {
    expect(withoutQuery("")).toBe("(no page loaded)");
  });
});

describe("production is never recorded", () => {
  it("points the operator at a local copy when production is refused", () => {
    expect(unsafe(() => assertSafeIkerBaseUrl("https://useiker.com")).hint).toContain("localhost");
    expect(isLiveHost("https://useiker.com/overview")).toBe(true);
    expect(isLiveHost("https://staging.iker.example")).toBe(false);
  });
});
