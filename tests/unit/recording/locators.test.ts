import { describe, expect, it } from "vitest";
import type { Target } from "../../../src/domain/recording";
import { TargetSchema } from "../../../src/domain/recording";
import { resolveTarget, type ScopedLocator } from "../../../src/infrastructure/recording/locators";

/** Records which queries were made, in order, instead of running them. */
class FakeLocator extends Array<unknown> implements ScopedLocator<FakeLocator> {
  private chain(...call: unknown[]): FakeLocator {
    return FakeLocator.from([...this, ...call]) as FakeLocator;
  }
  getByRole(...args: unknown[]): FakeLocator {
    return this.chain("role", ...args);
  }
  getByLabel(...args: unknown[]): FakeLocator {
    return this.chain("label", ...args);
  }
  getByTestId(...args: unknown[]): FakeLocator {
    return this.chain("testId", ...args);
  }
  getByText(...args: unknown[]): FakeLocator {
    return this.chain("text", ...args);
  }
  getByPlaceholder(...args: unknown[]): FakeLocator {
    return this.chain("placeholder", ...args);
  }
  nth(index: number): FakeLocator {
    return this.chain("nth", index);
  }
}

const resolve = (target: unknown): unknown[] => [
  ...resolveTarget(new FakeLocator(), TargetSchema.parse(target)),
];

describe("resolveTarget", () => {
  it("finds a role target by role and accessible name", () => {
    expect(resolve({ role: "button", name: "Publish changes" })).toEqual([
      "role",
      "button",
      { name: "Publish changes", exact: false },
    ]);
  });

  it("passes exact matching through when a scenario asks for it", () => {
    expect(resolve({ role: "button", name: "Decline", exact: true })).toEqual([
      "role",
      "button",
      { name: "Decline", exact: true },
    ]);
    expect(resolve({ label: "Duplicated face", exact: true })).toEqual([
      "label",
      "Duplicated face",
      { exact: true },
    ]);
    expect(resolve({ text: "In review", exact: true })).toEqual([
      "text",
      "In review",
      { exact: true },
    ]);
  });

  it("matches labels and text loosely by default", () => {
    expect(resolve({ label: "Work email" })).toEqual(["label", "Work email", { exact: false }]);
    expect(resolve({ text: "91% match" })).toEqual(["text", "91% match", { exact: false }]);
  });

  it("finds test id and placeholder targets", () => {
    expect(resolve({ testId: "publish-trust-branding" })).toEqual([
      "testId",
      "publish-trust-branding",
    ]);
    expect(resolve({ placeholder: "you@company.com" })).toEqual(["placeholder", "you@company.com"]);
  });

  it("has no way to express a raw CSS selector", () => {
    expect(TargetSchema.safeParse({ css: ".btn-primary" }).success).toBe(false);
    expect(TargetSchema.safeParse({ selector: "#publish" }).success).toBe(false);
  });

  it("covers every kind of target the domain defines", () => {
    const targets: Target[] = [
      { role: "link", name: "Sessions", exact: false },
      { label: "Password", exact: false },
      { testId: "x" },
      { text: "y", exact: false },
      { placeholder: "z" },
    ];
    expect(targets.map((target) => resolveTarget(new FakeLocator(), target)[0])).toEqual([
      "role",
      "label",
      "testId",
      "text",
      "placeholder",
    ]);
  });

  it("searches inside a named region when the scenario scopes the target", () => {
    expect(
      resolve({
        role: "button",
        name: "Approve",
        exact: true,
        within: { role: "dialog", name: "Approve this verification?" },
      }),
    ).toEqual([
      "role",
      "dialog",
      { name: "Approve this verification?", exact: false },
      "role",
      "button",
      { name: "Approve", exact: true },
    ]);
  });

  it("picks one match by position only when asked", () => {
    expect(resolve({ text: "Standard KYC onboarding", exact: true, nth: 0 })).toEqual([
      "text",
      "Standard KYC onboarding",
      { exact: true },
      "nth",
      0,
    ]);
    expect(resolve({ text: "Standard KYC onboarding", exact: true })).not.toContain("nth");
  });
});
