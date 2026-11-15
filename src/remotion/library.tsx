import type { ReactNode } from "react";
import type { ResolvedRecording } from "../domain/render-props";
import type {
  DecisionVisualData,
  IdentityStoryVisualData,
  NetworkVisualData,
  PipelineVisualData,
  Region,
  StoryVisualData,
  TransformationVisualData,
} from "../domain/storyboard";
import { CharacterScene } from "./graphics/CharacterScene";
import { Decision } from "./graphics/Decision";
import { IdentityStory } from "./graphics/IdentityStory";
import { Network } from "./graphics/Network";
import { Pipeline } from "./graphics/Pipeline";
import { Story } from "./graphics/Story";
import { Timeline } from "./graphics/Timeline";
import { Transformation } from "./graphics/Transformation";
import { ProductLayout } from "./scenes/ProductLayout";

/**
 * The motion-graphics library by name. Eight data-driven graphics and four product
 * components do the work; every other name here is one of them with the vocabulary and
 * defaults of a particular domain. `LIBRARY` records which is which, and the documentation
 * and a unit test are both generated from it, so the claim cannot drift from the code.
 *
 * Storyboards do not use these names: a scene names a visual `kind` and the renderer picks
 * the graphic. The named components are for composing scenes in code. All of them must be
 * rendered inside a `SceneEnvironmentProvider`.
 */

export { IdentityCard } from "./primitives/IdentityCard";
export { CinematicProductFrame } from "./product/CinematicProductFrame";
export { ScreenRecordingTransition } from "./product/ScreenRecordingTransition";
export { SmartScreenRecording } from "./product/SmartScreenRecording";
export { ProductSpotlight, UIElementFocus } from "./product/UIElementFocus";

type Data<T> = Omit<T, "kind">;
type Stage = PipelineVisualData["stages"][number];
type NetworkNode = NetworkVisualData["nodes"][number];

const stage = (label: string, detail: string, status: Stage["status"] = "verified"): Stage => ({
  label,
  detail,
  status,
});

/** Props of a pipeline preset: everything optional, the domain supplies what is left out. */
export type PipelinePresetProps = Partial<Data<PipelineVisualData>>;

function pipelinePreset(defaults: Data<PipelineVisualData>) {
  return function PipelinePreset(props: PipelinePresetProps): ReactNode {
    return <Pipeline visual={{ kind: "pipeline", ...defaults, ...props }} />;
  };
}

// ----- Identity -----------------------------------------------------------------------

/** Preset of `Pipeline`: a person going through document, selfie and checks to a result. */
export const IdentityVerificationFlow = pipelinePreset({
  object: { type: "person", label: "Applicant" },
  stages: [
    stage("Document", "Genuine and readable"),
    stage("Selfie", "A real person is present"),
    stage("Checks", "Details agree"),
  ],
  result: { label: "Verified", status: "verified" },
  settled: [],
});

/** Preset of `Pipeline`: a document being captured, read and checked. */
export const DocumentCapture = pipelinePreset({
  object: { type: "document", label: "Identity document" },
  stages: [
    stage("Capture", "Photographed by the applicant"),
    stage("Read", "Details taken from the document"),
    stage("Check", "Signs of tampering"),
  ],
  result: { label: "Accepted", status: "verified" },
  settled: [],
});

export interface FaceMatchVisualisationProps {
  /** The two faces being compared. Equal seeds are the same face. */
  left: { name: string; face: string };
  right: { name: string; face: string };
  /** Words on the link between them. */
  label?: string;
  /** Cue on which the two are joined. */
  cue?: string;
  settled?: string[];
}

/** Preset of `IdentityStory`: two bare cards whose faces are joined when they match. */
export function FaceMatchVisualisation(props: FaceMatchVisualisationProps): ReactNode {
  const account = (id: string, person: { name: string; face: string }) => ({
    id,
    name: person.name,
    nameDiffers: false,
    face: person.face,
    fields: [],
    steps: [],
  });
  return (
    <IdentityStory
      visual={{
        kind: "identity-story",
        accounts: [account("left", props.left), account("right", props.right)],
        gaps: [],
        match: {
          cue: props.cue,
          label: props.label ?? "Same face",
          accounts: ["left", "right"],
          isolate: false,
          tone: "primary",
        },
        settled: props.settled ?? [],
      }}
    />
  );
}

/** Preset of `IdentityStory` with matching on: accounts that turn out to share a face. */
export function DuplicateAccountDetection(props: Data<IdentityStoryVisualData>): ReactNode {
  return (
    <IdentityStory
      visual={{
        kind: "identity-story",
        ...props,
        match: props.match ?? { label: "Same face", isolate: true, tone: "primary" },
      }}
    />
  );
}

function networkPreset(layout: NetworkVisualData["layout"], fallbackType: NetworkNode["type"]) {
  return function NetworkPreset(
    props: Omit<Data<NetworkVisualData>, "layout" | "nodes"> & {
      layout?: NetworkVisualData["layout"];
      /** Nodes may leave out their type; the preset's own is used. */
      nodes: (Omit<NetworkNode, "type"> & { type?: NetworkNode["type"] })[];
    },
  ): ReactNode {
    return (
      <Network
        visual={{
          kind: "network",
          ...props,
          layout: props.layout ?? layout,
          nodes: props.nodes.map((node) => ({ ...node, type: node.type ?? fallbackType })),
        }}
      />
    );
  };
}

/** Preset of `Network`: a new face at the hub, compared with the accounts around it. */
export const FaceDeduplicationNetwork = networkPreset("radial", "account");
/** Preset of `Network`: faces and the identities attached to them, in groups. */
export const BiometricIdentityGraph = networkPreset("groups", "face");

// ----- Fraud and risk -----------------------------------------------------------------

/** Preset of `Network`: signals around the account they were raised on. */
export const FraudSignalNetwork = networkPreset("radial", "signal");
/** Preset of `Network`: devices and the accounts that share them, in groups. */
export const DeviceRelationshipGraph = networkPreset("groups", "device");
/** Preset of `Network`: accounts whose shared attributes form a cluster. */
export const FraudPatternDetection = networkPreset("groups", "account");

/** The full decision graph: signals, a rule, outcomes, and the routes between them. */
export function RiskDecisionGraph(props: Data<DecisionVisualData>): ReactNode {
  return <Decision visual={{ kind: "decision", ...props }} />;
}

export interface RiskScoreVisualisationProps {
  /** What the level describes, as a sentence: "Match strength". Never a number. */
  label: string;
  /** 0-1 share of the bar that fills. */
  level: number;
  threshold?: number;
  /** What feeds the score. */
  signals: DecisionVisualData["signals"];
  outcomes: DecisionVisualData["outcomes"];
  routes?: DecisionVisualData["routes"];
  ruleLabel?: string;
  settled?: string[];
}

/** Preset of `Decision` with its score bar: a level against a threshold, with no figures. */
export function RiskScoreVisualisation(props: RiskScoreVisualisationProps): ReactNode {
  return (
    <Decision
      visual={{
        kind: "decision",
        signals: props.signals,
        rule: { label: props.ruleLabel ?? "Risk level" },
        outcomes: props.outcomes,
        routes: props.routes ?? [],
        score: { label: props.label, level: props.level, threshold: props.threshold },
        settled: props.settled ?? [],
      }}
    />
  );
}

/** Preset of `Decision`: several signals feeding one rule. The same graph, named for its use. */
export function RiskSignalAggregation(props: Data<DecisionVisualData>): ReactNode {
  return <Decision visual={{ kind: "decision", ...props }} />;
}

/** The full timeline: events in order, with the flagged ones picked out. */
export { Timeline as SuspiciousActivityTimeline };

// ----- Compliance ---------------------------------------------------------------------

/** Preset of `Pipeline` with the stages of a customer verification. */
export const KYCPipeline = pipelinePreset({
  object: { type: "person", label: "Customer" },
  stages: [
    stage("Document", "Genuine and readable"),
    stage("Selfie", "A real person is present"),
    stage("Checks", "Details agree"),
  ],
  result: { label: "Decision", status: "verified" },
  settled: [],
});

/** Preset of `Pipeline`: a business going through registration, ownership and screening. */
export const KYBVerificationFlow = pipelinePreset({
  object: { type: "business", label: "Business" },
  stages: [
    stage("Registration", "The company exists"),
    stage("Ownership", "Who controls it"),
    stage("Screening", "Owners and directors"),
  ],
  result: { label: "Decision", status: "verified" },
  settled: [],
});

/** Preset of `Pipeline`: a name being screened against lists and reviewed on a hit. */
export const SanctionsScreeningFlow = pipelinePreset({
  object: { type: "person", label: "Name" },
  stages: [
    stage("Normalise", "Spelling and order"),
    stage("Screen", "Against the lists"),
    stage("Review", "Possible matches", "flagged"),
  ],
  result: { label: "Cleared or escalated", status: "pending" },
  settled: [],
});

/** Preset of `Pipeline`: a transaction passing rules and reaching a queue when flagged. */
export const TransactionMonitoringFlow = pipelinePreset({
  object: { type: "transaction", label: "Transaction" },
  stages: [
    stage("Rules", "Limits and patterns"),
    stage("Context", "The customer's history"),
    stage("Alert", "Raised when it stands out", "flagged"),
  ],
  result: { label: "Review queue", status: "flagged" },
  settled: [],
});

/** Preset of `Network`: a wallet at the hub and the addresses it has dealt with. */
export const WalletScreeningNetwork = networkPreset("radial", "wallet");

/** Preset of `Decision`: checks feeding a policy that routes to an outcome. */
export function ComplianceDecisionEngine(props: Data<DecisionVisualData>): ReactNode {
  return <Decision visual={{ kind: "decision", ...props }} />;
}

// ----- Product ------------------------------------------------------------------------

export interface InteractiveWorkflowDiagramProps extends PipelinePresetProps {
  /** The step the product footage is about to show; it is picked out once the object has passed. */
  focusStage: number;
  focusCue?: string;
}

/**
 * Preset of `Pipeline` with one stage picked out: the steps of a workflow, drawn as an
 * illustration, ending on the step the real product footage then shows. Meant as a
 * product scene's prelude, with that stage as the handoff anchor.
 */
export function InteractiveWorkflowDiagram({
  focusStage,
  focusCue,
  ...props
}: InteractiveWorkflowDiagramProps): ReactNode {
  return (
    <Pipeline
      visual={{
        kind: "pipeline",
        object: { type: "person", label: "Client" },
        stages: [
          stage("Service", "What they are booking"),
          stage("Date and time", "An open slot"),
          stage("Payment", "Deposit and proof"),
        ],
        settled: [],
        ...props,
        focus: { stage: focusStage, cue: focusCue },
      }}
    />
  );
}

export interface ProductFeatureRevealProps {
  /** Recording scenario whose capture shows the feature. */
  scenarioId: string;
  recording: ResolvedRecording | null;
  /** The feature's name, as the product spells it. */
  heading: string;
  /** Where the feature is in the recording. */
  region: Region;
  /** Cue on which the camera arrives at the feature. */
  cue?: string;
  /** Used when there is no cue. */
  atSeconds?: number;
  mode?: "video" | "screenshot";
  screenshot?: string;
  maxZoom?: number;
}

/**
 * Preset of the product scene: the real screen, then one camera move to the feature with
 * everything else dimmed. It is `SmartScreenRecording` under a manual camera with a single
 * stop and isolation on.
 */
export function ProductFeatureReveal(props: ProductFeatureRevealProps): ReactNode {
  return (
    <ProductLayout
      recording={props.recording}
      visual={{
        kind: "product",
        scenarioId: props.scenarioId,
        mode: props.mode ?? "video",
        screenshot: props.screenshot,
        heading: props.heading,
        annotations: [],
        zoom: false,
        showCursor: false,
        camera: {
          mode: "manual",
          maxZoom: props.maxZoom ?? 2,
          isolate: true,
          keyframes: [
            {
              cue: props.cue,
              atSeconds: props.cue === undefined ? (props.atSeconds ?? 1.5) : undefined,
              region: props.region,
            },
          ],
        },
      }}
    />
  );
}

// ----- Storytelling -------------------------------------------------------------------

type StoryPresetProps = Omit<Data<StoryVisualData>, "mode" | "recede"> & { recede?: boolean };

/** Preset of `Story`, problem mode: lines that set up a key line which reframes them. */
export function ProblemReveal(props: StoryPresetProps): ReactNode {
  return <Story visual={{ kind: "story", recede: true, ...props, mode: "problem" }} />;
}

/** Preset of `Story`, disclosure mode: one line at a time, earlier lines stepping back. */
export function ProgressiveDisclosure(props: StoryPresetProps): ReactNode {
  return <Story visual={{ kind: "story", recede: true, ...props, mode: "disclosure" }} />;
}

/** Preset of `Story`, outcome mode: each supporting line stamped with its status. */
export function OutcomeReveal(props: StoryPresetProps): ReactNode {
  return <Story visual={{ kind: "story", recede: false, ...props, mode: "outcome" }} />;
}

type TransformationPresetProps = Omit<Data<TransformationVisualData>, "mode">;

/** Preset of `Transformation`, in place: each item becomes its new state where it stands. */
export function TransformationSequence(props: TransformationPresetProps): ReactNode {
  return <Transformation visual={{ kind: "transformation", ...props, mode: "in-place" }} />;
}

/** Preset of `Transformation`, side by side: before on the left, after on the right. */
export function BeforeAfterComparison(props: TransformationPresetProps): ReactNode {
  return <Transformation visual={{ kind: "transformation", ...props, mode: "side-by-side" }} />;
}

export interface CauseEffectAnimationProps {
  cause: { label: string; detail?: string; cue?: string };
  /** What turns the cause into the effect. */
  through: { label: string; detail?: string; cue?: string };
  effect: {
    label: string;
    detail?: string;
    status: DecisionVisualData["outcomes"][number]["status"];
  };
  /** Cue on which the path from cause to effect lights up. */
  cue?: string;
  heading?: string;
  settled?: string[];
}

/** Preset of `Decision` with one signal, one route and two outcomes reduced to the one taken. */
export function CauseEffectAnimation(props: CauseEffectAnimationProps): ReactNode {
  return (
    <Decision
      visual={{
        kind: "decision",
        heading: props.heading,
        signals: [{ id: "cause", tone: "neutral", ...props.cause }],
        rule: props.through,
        outcomes: [
          { id: "effect", ...props.effect },
          { id: "otherwise", label: "Otherwise, nothing changes", status: "pending" },
        ],
        routes: [{ from: "cause", to: "effect", cue: props.cue }],
        settled: props.settled ?? [],
      }}
    />
  );
}

/** Preset of `Pipeline`: a piece of data moving through the systems that handle it. */
export const DataFlowSequence = pipelinePreset({
  object: { type: "data", label: "Data" },
  stages: [stage("Collected", "From the applicant"), stage("Checked", "Against the rules")],
  result: { label: "Stored", status: "verified" },
  settled: [],
});

// ----- The record of what is what -----------------------------------------------------

export type LibraryGroup =
  "Identity" | "Fraud and risk" | "Compliance" | "Product" | "Storytelling";

export interface LibraryEntry {
  group: LibraryGroup;
  /** `full` components do their own work; a preset names the component it configures. */
  implementation: "full" | { presetOf: string };
  /** The storyboard visual kind that draws the same thing; null when there is none. */
  kind: string | null;
}

/** Every named component, what it really is, and how a storyboard asks for it. */
export const LIBRARY = {
  IdentityCard: { group: "Identity", implementation: "full", kind: "identity-story" },
  IdentityVerificationFlow: {
    group: "Identity",
    implementation: { presetOf: "Pipeline" },
    kind: "pipeline",
  },
  DocumentCapture: {
    group: "Identity",
    implementation: { presetOf: "Pipeline" },
    kind: "pipeline",
  },
  FaceMatchVisualisation: {
    group: "Identity",
    implementation: { presetOf: "IdentityStory" },
    kind: "identity-story",
  },
  FaceDeduplicationNetwork: {
    group: "Identity",
    implementation: { presetOf: "Network" },
    kind: "network",
  },
  BiometricIdentityGraph: {
    group: "Identity",
    implementation: { presetOf: "Network" },
    kind: "network",
  },
  DuplicateAccountDetection: {
    group: "Identity",
    implementation: { presetOf: "IdentityStory" },
    kind: "identity-story",
  },
  FraudSignalNetwork: {
    group: "Fraud and risk",
    implementation: { presetOf: "Network" },
    kind: "network",
  },
  RiskScoreVisualisation: {
    group: "Fraud and risk",
    implementation: { presetOf: "Decision" },
    kind: "decision",
  },
  RiskDecisionGraph: { group: "Fraud and risk", implementation: "full", kind: "decision" },
  SuspiciousActivityTimeline: { group: "Fraud and risk", implementation: "full", kind: "timeline" },
  DeviceRelationshipGraph: {
    group: "Fraud and risk",
    implementation: { presetOf: "Network" },
    kind: "network",
  },
  FraudPatternDetection: {
    group: "Fraud and risk",
    implementation: { presetOf: "Network" },
    kind: "network",
  },
  RiskSignalAggregation: {
    group: "Fraud and risk",
    implementation: { presetOf: "Decision" },
    kind: "decision",
  },
  KYCPipeline: { group: "Compliance", implementation: { presetOf: "Pipeline" }, kind: "pipeline" },
  KYBVerificationFlow: {
    group: "Compliance",
    implementation: { presetOf: "Pipeline" },
    kind: "pipeline",
  },
  SanctionsScreeningFlow: {
    group: "Compliance",
    implementation: { presetOf: "Pipeline" },
    kind: "pipeline",
  },
  WalletScreeningNetwork: {
    group: "Compliance",
    implementation: { presetOf: "Network" },
    kind: "network",
  },
  TransactionMonitoringFlow: {
    group: "Compliance",
    implementation: { presetOf: "Pipeline" },
    kind: "pipeline",
  },
  ComplianceDecisionEngine: {
    group: "Compliance",
    implementation: { presetOf: "Decision" },
    kind: "decision",
  },
  CinematicProductFrame: { group: "Product", implementation: "full", kind: "product" },
  SmartScreenRecording: { group: "Product", implementation: "full", kind: "product" },
  ProductSpotlight: {
    group: "Product",
    implementation: { presetOf: "UIElementFocus" },
    kind: "product",
  },
  UIElementFocus: { group: "Product", implementation: "full", kind: "product" },
  ScreenRecordingTransition: { group: "Product", implementation: "full", kind: "product" },
  InteractiveWorkflowDiagram: {
    group: "Product",
    implementation: { presetOf: "Pipeline" },
    kind: "pipeline",
  },
  ProductFeatureReveal: {
    group: "Product",
    implementation: { presetOf: "SmartScreenRecording" },
    kind: "product",
  },
  ProblemReveal: { group: "Storytelling", implementation: { presetOf: "Story" }, kind: "story" },
  TransformationSequence: {
    group: "Storytelling",
    implementation: { presetOf: "Transformation" },
    kind: "transformation",
  },
  BeforeAfterComparison: {
    group: "Storytelling",
    implementation: { presetOf: "Transformation" },
    kind: "transformation",
  },
  CauseEffectAnimation: {
    group: "Storytelling",
    implementation: { presetOf: "Decision" },
    kind: "decision",
  },
  DataFlowSequence: {
    group: "Storytelling",
    implementation: { presetOf: "Pipeline" },
    kind: "pipeline",
  },
  ProgressiveDisclosure: {
    group: "Storytelling",
    implementation: { presetOf: "Story" },
    kind: "story",
  },
  OutcomeReveal: { group: "Storytelling", implementation: { presetOf: "Story" }, kind: "story" },
} as const satisfies Record<string, LibraryEntry>;

/** The graphics the presets configure, exported under their own names too. */
export {
  CharacterScene,
  Decision,
  IdentityStory,
  Network,
  Pipeline,
  Story,
  Timeline,
  Transformation,
};
export { Character } from "./primitives/Character";
