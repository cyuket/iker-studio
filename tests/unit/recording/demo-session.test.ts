import { describe, expect, it } from "vitest";
import {
  isSignedInPath,
  onlyDashboardState,
} from "../../../src/infrastructure/recording/demo-login";

const state = {
  cookies: [
    { name: "iker_session", domain: "useiker.com", value: "s" },
    { name: "iker_active_org", domain: "useiker.com", value: "o" },
    { name: "analytics", domain: ".useiker.com", value: "a" },
    { name: "SID", domain: ".google.com", value: "google-account-session" },
    { name: "LSID", domain: "accounts.google.com", value: "google-login" },
    { name: "SID", domain: ".youtube.com", value: "y" },
    { name: "evil", domain: "notuseiker.com.example.com", value: "x" },
    { name: "sibling", domain: "other.useiker.com", value: "x" },
  ],
  origins: [
    {
      origin: "https://useiker.com",
      localStorage: [{ name: "iker_environment", value: "sandbox" }],
    },
    { origin: "https://accounts.google.com", localStorage: [{ name: "token", value: "t" }] },
  ],
};

describe("onlyDashboardState", () => {
  const kept = onlyDashboardState(state, "https://useiker.com");

  it("keeps the dashboard's own cookies, including ones set on its parent domain", () => {
    expect(kept.cookies.map((cookie) => `${cookie.name}@${cookie.domain}`)).toEqual([
      "iker_session@useiker.com",
      "iker_active_org@useiker.com",
      "analytics@.useiker.com",
    ]);
  });

  it("never keeps the identity provider's cookies", () => {
    expect(JSON.stringify(kept)).not.toContain("google");
    expect(JSON.stringify(kept)).not.toContain("youtube");
  });

  it("drops lookalike and sibling hosts", () => {
    expect(kept.cookies.some((cookie) => cookie.name === "evil" || cookie.name === "sibling")).toBe(
      false,
    );
  });

  it("keeps local storage for the dashboard origin only", () => {
    expect(kept.origins.map((entry) => entry.origin)).toEqual(["https://useiker.com"]);
  });
});

describe("isSignedInPath", () => {
  it("treats the sign-in screens and the location picker as not signed in", () => {
    for (const path of ["/", "/login", "/auth/set-password", "/auth/invite", "/choose-location"]) {
      expect(isSignedInPath(path)).toBe(false);
    }
  });

  it("treats dashboard and admin pages as signed in", () => {
    for (const path of ["/dashboard", "/bookings/new", "/accounting/income", "/overview"]) {
      expect(isSignedInPath(path)).toBe(true);
    }
  });

  it("does not mistake a lookalike path for the sign-in page", () => {
    expect(isSignedInPath("/login-help")).toBe(false);
    expect(isSignedInPath("/loginx")).toBe(false);
  });
});
