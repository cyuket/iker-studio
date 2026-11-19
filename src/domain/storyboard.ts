import { z } from "zod";
import { FormatIdSchema } from "./formats";
import { CutIdSchema, SceneIdSchema, SceneTypeSchema } from "./scene-types";

const Tone = z.enum(["neutral", "primary", "positive", "warning", "danger"]);
export type Tone = z.infer<typeof Tone>;

/** A rectangle in fractions (0-1) of the recorded viewport. */
const RegionSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().gt(0).max(1),
  height: z.number().gt(0).max(1),
});
export type Region = z.infer<typeof RegionSchema>;

const Slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Name of a narration cue. Visuals use it to say WHEN something happens. */
const CueRef = z.string().regex(Slug, "cue ids are lowercase words separated by hyphens");
const ItemId = z.string().regex(Slug, "ids are lowercase words separated by hyphens");
/** Cue ids that are already complete on the first frame, so a scene can continue the last. */
const Settled = z.array(CueRef).default([]);

const StatusSchema = z.enum(["verified", "flagged", "pending", "declined"]);
export type Status = z.infer<typeof StatusSchema>;

/**
 * A moment in a scene, named after the words that are being spoken when it happens. The
 * compiler turns each cue into a time from the scene's measured word timings, so visuals
 * stay in step with the voice when the narration is regenerated.
 */
export const CueSchema = z.object({
  id: CueRef,
  /** Consecutive words from this scene's narration. Case and punctuation are ignored. */
  phrase: z.string().min(1),
  /** Fire as the phrase starts to be spoken, or as it finishes. */
  at: z.enum(["start", "end"]).default("start"),
  /** Shifts the moment; negative values lead the voice. */
  offsetSeconds: z.number().min(-10).max(10).default(0),
  /** Which occurrence of the phrase to use when it is spoken more than once. */
  occurrence: z.number().int().min(1).default(1),
});
export type Cue = z.infer<typeof CueSchema>;

/** Plain-language brief for whoever directs or reviews the scene. Never rendered. */
export const DirectionSchema = z.object({
  objective: z.string().optional(),
  representation: z.string().optional(),
  layout: z.string().optional(),
  motion: z.string().optional(),
  camera: z.string().optional(),
  transition: z.string().optional(),
  finalFrame: z.string().optional(),
});
export type Direction = z.infer<typeof DirectionSchema>;

const TitleVisual = z.object({
  kind: z.literal("title"),
  headline: z.string().min(1),
  subhead: z.string().optional(),
});

const StatementVisual = z.object({
  kind: z.literal("statement"),
  headline: z.string().min(1),
  body: z.string().optional(),
  points: z
    .array(z.object({ title: z.string().min(1), detail: z.string().optional() }))
    .max(4)
    .default([]),
  tone: Tone.default("neutral"),
});

const StepsVisual = z.object({
  kind: z.literal("steps"),
  heading: z.string().min(1),
  steps: z
    .array(z.object({ title: z.string().min(1), detail: z.string().optional() }))
    .min(2)
    .max(5),
});

const ProductVisual = z.object({
  kind: z.literal("product"),
  /** Recording scenario whose capture this scene shows. */
  scenarioId: z.string().min(1),
  /** `video` plays the recording; `screenshot` holds one captured still. */
  mode: z.enum(["video", "screenshot"]).default("video"),
  /** Name of the screenshot step to show when mode is `screenshot`. */
  screenshot: z.string().optional(),
  heading: z.string().optional(),
  /**
   * What the footage is shown in: a browser window, a generic phone (for 9:16 cuts and
   * phone-sized recordings) or a generic landscape tablet (for 16:9 cuts).
   */
  device: z.enum(["browser", "iphone", "ipad"]).default("browser"),
  /** Callouts placed over the recording, timed in seconds from the start of the scene. */
  annotations: z
    .array(
      z.object({
        text: z.string().min(1),
        region: RegionSchema,
        fromSeconds: z.number().min(0).default(0),
        toSeconds: z.number().gt(0).optional(),
        /** Cue that shows the callout; takes precedence over `fromSeconds`. */
        cue: CueRef.optional(),
        /** Cue that removes it; takes precedence over `toSeconds`. */
        untilCue: CueRef.optional(),
        spotlight: z.boolean().default(false),
      }),
    )
    .default([]),
  /** The part of the screen that must stay legible when the scene is recomposed for 9:16. */
  focus: RegionSchema.optional(),
  /** A single eased push-in towards `focus`; off by default to avoid constant zooming. */
  zoom: z.boolean().default(false),
  showCursor: z.boolean().default(true),
  /**
   * Virtual camera over the footage. Moves are applied in composition, never in the
   * browser, so one recording can be reframed without recording it again.
   */
  camera: z
    .object({
      /** `follow` derives the moves from the recording's own timeline of actions. */
      mode: z.enum(["static", "follow", "manual"]).default("follow"),
      maxZoom: z.number().min(1).max(4).default(2),
      /** Dim everything outside the element in focus. */
      isolate: z.boolean().default(false),
      /** Manual mode only. A null region returns to the full frame. */
      keyframes: z
        .array(
          z.object({
            cue: CueRef.optional(),
            atSeconds: z.number().min(0).optional(),
            region: RegionSchema.nullable(),
            zoom: z.number().min(1).max(4).optional(),
          }),
        )
        .default([]),
    })
    .optional(),
  /** When the recording plays, relative to the scene. Without it, playback starts at once. */
  footage: z
    .object({
      startCue: CueRef.optional(),
      startSeconds: z.number().min(0).default(0),
      /** Second of the recording that playback begins on; what comes before is never shown. */
      fromSeconds: z.number().min(0).default(0),
      /** Second of the recording playback stops on and holds; what comes after is never shown. */
      toSeconds: z.number().gt(0).optional(),
      /** Pins moments of the recording to cues; playback speeds up or slows down between them. */
      anchors: z.array(z.object({ cue: CueRef, recordingSeconds: z.number().min(0) })).default([]),
    })
    .optional(),
  /**
   * A motion graphic that opens the scene and hands over to the footage: it collapses onto
   * the place in the recording where the real thing then appears.
   */
  prelude: z
    .object({
      visual: z.lazy(() => MotionGraphicVisualSchema),
      /** Moment of the handoff. Without a cue, `handoffSeconds` is used. */
      handoffCue: CueRef.optional(),
      handoffSeconds: z.number().min(0).optional(),
      /** Id of the prelude element that becomes the footage; the whole graphic when omitted. */
      anchor: z.string().optional(),
      /** Region of the recording the graphic lands on; the whole frame when omitted. */
      landsOn: RegionSchema.optional(),
    })
    .optional(),
});

const DiagramVisual = z.object({
  kind: z.literal("diagram"),
  heading: z.string().optional(),
  nodes: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        sublabel: z.string().optional(),
        tone: Tone.default("neutral"),
        /** Column in the left-to-right flow; nodes in one column stack vertically. */
        column: z.number().int().min(0).max(4),
      }),
    )
    .min(2)
    .max(9),
  edges: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      label: z.string().optional(),
      tone: Tone.default("neutral"),
    }),
  ),
});

const ComparisonSide = z.object({
  title: z.string().min(1),
  points: z.array(z.string().min(1)).min(1).max(4),
  tone: Tone.default("neutral"),
});
const ComparisonVisual = z.object({
  kind: z.literal("comparison"),
  heading: z.string().optional(),
  left: ComparisonSide,
  right: ComparisonSide,
});

const CodeVisual = z.object({
  kind: z.literal("code"),
  heading: z.string().optional(),
  language: z.string().min(1),
  code: z.string().min(1),
  highlightLines: z.array(z.number().int().positive()).default([]),
});

const DataVisual = z.object({
  kind: z.literal("data"),
  heading: z.string().min(1),
  unit: z.string().default(""),
  series: z
    .array(z.object({ label: z.string().min(1), value: z.number(), tone: Tone.default("primary") }))
    .min(1)
    .max(6),
  /** Where the numbers come from. Required so a chart can never present invented data as fact. */
  source: z.string().min(1),
  illustrative: z.boolean(),
});

const CtaVisual = z.object({
  kind: z.literal("cta"),
  headline: z.string().min(1),
  action: z.string().min(1),
  url: z.string().min(1),
});

const OutroVisual = z.object({
  kind: z.literal("outro"),
  tagline: z.string().optional(),
});

const ChapterVisual = z.object({
  kind: z.literal("chapter"),
  title: z.string().min(1),
});

const IDENTITY_FIELD_ICONS = [
  "name",
  "email",
  "phone",
  "document",
  "date",
  "address",
  "device",
  "wallet",
] as const;

const IdentityStoryVisual = z.object({
  kind: z.literal("identity-story"),
  heading: z.string().optional(),
  accounts: z
    .array(
      z.object({
        id: ItemId,
        /** Obviously fictional. Shown as the card's title. */
        name: z.string().min(1),
        nameDiffers: z.boolean().default(false),
        /** When the name is filled in; with the card when omitted. */
        nameCue: CueRef.optional(),
        /** Seed of the abstract face glyph. The same seed is literally the same face. */
        face: z.string().min(1),
        fields: z
          .array(
            z.object({
              icon: z.enum(IDENTITY_FIELD_ICONS),
              value: z.string().min(1),
              /** Emphasised as "not the same as on the other account". */
              differs: z.boolean().default(false),
              cue: CueRef.optional(),
            }),
          )
          .max(4)
          .default([]),
        /** When the card appears. */
        cue: CueRef.optional(),
        /** What happens to this account, in order: sign-up, verification, account open. */
        steps: z
          .array(
            z.object({
              label: z.string().min(1),
              status: StatusSchema.optional(),
              cue: CueRef.optional(),
            }),
          )
          .max(3)
          .default([]),
      }),
    )
    .min(1)
    .max(4),
  /** Time passing between one account and the next. */
  gaps: z
    .array(z.object({ after: ItemId, label: z.string().min(1), cue: CueRef.optional() }))
    .default([]),
  /** Reveals that accounts share a face: the rest recedes and the faces are joined. */
  match: z
    .object({
      cue: CueRef.optional(),
      label: z.string().min(1).default("Same face"),
      /** Accounts to join. Defaults to every account whose face seed occurs more than once. */
      accounts: z.array(ItemId).optional(),
      isolate: z.boolean().default(true),
      tone: Tone.default("primary"),
    })
    .optional(),
  settled: Settled,
});

const NETWORK_NODE_TYPES = [
  "account",
  "person",
  "face",
  "device",
  "wallet",
  "document",
  "business",
  "list",
  "signal",
] as const;

const NetworkVisual = z.object({
  kind: z.literal("network"),
  heading: z.string().optional(),
  /** `radial` puts the hub in the middle; `groups` lays node groups out side by side. */
  layout: z.enum(["radial", "groups"]).default("radial"),
  /** Centre of a radial layout; the first node when omitted. */
  hub: ItemId.optional(),
  nodes: z
    .array(
      z.object({
        id: ItemId,
        type: z.enum(NETWORK_NODE_TYPES),
        label: z.string().optional(),
        sublabel: z.string().optional(),
        /** Face glyph seed for person, account and face nodes. */
        face: z.string().optional(),
        /** Nodes with the same group sit together in the `groups` layout. */
        group: z.string().optional(),
        tone: Tone.default("neutral"),
        status: StatusSchema.optional(),
        /** Drawn faint: present, but not part of what is being compared. */
        muted: z.boolean().default(false),
        /** Radial layout only: placed beyond the ring, for what is deliberately left out. */
        outside: z.boolean().default(false),
        cue: CueRef.optional(),
      }),
    )
    .min(2)
    .max(14),
  edges: z
    .array(
      z.object({
        from: ItemId,
        to: ItemId,
        tone: Tone.default("neutral"),
        style: z.enum(["solid", "dashed"]).default("solid"),
        /** When the edge draws itself. */
        cue: CueRef.optional(),
        /** A single pulse travels along the edge as it draws. */
        signal: z.boolean().default(false),
        /** Later, the edge is picked out: recoloured, thickened and optionally named. */
        mark: z
          .object({
            cue: CueRef.optional(),
            tone: Tone.default("warning"),
            label: z.string().optional(),
          })
          .optional(),
      }),
    )
    .default([]),
  /** A boundary drawn around some nodes: a cluster that was found, or a scope. */
  clusters: z
    .array(
      z.object({
        nodes: z.array(ItemId).min(1),
        label: z.string().optional(),
        tone: Tone.default("primary"),
        cue: CueRef.optional(),
        /** Everything outside the boundary recedes. */
        isolate: z.boolean().default(false),
      }),
    )
    .default([]),
  settled: Settled,
});

const PIPELINE_OBJECT_TYPES = [
  "document",
  "selfie",
  "person",
  "transaction",
  "business",
  "wallet",
  "data",
] as const;

const PipelineVisual = z.object({
  kind: z.literal("pipeline"),
  heading: z.string().optional(),
  /** The thing that travels through the stages. */
  object: z.object({
    type: z.enum(PIPELINE_OBJECT_TYPES),
    label: z.string().optional(),
    face: z.string().optional(),
  }),
  stages: z
    .array(
      z.object({
        label: z.string().min(1),
        detail: z.string().optional(),
        /** How the stage ends for this object. */
        status: StatusSchema.default("verified"),
        /** When the object arrives at the stage. */
        cue: CueRef.optional(),
      }),
    )
    .min(2)
    .max(6),
  /** What the object emerges as. */
  result: z
    .object({
      label: z.string().min(1),
      detail: z.string().optional(),
      status: StatusSchema.default("verified"),
      cue: CueRef.optional(),
    })
    .optional(),
  /** Picks one stage out once the object has passed: the others recede. */
  focus: z.object({ stage: z.number().int().min(0), cue: CueRef.optional() }).optional(),
  settled: Settled,
});

const DecisionVisual = z.object({
  kind: z.literal("decision"),
  heading: z.string().optional(),
  signals: z
    .array(
      z.object({
        id: ItemId,
        label: z.string().min(1),
        detail: z.string().optional(),
        tone: Tone.default("neutral"),
        cue: CueRef.optional(),
      }),
    )
    .min(1)
    .max(5),
  /** Where the signals are weighed: a rule, a policy, or a person. */
  rule: z.object({
    label: z.string().min(1),
    detail: z.string().optional(),
    cue: CueRef.optional(),
  }),
  outcomes: z
    .array(
      z.object({
        id: ItemId,
        label: z.string().min(1),
        detail: z.string().optional(),
        status: StatusSchema,
        cue: CueRef.optional(),
      }),
    )
    .min(2)
    .max(4),
  /** Paths that light up. Without `from`, every signal feeds the route. */
  routes: z
    .array(z.object({ from: ItemId.optional(), to: ItemId, cue: CueRef.optional() }))
    .default([]),
  /**
   * A level against a threshold, drawn inside the rule. It never prints a number: a bar
   * shows "how strong", not a measurement nobody made.
   */
  score: z
    .object({
      label: z.string().min(1),
      level: z.number().min(0).max(1),
      threshold: z.number().min(0).max(1).optional(),
      cue: CueRef.optional(),
    })
    .optional(),
  settled: Settled,
});

const TimelineVisual = z.object({
  kind: z.literal("timeline"),
  heading: z.string().optional(),
  events: z
    .array(
      z.object({
        label: z.string().min(1),
        /** When it happened, as the viewer should read it: "Day 1", "3 weeks later". */
        time: z.string().optional(),
        tone: Tone.default("neutral"),
        flagged: z.boolean().default(false),
        cue: CueRef.optional(),
      }),
    )
    .min(2)
    .max(7),
  /** When the flagged events are picked out and the rest recede. */
  flag: z.object({ cue: CueRef.optional(), label: z.string().optional() }).optional(),
  settled: Settled,
});

const StoryVisual = z.object({
  kind: z.literal("story"),
  /**
   * `problem` ends on a key line that reframes what came before, `outcome` gives each line
   * a status mark, `disclosure` simply reveals line by line.
   */
  mode: z.enum(["problem", "disclosure", "outcome"]).default("disclosure"),
  lines: z
    .array(
      z.object({
        text: z.string().min(1),
        role: z.enum(["lead", "support", "key"]).default("support"),
        status: StatusSchema.optional(),
        cue: CueRef.optional(),
      }),
    )
    .min(1)
    .max(6),
  /** Lines already read step back when the next one arrives. */
  recede: z.boolean().default(true),
  settled: Settled,
});

const TransformationVisual = z.object({
  kind: z.literal("transformation"),
  heading: z.string().optional(),
  /** `side-by-side` keeps the before state visible; `in-place` replaces it. */
  mode: z.enum(["side-by-side", "in-place"]).default("side-by-side"),
  before: z.object({ title: z.string().min(1) }),
  after: z.object({ title: z.string().min(1) }),
  items: z
    .array(
      z.object({
        before: z.string().min(1),
        after: z.string().min(1),
        status: StatusSchema.optional(),
        /** When this item changes state. */
        cue: CueRef.optional(),
      }),
    )
    .min(1)
    .max(5),
  settled: Settled,
});

export const CHARACTER_SKIN = ["deep", "brown", "tan", "light"] as const;
export const CHARACTER_HAIR = [
  "crop",
  "afro",
  "puffs",
  "bun",
  "bob",
  "long",
  "sweep",
  "none",
] as const;
export const CHARACTER_HAIR_COLOUR = ["ink", "brown", "auburn", "silver", "violet"] as const;
export const CHARACTER_OUTFIT = [
  "violet",
  "blue",
  "cyan",
  "pink",
  "lilac",
  "slate",
  "cream",
] as const;
export const CHARACTER_POSES = [
  "idle",
  "wave",
  "think",
  "point",
  "shrug",
  "hold-phone",
  "hold-id",
  "selfie",
  "at-laptop",
] as const;
export const CHARACTER_EXPRESSIONS = [
  "neutral",
  "happy",
  "curious",
  "worried",
  "surprised",
] as const;
const CharacterPose = z.enum(CHARACTER_POSES);
const CharacterExpression = z.enum(CHARACTER_EXPRESSIONS);
/** Short enough to be read while it is being said. */
const BubbleText = z.string().min(1).max(48);
const CHARACTER_TILE_ICONS = ["id-card", "selfie", "link", "phone", "laptop", "money"] as const;

/** Things on the stage that are not people. Each appears on its `cue`. */
const CharacterSceneProp = z.discriminatedUnion("kind", [
  /** A phone showing a money app as a few plain shapes. Never a screen of the product. */
  z.object({
    kind: z.literal("app"),
    id: ItemId,
    label: z.string().optional(),
    with: ItemId.optional(),
    cue: CueRef.optional(),
  }),
  /** People arriving one by one, as face glyphs. `ask` puts a question mark over each. */
  z.object({
    kind: z.literal("signups"),
    id: ItemId,
    label: z.string().optional(),
    people: z
      .array(z.object({ face: z.string().min(1), cue: CueRef.optional() }))
      .min(1)
      .max(8),
    ask: z.object({ cue: CueRef.optional() }).optional(),
    with: ItemId.optional(),
    cue: CueRef.optional(),
  }),
  /** A list of steps. An item with a status is ticked on its `statusCue`. */
  z.object({
    kind: z.literal("checklist"),
    id: ItemId,
    title: z.string().optional(),
    items: z
      .array(
        z.object({
          label: z.string().min(1),
          cue: CueRef.optional(),
          status: StatusSchema.optional(),
          /** When the status is stamped; with the item when omitted. */
          statusCue: CueRef.optional(),
        }),
      )
      .min(1)
      .max(5),
    with: ItemId.optional(),
    cue: CueRef.optional(),
  }),
  /** A sign-up as the business sees it: a placeholder avatar, a name and one detail. */
  z.object({
    kind: z.literal("card"),
    id: ItemId,
    /** Obviously fictional. */
    name: z.string().min(1),
    detail: z.string().optional(),
    with: ItemId.optional(),
    cue: CueRef.optional(),
  }),
  /** A term set large. `short` then picks its initials out and sets the short form. */
  z.object({
    kind: z.literal("keyword"),
    id: ItemId,
    text: z.string().min(1).max(40),
    short: z.object({ text: z.string().min(1).max(8), cue: CueRef.optional() }).optional(),
    with: ItemId.optional(),
    cue: CueRef.optional(),
  }),
  /** One to three objects as icon tiles: what somebody has, shows or is asked for. */
  z.object({
    kind: z.literal("tiles"),
    id: ItemId,
    items: z
      .array(
        z.object({
          icon: z.enum(CHARACTER_TILE_ICONS),
          label: z.string().optional(),
          cue: CueRef.optional(),
          status: StatusSchema.optional(),
          statusCue: CueRef.optional(),
        }),
      )
      .min(1)
      .max(3),
    with: ItemId.optional(),
    cue: CueRef.optional(),
  }),
]);

const CharacterSceneVisual = z
  .object({
    kind: z.literal("character-scene"),
    heading: z.string().optional(),
    cast: z
      .array(
        z.object({
          id: ItemId,
          /** Obviously fictional. Shown under the figure. */
          name: z.string().optional(),
          /** What the look is derived from; the id when omitted. Same seed, same person. */
          seed: z.string().min(1).optional(),
          skin: z.enum(CHARACTER_SKIN).optional(),
          hair: z.enum(CHARACTER_HAIR).optional(),
          hairColour: z.enum(CHARACTER_HAIR_COLOUR).optional(),
          outfit: z.enum(CHARACTER_OUTFIT).optional(),
          /** Somebody whose identity is not known: a plain silhouette with no features. */
          hidden: z.boolean().default(false),
          /** What they are doing and feeling when they arrive. */
          pose: CharacterPose.default("idle"),
          expression: CharacterExpression.default("neutral"),
          /** When they arrive. */
          cue: CueRef.optional(),
        }),
      )
      .min(1)
      .max(4),
    props: z.array(CharacterSceneProp).max(4).default([]),
    /**
     * Left-to-right order of the cast and of the props that stand on their own. Defaults to
     * the cast, then the props. A prop `with` a character belongs to that character instead.
     */
    stage: z.array(ItemId).optional(),
    /** What the characters do, in order. One action may change several things at once. */
    actions: z
      .array(
        z.object({
          who: ItemId,
          cue: CueRef.optional(),
          pose: CharacterPose.optional(),
          expression: CharacterExpression.optional(),
          /** A speech bubble. It replaces the character's previous bubble. */
          say: BubbleText.optional(),
          /** A thought bubble. */
          think: BubbleText.optional(),
          /** When this action's bubble goes away again; it stays when omitted. */
          untilCue: CueRef.optional(),
          status: StatusSchema.optional(),
          /** The character leaves the stage. */
          leave: z.boolean().default(false),
        }),
      )
      .max(24)
      .default([]),
    /** Something handed from one character to another. It comes to rest beside the receiver. */
    sends: z
      .array(
        z.object({
          object: z.enum(CHARACTER_TILE_ICONS).default("link"),
          from: ItemId,
          to: ItemId,
          label: z.string().optional(),
          cue: CueRef.optional(),
        }),
      )
      .max(3)
      .default([]),
    settled: Settled,
  })
  .superRefine((visual, context) => {
    const cast = new Set(visual.cast.map((character) => character.id));
    const ids = [...visual.cast, ...visual.props].map((item) => item.id);
    const issue = (message: string): void => {
      context.addIssue({ code: "custom", message });
    };
    ids.forEach((id, i) => {
      if (ids.indexOf(id) !== i) issue(`"${id}" is used as an id more than once.`);
    });
    for (const prop of visual.props) {
      if (prop.with !== undefined && !cast.has(prop.with)) {
        issue(`Prop "${prop.id}" is with "${prop.with}", who is not in the cast.`);
      }
    }
    for (const action of visual.actions) {
      if (!cast.has(action.who)) issue(`An action names "${action.who}", who is not in the cast.`);
      if (action.say !== undefined && action.think !== undefined) {
        issue(`An action of "${action.who}" both says and thinks; give it one bubble.`);
      }
    }
    for (const send of visual.sends) {
      for (const id of [send.from, send.to]) {
        if (!cast.has(id)) issue(`A send names "${id}", who is not in the cast.`);
      }
      if (send.from === send.to) issue(`A send goes from "${send.from}" to the same character.`);
    }
    for (const id of visual.stage ?? []) {
      if (!ids.includes(id)) issue(`The stage lists "${id}", which is neither cast nor prop.`);
    }
  });

/** Visual kinds drawn entirely by the motion-graphics library; any can be a product prelude. */
export const MotionGraphicVisualSchema = z.discriminatedUnion("kind", [
  IdentityStoryVisual,
  NetworkVisual,
  PipelineVisual,
  DecisionVisual,
  TimelineVisual,
  StoryVisual,
  TransformationVisual,
  CharacterSceneVisual,
]);
export type MotionGraphicVisual = z.infer<typeof MotionGraphicVisualSchema>;
export const MOTION_GRAPHIC_KINDS = [
  "identity-story",
  "network",
  "pipeline",
  "decision",
  "timeline",
  "story",
  "transformation",
  "character-scene",
] as const;
export type IdentityStoryVisualData = z.infer<typeof IdentityStoryVisual>;
export type NetworkVisualData = z.infer<typeof NetworkVisual>;
export type PipelineVisualData = z.infer<typeof PipelineVisual>;
export type DecisionVisualData = z.infer<typeof DecisionVisual>;
export type TimelineVisualData = z.infer<typeof TimelineVisual>;
export type StoryVisualData = z.infer<typeof StoryVisual>;
export type TransformationVisualData = z.infer<typeof TransformationVisual>;
export type CharacterSceneVisualData = z.infer<typeof CharacterSceneVisual>;
export type CharacterSceneProp = z.infer<typeof CharacterSceneProp>;
export type CharacterPose = z.infer<typeof CharacterPose>;
export type CharacterExpression = z.infer<typeof CharacterExpression>;

/** One line saying what a motion graphic shows, for storyboard previews and reports. */
export function describeMotionGraphic(visual: MotionGraphicVisual): string {
  switch (visual.kind) {
    case "identity-story":
      return `Identity story: ${visual.accounts.map((account) => account.name).join(" · ")}`;
    case "network":
      return `Network of ${visual.nodes.length} nodes, ${visual.edges.length} edges`;
    case "pipeline":
      return `Pipeline: ${visual.stages.map((stage) => stage.label).join(" → ")}`;
    case "decision":
      return `Decision: ${visual.rule.label} → ${visual.outcomes.map((o) => o.label).join(" / ")}`;
    case "timeline":
      return `Timeline: ${visual.events.map((event) => event.label).join(" → ")}`;
    case "story":
      return visual.lines.map((line) => line.text).join(" / ");
    case "transformation":
      return `${visual.before.title} → ${visual.after.title}`;
    case "character-scene":
      return `Characters: ${visual.cast.map((character) => character.name ?? character.id).join(" · ")}`;
  }
}

export function isMotionGraphic(visual: { kind: string }): visual is MotionGraphicVisual {
  return (MOTION_GRAPHIC_KINDS as readonly string[]).includes(visual.kind);
}

export const SceneVisualSchema = z.discriminatedUnion("kind", [
  TitleVisual,
  StatementVisual,
  StepsVisual,
  ProductVisual,
  DiagramVisual,
  ComparisonVisual,
  CodeVisual,
  DataVisual,
  CtaVisual,
  OutroVisual,
  ChapterVisual,
  IdentityStoryVisual,
  NetworkVisual,
  PipelineVisual,
  DecisionVisual,
  TimelineVisual,
  StoryVisual,
  TransformationVisual,
  CharacterSceneVisual,
]);
export type SceneVisual = z.infer<typeof SceneVisualSchema>;
export type SceneVisualKind = SceneVisual["kind"];
export type ProductSceneVisual = z.infer<typeof ProductVisual>;

export const SceneSchema = z.object({
  id: SceneIdSchema,
  type: SceneTypeSchema,
  enabled: z.boolean().default(true),
  /** Synced from script.md; edit the script, not this field. */
  narration: z.string(),
  estimatedDurationSeconds: z.number().min(0),
  /** Plain-language direction for whoever designs or reviews the scene. */
  visualInstructions: z.string().default(""),
  visual: SceneVisualSchema,
  /** Moments of this scene, named after the narration words that are spoken at them. */
  cues: z.array(CueSchema).optional(),
  direction: DirectionSchema.optional(),
  animation: z
    .object({
      /**
       * `hold` opens on the finished composition instead of the bare background, so the
       * scene can carry on from the frame the previous scene ended on.
       */
      enter: z.enum(["rise", "fade", "none", "hold"]).default("rise"),
      /** `hold` keeps the last frame on screen instead of fading to the bare background. */
      exit: z.enum(["fade", "hold"]).optional(),
      /** Silence held before and after narration, in seconds. */
      leadInSeconds: z.number().min(0).max(5).default(0.4),
      tailSeconds: z.number().min(0).max(5).default(0.5),
      /** Lower bound for scenes whose visuals need longer than the narration. */
      minDurationSeconds: z.number().min(0).default(0),
    })
    .prefault({}),
  captions: z.object({ enabled: z.boolean().default(true) }).prefault({}),
  audio: z.object({ narrationVolume: z.number().min(0).max(1).default(1) }).prefault({}),
  lowerThird: z.object({ title: z.string().min(1), subtitle: z.string().optional() }).optional(),
  /** Marks the start of a YouTube chapter. */
  chapterTitle: z.string().optional(),
  /** Extra files the scene depends on, relative to the video directory. */
  assets: z.array(z.string()).default([]),
});
export type Scene = z.infer<typeof SceneSchema>;

export const CutSchema = z.object({
  id: CutIdSchema,
  format: FormatIdSchema,
  targetSeconds: z.object({ min: z.number().positive(), max: z.number().positive() }),
  /** null follows the format default (on for vertical and social, off for YouTube 16:9). */
  burnCaptions: z.boolean().nullable().default(null),
  /**
   * Draws a progress bar across the cut. Off by default because the bar's position in each
   * scene depends on the length of the whole cut: with it on, changing the length of one
   * scene re-renders every scene.
   */
  showProgress: z.boolean().default(false),
  /**
   * `static` is the still canvas. `animated` lets the canvas drift slowly behind the scenes
   * (glows, grid and edge dots), driven by time since the start of the cut so it flows across
   * the hard joins. Like the progress bar, it ties each scene to its position in the cut:
   * changing the length of one scene re-renders the scenes after it.
   */
  background: z.enum(["static", "animated"]).default("static"),
  /** Licensed music bed, relative to the repository's assets/music directory. Optional. */
  music: z
    .object({
      file: z.string().min(1),
      volume: z.number().min(0).max(1).default(0.12),
      licence: z.string().min(1),
    })
    .nullable()
    .default(null),
  scenes: z.array(SceneSchema).min(1),
});
export type Cut = z.infer<typeof CutSchema>;

export const StoryboardSchema = z.object({
  schemaVersion: z.literal(1),
  videoId: z.string().min(1),
  version: z.number().int().positive(),
  /** Hash of the script this storyboard was last synced from. */
  scriptHash: z.string(),
  cuts: z.array(CutSchema).min(1),
});
export type Storyboard = z.infer<typeof StoryboardSchema>;

export function enabledScenes(cut: Cut): Scene[] {
  return cut.scenes.filter((scene) => scene.enabled);
}

export function findCut(storyboard: Storyboard, cutId: string): Cut | undefined {
  return storyboard.cuts.find((cut) => cut.id === cutId);
}

/** Scenario ids that enabled scenes depend on, across the given cuts. */
export function requiredScenarioIds(cuts: readonly Cut[]): string[] {
  const ids = new Set<string>();
  for (const cut of cuts) {
    for (const scene of enabledScenes(cut)) {
      if (scene.visual.kind === "product") ids.add(scene.visual.scenarioId);
    }
  }
  return [...ids].sort();
}
