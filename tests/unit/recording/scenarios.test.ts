import { describe, expect, it } from "vitest";
import {
  describeTarget,
  ScenarioSchema,
  type Scenario,
  type Step,
} from "../../../src/domain/recording";
import { findPersonalData, findSecretPatterns } from "../../../src/domain/redaction";
import { findScenario, SCENARIOS } from "../../../src/scenarios";

const REQUIRED_FEATURES = [
  "Dashboard overview",
  "Bookings",
  "Booking detail",
  "Calendar",
  "Availability",
  "Payments",
  "Sales & discounts",
  "Rate card",
  "Packages",
  "Business report",
  "Income and expenses",
  "Statements and reports",
  "Customers",
  "Promotional campaigns",
  "Public booking page",
  "Business settings",
  "Policies",
  "Staff",
  "Billing",
];

const describeStep = (step: Step): string => ("target" in step ? describeTarget(step.target) : "");
const each = SCENARIOS.map((scenario): [string, Scenario] => [scenario.id, scenario]);

describe("scenario registry", () => {
  it("has unique ids", () => {
    const ids = SCENARIOS.map((scenario) => scenario.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("finds a scenario by id and returns undefined for an unknown one", () => {
    expect(findScenario("synthetic-smoke")?.target).toBe("synthetic");
    expect(findScenario("no-such-scenario")).toBeUndefined();
  });

  it("includes the three synthetic scenarios", () => {
    for (const id of ["synthetic-smoke", "synthetic-new-booking", "synthetic-record-payment"]) {
      expect(findScenario(id)?.target).toBe("synthetic");
    }
  });

  it("has a synthetic scenario for bookings and for payments", () => {
    expect(findScenario("synthetic-new-booking")?.feature).toBe("Bookings");
    expect(findScenario("synthetic-record-payment")?.feature).toBe("Payments");
  });

  it("has a real-product scenario for every feature", () => {
    const features = SCENARIOS.filter((scenario) => scenario.target === "iker").map(
      (s) => s.feature,
    );
    expect(features).toEqual(expect.arrayContaining(REQUIRED_FEATURES));
  });
});

describe.each(each)("scenario %s", (_id, scenario) => {
  it("is valid and already normalised by the schema", () => {
    expect(ScenarioSchema.parse(scenario)).toEqual(scenario);
  });

  it("uses the target its id announces", () => {
    const prefix = scenario.id.split("-")[0];
    expect(prefix).toBe(scenario.target);
  });

  it("claims to be verified on the real product only with the date of a green take", () => {
    if (scenario.target === "iker" && scenario.status === "verified") {
      expect(scenario.evidence).toMatch(/ran green on \d{4}-\d{2}-\d{2}/);
    }
  });

  it("uses site-relative paths only", () => {
    const paths = [
      ...scenario.preflight.map((check) => check.path),
      ...scenario.steps.flatMap((step) => (step.action === "navigate" ? [step.path] : [])),
    ];
    for (const path of paths) expect(path).toMatch(/^\/(?!\/)/);
  });

  it("gives each screenshot its own name", () => {
    const names = scenario.steps.flatMap((step) =>
      step.action === "screenshot" ? [step.name] : [],
    );
    expect(new Set(names).size).toBe(names.length);
  });

  it("contains nothing that looks like a credential", () => {
    const text = JSON.stringify(scenario);
    expect(findSecretPatterns(text)).toEqual([]);
    // Any email address in a scenario must be on a reserved example domain.
    expect(findPersonalData(text).filter((finding) => finding.name === "email")).toEqual([]);
    expect(text).not.toMatch(/passw(or)?d\s*[:=]/i);
  });

  it("never types into a sign-in field: sign-in belongs to the authenticate step", () => {
    const typed = scenario.steps.filter((step) => step.action === "type").map(describeStep);
    for (const description of typed)
      expect(description).not.toMatch(/password|work email|passcode|secret/i);
  });
});

describe.each(each.filter(([, scenario]) => scenario.target === "iker"))(
  "real-product scenario %s",
  (_id, scenario) => {
    it("signs in before anything else and checks its pages first", () => {
      expect(scenario.steps[0]?.action).toBe("authenticate");
      expect(scenario.preflight.length).toBeGreaterThan(0);
    });

    it("says where its selectors came from, and states its limits", () => {
      // Either the dashboard's source files, or the live page read with demo-snapshot.
      expect(scenario.evidence).toMatch(/\.tsx?\b|demo-snapshot/);
      expect(scenario.prerequisites.length).toBeGreaterThan(0);
    });

    it("is unverified until a take has run green against a demo environment", () => {
      expect(scenario.status).toBe("unverified");
    });

    it("never presses a button that saves, sends or pays", () => {
      const pressed = scenario.steps
        .filter((step) => step.action === "click")
        .map(describeStep)
        .join("\n");
      expect(pressed).not.toMatch(
        /"(Save[^"]*|Send now|Schedule|Log in|Confirm booking|Reject payment)"/,
      );
    });

    it("takes at least one screenshot", () => {
      expect(scenario.steps.some((step) => step.action === "screenshot")).toBe(true);
    });
  },
);

describe("pointer and keyboard steps", () => {
  const base = {
    id: "drag-check",
    title: "Drag check",
    feature: "Bookings",
    target: "synthetic" as const,
    status: "unverified" as const,
    evidence: "test",
    viewport: { width: 1440, height: 900 },
  };

  it("accepts a drag between two targets with optional points inside each", () => {
    const parsed = ScenarioSchema.parse({
      ...base,
      steps: [
        {
          action: "drag",
          from: { role: "group", name: "Key person flagged?" },
          to: { text: "Ownership unresolved?" },
          fromPoint: { x: 1, y: 0.75 },
        },
        { action: "press", key: "Delete" },
      ],
    });
    expect(parsed.steps.map((step) => step.action)).toEqual(["drag", "press"]);
  });

  it("refuses a point outside the element and a key it does not know", () => {
    expect(() =>
      ScenarioSchema.parse({
        ...base,
        steps: [
          { action: "drag", from: { text: "a" }, to: { text: "b" }, toPoint: { x: 2, y: 0 } },
        ],
      }),
    ).toThrow();
    expect(() =>
      ScenarioSchema.parse({ ...base, steps: [{ action: "press", key: "Meta+Q" }] }),
    ).toThrow();
  });
});
