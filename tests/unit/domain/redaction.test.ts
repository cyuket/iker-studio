import { describe, expect, it } from "vitest";
import {
  createRedactor,
  findPersonalData,
  findSecretPatterns,
} from "../../../src/domain/redaction";

describe("createRedactor", () => {
  const secret = "s3cr3t-demo-passw0rd";
  const redact = createRedactor([secret, "abc"]);

  it("removes configured secret values wherever they appear", () => {
    expect(redact(`login failed for password=${secret}`)).toBe(
      "login failed for password=[redacted]",
    );
  });

  it("removes well-known token shapes even when they were never configured", () => {
    expect(redact("Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345")).not.toContain(
      "abcdefghijklmnop",
    );
    expect(redact(`key sk_${"a1".repeat(24)}`)).toBe("key [redacted]");
  });

  it("ignores very short values that would blank ordinary words", () => {
    expect(redact("abc is a normal word")).toBe("abc is a normal word");
  });

  it("leaves ordinary text alone", () => {
    expect(redact("Rendering scene hook")).toBe("Rendering scene hook");
  });
});

describe("findSecretPatterns", () => {
  it("reports the kind and position but never the value", () => {
    const findings = findSecretPatterns("token ghp_abcdefghijklmnopqrstuvwxyz0123456789 here");
    expect(findings).toEqual([{ name: "github-token", index: 6 }]);
  });
});

describe("findPersonalData", () => {
  it("accepts emails on reserved documentation domains", () => {
    expect(findPersonalData("demo.operator@example.com and person@sandbox.test")).toEqual([]);
  });

  it("flags an email on a real domain, masked", () => {
    const [finding] = findPersonalData("contact jane.doe@gmail.com today");
    expect(finding?.name).toBe("email");
    expect(finding?.excerpt).not.toContain("jane.doe");
  });

  it("flags a valid card number but not an arbitrary long number", () => {
    expect(findPersonalData("card 4242 4242 4242 4242").map((f) => f.name)).toEqual([
      "card-number",
    ]);
    expect(findPersonalData("reference 1234567890123456")).toEqual([]);
  });
});
