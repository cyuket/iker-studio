import brandFile from "../../brand/brand.json";
import { buildCues, estimateWordTimings } from "../domain/captions";
import { FORMATS, type FormatId } from "../domain/formats";
import type {
  CutRenderProps,
  ResolvedBrand,
  ResolvedRecording,
  SceneRenderProps,
  ThumbnailRenderProps,
} from "../domain/render-props";
import type { SceneType } from "../domain/scene-types";
import type { Scene, SceneVisual, SceneVisualKind } from "../domain/storyboard";

/**
 * Self-contained props for Remotion Studio and for visual checks. Nothing here needs a
 * network or a media file: logos fall back to text and the one "capture" is an inline SVG
 * that is plainly a placeholder, so a fresh clone can open the studio straight away.
 */

export const SAMPLE_BRAND: ResolvedBrand = {
  ...brandFile,
  schemaVersion: 1,
  logoSrc: { mark: null, wordmark: null },
};

export const SAMPLE_DISCLOSURE = "Synthetic demo · Not the live product";

const svg = (markup: string): string => `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`;

/** A neutral block layout that announces itself as a placeholder; it depicts no real screen. */
const PLACEHOLDER_CAPTURE =
  svg(`<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900">
<rect width="1440" height="900" fill="#0d1018"/>
<rect x="0" y="0" width="260" height="900" fill="#12151f"/>
<rect x="32" y="40" width="150" height="22" rx="6" fill="#2a3044"/>
<g fill="#1c2132"><rect x="32" y="120" width="196" height="36" rx="8"/><rect x="32" y="172" width="196" height="36" rx="8"/><rect x="32" y="224" width="196" height="36" rx="8"/><rect x="32" y="276" width="196" height="36" rx="8"/></g>
<rect x="308" y="56" width="420" height="34" rx="8" fill="#2a3044"/>
<rect x="308" y="108" width="620" height="18" rx="6" fill="#1c2132"/>
<g fill="#141826" stroke="#252b3d" stroke-width="2"><rect x="308" y="180" width="520" height="300" rx="16"/><rect x="860" y="180" width="520" height="300" rx="16"/><rect x="308" y="520" width="1072" height="300" rx="16"/></g>
<g fill="#2a3044"><rect x="340" y="216" width="220" height="20" rx="6"/><rect x="340" y="262" width="340" height="56" rx="10"/><rect x="340" y="350" width="400" height="16" rx="6"/><rect x="340" y="384" width="300" height="16" rx="6"/>
<rect x="892" y="216" width="220" height="20" rx="6"/><rect x="892" y="262" width="260" height="56" rx="10"/><rect x="892" y="350" width="420" height="16" rx="6"/><rect x="892" y="384" width="330" height="16" rx="6"/>
<rect x="340" y="556" width="260" height="20" rx="6"/><rect x="340" y="612" width="1008" height="14" rx="6"/><rect x="340" y="652" width="1008" height="14" rx="6"/><rect x="340" y="692" width="1008" height="14" rx="6"/><rect x="340" y="732" width="700" height="14" rx="6"/></g>
<rect x="1180" y="48" width="200" height="52" rx="12" fill="#e05a38"/>
<text x="844" y="866" text-anchor="middle" font-family="monospace" font-size="22" fill="#858b9f">SAMPLE PLACEHOLDER CAPTURE - NOT PRODUCT UI</text>
</svg>`);

export const SAMPLE_RECORDING: ResolvedRecording = {
  videoSrc: null,
  screenshotSrc: PLACEHOLDER_CAPTURE,
  durationSeconds: 6,
  displayUrl: "demo-console.example/bookings",
  timeline: {
    schemaVersion: 1,
    scenarioId: "sample-flow",
    target: "synthetic",
    viewport: { width: 1440, height: 900 },
    durationSeconds: 6,
    events: [
      { index: 0, action: "navigate", startSeconds: 0, endSeconds: 0.4, region: null, label: null },
      {
        index: 1,
        action: "highlight",
        startSeconds: 1,
        endSeconds: 2,
        region: { x: 0.214, y: 0.2, width: 0.361, height: 0.333 },
        label: "First panel",
      },
      {
        index: 2,
        action: "click",
        startSeconds: 3,
        endSeconds: 3.3,
        region: { x: 0.819, y: 0.053, width: 0.139, height: 0.058 },
        label: "Primary action",
      },
      {
        index: 3,
        action: "highlight",
        startSeconds: 4.4,
        endSeconds: 5.6,
        region: { x: 0.597, y: 0.2, width: 0.361, height: 0.333 },
        label: "Second panel",
      },
    ],
  },
};

const SAMPLE_VISUALS: Record<SceneVisualKind, SceneVisual> = {
  title: {
    kind: "title",
    headline: "Know who has paid",
    subhead: "How Iker keeps every deposit on its booking.",
  },
  chapter: { kind: "chapter", title: "Where deposits get lost" },
  statement: {
    kind: "statement",
    headline: "A chat is not a payment record",
    body: "Deposits arrive by bank transfer and the proof ends up somewhere in a long chat.",
    points: [
      {
        title: "Screenshots get buried",
        detail: "Proof sits between voice notes and price lists.",
      },
      {
        title: "Balances from memory",
        detail: "Nobody is sure what each client still owes.",
      },
      { title: "No monthly picture", detail: "Income is pieced together at the end of the month." },
    ],
    tone: "warning",
  },
  steps: {
    kind: "steps",
    heading: "From booking to paid",
    steps: [
      { title: "Book", detail: "The client picks a time from your link." },
      { title: "Transfer", detail: "The deposit goes straight to your account." },
      { title: "Confirm", detail: "You check the proof and confirm." },
      { title: "Settle", detail: "Record the balance when it is paid." },
    ],
  },
  product: {
    kind: "product",
    scenarioId: "sample-flow",
    mode: "screenshot",
    heading: "Every payment on the booking",
    annotations: [
      {
        text: "Paid so far",
        region: { x: 0.214, y: 0.2, width: 0.361, height: 0.333 },
        fromSeconds: 1,
        toSeconds: 3,
        spotlight: true,
      },
      {
        text: "Record a payment",
        region: { x: 0.819, y: 0.053, width: 0.139, height: 0.058 },
        fromSeconds: 3,
        spotlight: false,
      },
    ],
    focus: { x: 0.56, y: 0.02, width: 0.42, height: 0.24 },
    zoom: false,
    showCursor: true,
  },
  diagram: {
    kind: "diagram",
    heading: "Where Iker sits",
    nodes: [
      {
        id: "client",
        label: "Your client",
        sublabel: "Books from your link",
        tone: "neutral",
        column: 0,
      },
      {
        id: "iker",
        label: "Iker",
        sublabel: "Bookings and books",
        tone: "primary",
        column: 1,
      },
      { id: "calendar", label: "Calendar", tone: "neutral", column: 2 },
      { id: "payments", label: "Payments", tone: "neutral", column: 2 },
      { id: "expenses", label: "Expenses", tone: "neutral", column: 2 },
      {
        id: "report",
        label: "Monthly report",
        sublabel: "Income and profit",
        tone: "positive",
        column: 3,
      },
    ],
    edges: [
      { from: "client", to: "iker", label: "booking", tone: "neutral" },
      { from: "iker", to: "calendar", tone: "neutral" },
      { from: "iker", to: "payments", tone: "neutral" },
      { from: "iker", to: "expenses", tone: "neutral" },
      { from: "calendar", to: "report", tone: "neutral" },
      { from: "payments", to: "report", tone: "positive" },
      { from: "expenses", to: "report", tone: "neutral" },
    ],
  },
  comparison: {
    kind: "comparison",
    heading: "What changes for the business",
    left: {
      title: "Chats and a notebook",
      points: [
        "Slots agreed message by message",
        "Deposits checked by scrolling",
        "Income added up by hand",
      ],
      tone: "danger",
    },
    right: {
      title: "With Iker",
      points: [
        "Clients book open slots from one link",
        "Proof of payment sits on the booking",
        "Reports built from confirmed payments",
      ],
      tone: "positive",
    },
  },
  code: {
    kind: "code",
    heading: "A booking, as an example record",
    language: "typescript",
    code: [
      "const booking = {",
      '  client: "Ada Obi",',
      '  service: "Knotless braids",',
      "  priceNaira: 35_000,",
      "  paidSoFarNaira: 17_500,",
      "};",
      "",
      "// Balance remaining: 17,500 naira",
    ].join("\n"),
    highlightLines: [5],
  },
  data: {
    kind: "data",
    heading: "One month at a glance",
    unit: "naira",
    series: [
      { label: "Income", value: 420000, tone: "positive" },
      { label: "Expenses", value: 135000, tone: "danger" },
      { label: "Profit", value: 285000, tone: "primary" },
    ],
    source: "Example figures for layout only",
    illustrative: true,
  },
  cta: {
    kind: "cta",
    headline: "Get booked. Get paid.",
    action: "Get started",
    url: "useiker.com",
  },
  outro: { kind: "outro", tagline: "Get booked. Get paid." },
  "identity-story": {
    kind: "identity-story",
    accounts: [
      {
        id: "first",
        name: "Ada Obi",
        nameDiffers: false,
        face: "ada",
        fields: [
          { icon: "phone", value: "+234 700 000 0142", differs: false },
          { icon: "date", value: "Booked from the link", differs: false },
        ],
        steps: [
          { label: "Booked" },
          { label: "Deposit confirmed", status: "verified" },
          { label: "Completed", status: "verified" },
        ],
      },
      {
        id: "second",
        name: "Ada O.",
        nameDiffers: true,
        face: "ada",
        fields: [
          { icon: "phone", value: "+234 700 000 0142", differs: false },
          { icon: "date", value: "Added as a walk-in", differs: true },
        ],
        steps: [
          { label: "Walked in" },
          { label: "Paid in full", status: "verified" },
          { label: "Completed", status: "verified" },
        ],
      },
    ],
    gaps: [{ after: "first", label: "Three weeks later" }],
    match: { label: "Same client", isolate: true, tone: "primary" },
    settled: [],
  },
  network: {
    kind: "network",
    layout: "radial",
    hub: "business",
    nodes: [
      {
        id: "business",
        type: "business",
        label: "Your business",
        tone: "primary",
        muted: false,
        outside: false,
      },
      {
        id: "one",
        type: "person",
        face: "bisi",
        tone: "neutral",
        status: "verified",
        muted: false,
        outside: false,
      },
      {
        id: "two",
        type: "person",
        face: "ada",
        label: "Ada Obi",
        tone: "neutral",
        status: "verified",
        muted: false,
        outside: false,
      },
      {
        id: "three",
        type: "person",
        face: "emeka",
        tone: "neutral",
        status: "pending",
        muted: false,
        outside: false,
      },
      {
        id: "list",
        type: "list",
        label: "Customer list",
        tone: "neutral",
        muted: false,
        outside: false,
      },
    ],
    edges: [
      { from: "business", to: "one", tone: "neutral", style: "solid", signal: true },
      {
        from: "business",
        to: "two",
        tone: "neutral",
        style: "solid",
        signal: true,
        mark: { tone: "positive", label: "Regular" },
      },
      { from: "business", to: "three", tone: "neutral", style: "solid", signal: true },
      { from: "business", to: "list", tone: "neutral", style: "solid", signal: true },
    ],
    clusters: [],
    settled: [],
  },
  pipeline: {
    kind: "pipeline",
    heading: "One deposit, start to finish",
    object: { type: "transaction", label: "Deposit" },
    stages: [
      { label: "Transfer", detail: "Straight to your account", status: "verified" },
      { label: "Proof", detail: "Uploaded with the booking", status: "verified" },
      { label: "Your check", detail: "Confirm or reject", status: "pending" },
    ],
    result: { label: "Awaiting confirmation", detail: "You decide", status: "pending" },
    settled: [],
  },
  decision: {
    kind: "decision",
    signals: [
      { id: "proof", label: "Proof uploaded", tone: "neutral" },
      { id: "amount", label: "Amount matches", tone: "neutral" },
      { id: "account", label: "Money in your account", tone: "neutral" },
    ],
    rule: { label: "You check", detail: "On the booking" },
    outcomes: [
      { id: "confirm", label: "Confirm booking", status: "verified" },
      { id: "wait", label: "Not counted yet", status: "pending" },
      { id: "reject", label: "Reject payment", status: "declined" },
    ],
    routes: [
      { from: "proof", to: "confirm" },
      { from: "account", to: "confirm" },
    ],
    settled: [],
  },
  timeline: {
    kind: "timeline",
    heading: "One booking, two payments",
    events: [
      { label: "Ada books knotless braids", time: "Monday", tone: "neutral", flagged: false },
      { label: "Deposit confirmed", time: "Monday", tone: "positive", flagged: false },
      { label: "Balance paid at the salon", time: "Saturday", tone: "positive", flagged: true },
    ],
    flag: { label: "Paid in full" },
    settled: [],
  },
  story: {
    kind: "story",
    mode: "problem",
    lines: [
      { text: "The client says the deposit is sent", role: "lead" },
      { text: "The screenshot is somewhere in the chat", role: "support" },
      { text: "Has she paid, or not?", role: "key" },
    ],
    recede: true,
    settled: [],
  },
  transformation: {
    kind: "transformation",
    heading: "What changes for the business",
    mode: "side-by-side",
    before: { title: "Chats and a notebook" },
    after: { title: "With Iker" },
    items: [
      {
        before: "Proof buried in a chat",
        after: "Proof on the booking",
        status: "verified",
      },
      { before: "Balance from memory", after: "Balance remaining, shown", status: "verified" },
    ],
    settled: [],
  },
  "character-scene": {
    kind: "character-scene",
    cast: [
      {
        id: "tola",
        name: "Tola",
        skin: "deep",
        hair: "afro",
        hairColour: "ink",
        outfit: "violet",
        hidden: false,
        pose: "idle",
        expression: "happy",
      },
      {
        id: "ada",
        name: "Ada",
        skin: "brown",
        hair: "bun",
        hairColour: "ink",
        outfit: "pink",
        hidden: false,
        pose: "idle",
        expression: "neutral",
      },
    ],
    props: [
      {
        kind: "checklist",
        id: "steps",
        with: "ada",
        items: [
          { label: "Open the link", status: "verified" },
          { label: "Pick a time", status: "verified" },
          { label: "Upload proof", status: "verified" },
        ],
      },
    ],
    actions: [
      { who: "tola", pose: "point", leave: false },
      { who: "ada", pose: "hold-phone", expression: "happy", leave: false },
      { who: "ada", status: "verified", leave: false },
    ],
    sends: [{ object: "link", from: "tola", to: "ada", label: "Booking link" }],
    settled: [],
  },
};

const SCENE_TYPES: Record<SceneVisualKind, SceneType> = {
  title: "INTRO",
  chapter: "EXPLANATION",
  statement: "PROBLEM",
  steps: "EXPLANATION",
  product: "DEMO",
  diagram: "DIAGRAM",
  comparison: "COMPARISON",
  code: "EXPLANATION",
  data: "OUTCOME",
  cta: "CTA",
  outro: "OUTRO",
  "identity-story": "PROBLEM",
  network: "DIAGRAM",
  pipeline: "DIAGRAM",
  decision: "DIAGRAM",
  timeline: "EXPLANATION",
  story: "PROBLEM",
  transformation: "COMPARISON",
  "character-scene": "EXPLANATION",
};

const SAMPLE_NARRATION: Partial<Record<SceneVisualKind, string>> = {
  statement:
    "A chat is not a payment record. Proof gets buried, balances live in memory, and the month is pieced together by hand.",
  steps:
    "The flow has four steps. The client books, transfers the deposit, you confirm it, and you record the balance when it is paid.",
  product: "Every payment sits on the booking, with what is paid so far and the balance remaining.",
};

/** Order in which the sample cut plays; it covers every visual kind. */
export const SAMPLE_KIND_ORDER: readonly SceneVisualKind[] = [
  "title",
  "chapter",
  "statement",
  "steps",
  "product",
  "diagram",
  "comparison",
  "code",
  "data",
  "identity-story",
  "network",
  "pipeline",
  "decision",
  "timeline",
  "story",
  "transformation",
  "character-scene",
  "cta",
  "outro",
];

const SAMPLE_SECONDS: Record<SceneVisualKind, number> = {
  title: 4,
  chapter: 2.5,
  statement: 7,
  steps: 8,
  product: 7,
  diagram: 7,
  comparison: 7,
  code: 6,
  data: 6,
  cta: 4,
  outro: 3.5,
  "identity-story": 10,
  network: 8,
  pipeline: 8,
  decision: 8,
  timeline: 7,
  story: 7,
  transformation: 7,
  "character-scene": 8,
};

function sampleScene(
  kind: SceneVisualKind,
  visual: SceneVisual = SAMPLE_VISUALS[kind],
  id: string = kind,
): Scene {
  return {
    id: `sample-${id}`,
    type: SCENE_TYPES[kind],
    enabled: true,
    narration: SAMPLE_NARRATION[kind] ?? "",
    estimatedDurationSeconds: SAMPLE_SECONDS[kind],
    visualInstructions: "",
    visual,
    animation: { enter: "rise", leadInSeconds: 0.4, tailSeconds: 0.5, minDurationSeconds: 0 },
    captions: { enabled: true },
    audio: { narrationVolume: 1 },
    ...(kind === "steps" ? { lowerThird: { title: "Deposit flow", subtitle: "Iker" } } : {}),
    assets: [],
  };
}

export interface SampleSceneOptions {
  /** Burn sample captions when the scene has sample narration. Defaults to the format's rule. */
  captions?: boolean;
  recording?: ResolvedRecording | null;
  reducedMotion?: boolean;
  visual?: SceneVisual;
}

/** Sample props for one visual kind in one format. Used by the studio and by visual checks. */
export function sampleSceneProps(
  kind: SceneVisualKind,
  formatId: FormatId,
  options: SampleSceneOptions = {},
): SceneRenderProps {
  const format = FORMATS[formatId];
  const scene = sampleScene(kind, options.visual);
  const seconds = SAMPLE_SECONDS[kind];
  const burn = options.captions ?? format.captions.burnInByDefault;
  const narration = SAMPLE_NARRATION[kind];
  const cues =
    burn && narration
      ? buildCues(
          estimateWordTimings(narration, seconds - 1.2).map((word) => ({
            ...word,
            startSeconds: word.startSeconds + 0.4,
            endSeconds: word.endSeconds + 0.4,
          })),
          format.captions,
        )
      : null;
  return {
    brand: SAMPLE_BRAND,
    format,
    scene,
    durationFrames: Math.round(seconds * format.fps),
    narration: null,
    beats: {},
    captions: cues,
    recording:
      kind === "product"
        ? options.recording === undefined
          ? SAMPLE_RECORDING
          : options.recording
        : null,
    progress: null,
    reducedMotion: options.reducedMotion ?? false,
    disclosure: kind === "product" ? SAMPLE_DISCLOSURE : null,
  };
}

/** Every visual kind in sequence, plus a product scene with no capture to show that state. */
export function sampleCutProps(formatId: FormatId): CutRenderProps {
  const scenes = SAMPLE_KIND_ORDER.flatMap((kind) => {
    const props = sampleSceneProps(kind, formatId);
    if (kind !== "product") return [props];
    const missing = sampleSceneProps(kind, formatId, { recording: null });
    return [props, { ...missing, scene: { ...missing.scene, id: "sample-product-missing" } }];
  });
  const total = scenes.reduce((sum, scene) => sum + scene.durationFrames, 0);
  let elapsed = 0;
  return {
    scenes: scenes.map((scene) => {
      const start = elapsed / total;
      elapsed += scene.durationFrames;
      return { ...scene, progress: { start, end: elapsed / total } };
    }),
  };
}

export const SAMPLE_SCENE: SceneRenderProps = sampleSceneProps("statement", "youtube-landscape");
export const SAMPLE_CUT: CutRenderProps = sampleCutProps("youtube-landscape");
export const SAMPLE_THUMBNAIL: ThumbnailRenderProps = {
  brand: SAMPLE_BRAND,
  variant: "statement",
  headline: "Stop chasing payments in DMs",
  screenshotSrc: null,
  displayUrl: null,
  disclosure: null,
};
