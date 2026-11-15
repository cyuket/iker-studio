import { countWords, lintScript, type LintIssue, type Script } from "./script";
import { normaliseSpoken, splitSentences, type VoiceDirection } from "./voice-direction";

/**
 * Checks on the voice-optimised wording. The spoken text may sound different from the
 * script but must not say anything the script does not: the same banned phrases and claim
 * rules apply, and no number, name or claim may appear that the approved script lacks.
 */

/** The script's own rules that apply to any text a viewer hears. */
const SCRIPT_TEXT_RULES = new Set([
  "banned-phrase",
  "placeholder",
  "absolute-claim",
  "quantified-claim",
]);

/** Corporate filler that reads as a brochure when spoken. Matched as whole words. */
export const CORPORATE_PHRASES: readonly string[] = [
  "leverage",
  "leverages",
  "utilise",
  "utilize",
  "in order to",
  "seamless",
  "seamlessly",
  "robust",
  "solution",
  "solutions",
  "empower",
  "empowers",
  "holistic",
  "end-to-end",
  "at scale",
  "streamline",
  "streamlines",
  "going forward",
  "best practices",
];

/** Forms that sound stiff aloud. Reported as suggestions, since a full form can be a choice. */
const UNCONTRACTED =
  /\b(?:it is|that is|there is|do not|does not|did not|is not|are not|will not|cannot|you are|we are|they are)\b/gi;

const NUMBER_WORDS: Record<string, string> = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  twenty: "20",
  thirty: "30",
  forty: "40",
  fifty: "50",
  sixty: "60",
  seventy: "70",
  eighty: "80",
  ninety: "90",
  hundred: "100",
  thousand: "1000",
  million: "1000000",
  billion: "1000000000",
  half: "1/2",
  double: "x2",
  twice: "x2",
  triple: "x3",
  percent: "%",
};

/** Words too common to count as new content. */
const STOP_WORDS = new Set(
  `a about after again all already also an and any are aren't as at back be because been before being both but by can can't
  could did didn't do does doesn't doing don't down each either else even ever every for from get gets go goes going got had
  has hasn't have haven't he her here here's him his how i if in into is isn't it it's its just let let's like me more most
  much my need needs new no nor not now of off on once only or other our out over own same she should so some still such
  than that that's the their them then there there's these they they're this those through to too under up us very was we
  we're well were what what's when where whether which while who whom why will with won't would you you're you've your
  one two three something someone anything anyone thing things way really actually simply means mean say says said tell
  tells know knows see sees look looks comes come goes turn turns happens happen kind sort`.split(
    /\s+/,
  ),
);

function tokens(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*[\p{L}\p{N}]|[\p{L}\p{N}]/gu) ?? [];
}

/**
 * A crude stem: enough to see that "matches", "matching" and "reviewer" are not new next to
 * "match" and "review". It only has to agree with itself, not produce real words.
 */
export function stem(word: string): string {
  let plain = word.replace(/['’]s$/, "").replace(/['’]/g, "");
  // Two passes, so "settings" loses its plural and then meets "setting" at the same stem.
  for (let pass = 0; pass < 2; pass++) {
    const suffix = ["ing", "ers", "er", "ed", "es", "ly", "s"].find(
      (candidate) => plain.length - candidate.length >= 3 && plain.endsWith(candidate),
    );
    if (suffix === undefined) break;
    plain = plain.slice(0, -suffix.length);
  }
  if (plain.length > 3 && plain.endsWith("e")) plain = plain.slice(0, -1);
  return plain.endsWith("y") ? `${plain.slice(0, -1)}i` : plain;
}

/** Every quantity in a text, with digits and number words reduced to one spelling. */
export function numbersIn(text: string): string[] {
  const found: string[] = [];
  for (const token of tokens(text.replace(/%/g, " percent "))) {
    if (/^\d/.test(token)) found.push(token.replace(/[.,]$/, ""));
    else {
      for (const part of token.split("-")) {
        const value = NUMBER_WORDS[part];
        if (value !== undefined) found.push(value);
      }
    }
  }
  return found;
}

/** Names, addresses and initialisms: capitalised words that do not merely start a sentence. */
export function properNouns(text: string): string[] {
  const found = new Set<string>();
  for (const sentence of splitSentences(text)) {
    const words = sentence.split(" ");
    words.forEach((raw, index) => {
      const word = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
      if (!word) return;
      const address = /^[\w-]+\.[a-z]{2,}$/i.test(word);
      const initialism = /^[A-Z]{2,}$/.test(word);
      const capitalised = /^\p{Lu}\p{Ll}/u.test(word) && index > 0;
      if (address || initialism || capitalised) found.add(word.toLowerCase());
    });
  }
  return [...found];
}

export interface SpokenSceneInput {
  sceneId: string;
  /** The scene as approved in script.md. */
  narration: string;
  spoken: string;
}

const MAX_SENTENCE_WORDS = 28;
const LENGTH_TOLERANCE = 0.25;

function style(scene: SpokenSceneInput): LintIssue[] {
  const issues: LintIssue[] = [];
  const push = (rule: string, message: string): void => {
    issues.push({ severity: "warning", rule, message, sceneId: scene.sceneId });
  };
  const spoken = normaliseSpoken(scene.spoken);
  const lower = spoken.toLowerCase();
  for (const phrase of CORPORATE_PHRASES) {
    if (new RegExp(`(?<![\\p{L}-])${phrase}(?![\\p{L}-])`, "u").test(lower)) {
      push("corporate-phrase", `"${phrase}" reads like a brochure. Say what it does instead.`);
    }
  }
  if (/[—–]/.test(spoken)) push("dash", "Remove the dash: use a comma or a new sentence.");
  if (/\d/.test(spoken.replace(/\b[\w-]+\.[a-z]{2,}\b/gi, ""))) {
    push("digits", "Write numbers as words so the voice reads them the way you intend.");
  }
  if (/[()/;]|\be\.g\.|\bi\.e\./.test(spoken.replace(/\b[\w-]+\.[a-z]{2,}\b/gi, ""))) {
    push(
      "written-for-the-eye",
      "Brackets, slashes, semicolons and abbreviations do not read aloud.",
    );
  }
  const stiff = [...new Set((spoken.match(UNCONTRACTED) ?? []).map((m) => m.toLowerCase()))];
  if (stiff.length > 0) {
    push(
      "uncontracted",
      `Full forms (${stiff.join(", ")}) sound formal. Contract them unless the stress is deliberate.`,
    );
  }
  for (const sentence of splitSentences(spoken)) {
    if (countWords(sentence) > MAX_SENTENCE_WORDS) {
      push(
        "long-sentence",
        `A ${countWords(sentence)}-word sentence is hard to say in one breath: "${sentence.slice(0, 60)}..."`,
      );
    }
  }
  const lengths = splitSentences(spoken).map(countWords);
  if (lengths.length >= 4 && Math.max(...lengths) - Math.min(...lengths) <= 3) {
    push("even-rhythm", "Every sentence is about the same length. Vary it so the read has shape.");
  }
  const ratio = countWords(spoken) / Math.max(1, countWords(scene.narration));
  if (Math.abs(ratio - 1) > LENGTH_TOLERANCE) {
    push(
      "length-changed",
      `Spoken text is ${Math.round(ratio * 100)}% of the script's length. Scene timing and the cut's duration target will move.`,
    );
  }
  return issues;
}

/**
 * What the spoken text adds that the approved script does not contain. Numbers and names
 * are errors, because either is a claim. Other new content words are listed as a warning:
 * rewording for the ear always introduces a few, and a person must read them.
 */
function additions(scene: SpokenSceneInput, scriptVocabulary: ReadonlySet<string>): LintIssue[] {
  const issues: LintIssue[] = [];
  const sceneNumbers = new Set(numbersIn(scene.narration));
  const newNumbers = [...new Set(numbersIn(scene.spoken))].filter((n) => !sceneNumbers.has(n));
  if (newNumbers.length > 0) {
    issues.push({
      severity: "error",
      rule: "new-number",
      message: `Quantities not in this scene of the script: ${newNumbers.join(", ")}.`,
      sceneId: scene.sceneId,
    });
  }
  const sceneNames = new Set(properNouns(scene.narration));
  const newNames = properNouns(scene.spoken).filter(
    (name) => !sceneNames.has(name) && !scriptVocabulary.has(stem(name)),
  );
  if (newNames.length > 0) {
    issues.push({
      severity: "error",
      rule: "new-name",
      message: `Names or terms not in the script: ${newNames.join(", ")}.`,
      sceneId: scene.sceneId,
    });
  }
  const newWords = [...new Set(tokens(scene.spoken))].filter(
    (word) =>
      word.length >= 4 &&
      !/^\d/.test(word) &&
      !STOP_WORDS.has(word) &&
      !scriptVocabulary.has(stem(word)) &&
      !newNames.includes(word),
  );
  if (newWords.length > 0) {
    issues.push({
      severity: "warning",
      rule: "new-words",
      message: `Words that appear nowhere in the script: ${newWords.join(", ")}. Check that none of them adds a claim.`,
      sceneId: scene.sceneId,
    });
  }
  return issues;
}

/** Every content word of the script, stemmed: narration of all cuts plus the front matter. */
export function scriptVocabulary(script: Script): Set<string> {
  const text = [
    script.title,
    script.hook,
    script.audienceProblem,
    script.coreExplanation,
    script.demonstration,
    script.businessOutcome,
    script.callToAction.label,
    script.callToAction.url,
    ...script.claims.map((claim) => claim.text),
    ...script.cuts.flatMap((cut) => cut.scenes.map((scene) => scene.narration)),
  ].join(" ");
  return new Set(tokens(text).map(stem));
}

/**
 * Lints the spoken wording of every directed scene. The script's own text rules are run
 * by handing the spoken text to the script lint itself, so the two can never drift apart.
 */
export function lintSpoken(
  script: Script,
  direction: VoiceDirection,
  knownFactIds: ReadonlySet<string>,
): LintIssue[] {
  const spokenScript: Script = {
    ...script,
    cuts: script.cuts.map((cut) => ({
      ...cut,
      scenes: cut.scenes.map((scene) => ({
        ...scene,
        narration: direction.scenes[scene.id]?.spoken ?? scene.narration,
      })),
    })),
  };
  const issues: LintIssue[] = lintScript(spokenScript, knownFactIds).filter(
    (issue) =>
      issue.sceneId !== undefined &&
      direction.scenes[issue.sceneId] !== undefined &&
      SCRIPT_TEXT_RULES.has(issue.rule),
  );
  const vocabulary = scriptVocabulary(script);
  for (const cut of script.cuts) {
    for (const scene of cut.scenes) {
      const directed = direction.scenes[scene.id];
      if (!directed) continue;
      const input = { sceneId: scene.id, narration: scene.narration, spoken: directed.spoken };
      issues.push(...additions(input, vocabulary), ...style(input));
    }
  }
  return issues;
}
