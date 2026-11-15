import { describe, expect, it } from "vitest";
import { MOTION_GRAPHIC_KINDS } from "../../../src/domain/storyboard";
import * as library from "../../../src/remotion/library";

const BRIEF = {
  Identity: [
    "IdentityCard",
    "IdentityVerificationFlow",
    "DocumentCapture",
    "FaceMatchVisualisation",
    "FaceDeduplicationNetwork",
    "BiometricIdentityGraph",
    "DuplicateAccountDetection",
  ],
  "Fraud and risk": [
    "FraudSignalNetwork",
    "RiskScoreVisualisation",
    "RiskDecisionGraph",
    "SuspiciousActivityTimeline",
    "DeviceRelationshipGraph",
    "FraudPatternDetection",
    "RiskSignalAggregation",
  ],
  Compliance: [
    "KYCPipeline",
    "KYBVerificationFlow",
    "SanctionsScreeningFlow",
    "WalletScreeningNetwork",
    "TransactionMonitoringFlow",
    "ComplianceDecisionEngine",
  ],
  Product: [
    "CinematicProductFrame",
    "SmartScreenRecording",
    "ProductSpotlight",
    "UIElementFocus",
    "ScreenRecordingTransition",
    "InteractiveWorkflowDiagram",
    "ProductFeatureReveal",
  ],
  Storytelling: [
    "ProblemReveal",
    "TransformationSequence",
    "BeforeAfterComparison",
    "CauseEffectAnimation",
    "DataFlowSequence",
    "ProgressiveDisclosure",
    "OutcomeReveal",
  ],
} as const;

describe("the named component library", () => {
  const exported = library as unknown as Record<string, unknown>;
  const names = Object.values(BRIEF).flat();

  it("exports every named component as a component", () => {
    for (const name of names) expect(typeof exported[name], name).toBe("function");
  });

  it("records each one's group and what it really is", () => {
    expect(Object.keys(library.LIBRARY).sort()).toEqual([...names].sort());
    for (const [group, members] of Object.entries(BRIEF)) {
      for (const name of members) {
        expect(library.LIBRARY[name].group).toBe(group);
      }
    }
  });

  it("only names presets of components that exist, and kinds a storyboard can use", () => {
    const kinds = new Set<string>([...MOTION_GRAPHIC_KINDS, "product"]);
    for (const [name, entry] of Object.entries(library.LIBRARY)) {
      expect(kinds.has(entry.kind), name).toBe(true);
      if (entry.implementation !== "full") {
        expect(typeof exported[entry.implementation.presetOf], name).toBe("function");
      }
    }
  });
});
