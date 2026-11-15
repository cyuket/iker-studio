import { describe, expect, it } from "vitest";
import {
  contextProblem,
  parseWorkspaceContext,
} from "../../../src/infrastructure/recording/workspace-context";

const label = (workspace: string, environment: string) =>
  `Workspace and environment. Workspace: ${workspace}. Environment: ${environment}. Activate to change.`;
const SANDBOX_ACME = { environment: "sandbox", workspace: "Acme Corp" } as const;

describe("parseWorkspaceContext", () => {
  it("reads the workspace and environment from the switcher's accessible name", () => {
    expect(parseWorkspaceContext(label("Acme Corp", "Sandbox"))).toEqual({
      workspace: "Acme Corp",
      environment: "Sandbox",
    });
  });

  it("keeps a workspace name that itself contains a full stop", () => {
    expect(parseWorkspaceContext(label("Acme Inc. West", "Production"))?.workspace).toBe(
      "Acme Inc. West",
    );
  });

  it("returns null for anything else, so an unknown layout is never treated as safe", () => {
    expect(parseWorkspaceContext("Open menu")).toBeNull();
    expect(parseWorkspaceContext("")).toBeNull();
  });
});

describe("contextProblem", () => {
  it("accepts Sandbox in the expected workspace", () => {
    expect(
      contextProblem({ workspace: "Acme Corp", environment: "Sandbox" }, SANDBOX_ACME),
    ).toBeNull();
  });

  it("refuses Production, whatever the workspace", () => {
    expect(
      contextProblem({ workspace: "Acme Corp", environment: "Production" }, SANDBOX_ACME),
    ).toContain("Sandbox only");
    expect(
      contextProblem(
        { workspace: "Acme Corp", environment: "Production" },
        { environment: "sandbox", workspace: null },
      ),
    ).toContain("Sandbox only");
  });

  it("refuses any environment name it does not recognise", () => {
    expect(
      contextProblem({ workspace: "Acme Corp", environment: "Live" }, SANDBOX_ACME),
    ).not.toBeNull();
  });

  it("refuses a different workspace, matching the name exactly", () => {
    expect(
      contextProblem({ workspace: "Real Customer Ltd", environment: "Sandbox" }, SANDBOX_ACME),
    ).toContain('not "Acme Corp"');
    expect(
      contextProblem({ workspace: "acme corp", environment: "Sandbox" }, SANDBOX_ACME),
    ).not.toBeNull();
  });

  it("accepts any workspace when none is required", () => {
    expect(
      contextProblem(
        { workspace: "Anything", environment: "Sandbox" },
        { environment: "sandbox", workspace: null },
      ),
    ).toBeNull();
  });
});
