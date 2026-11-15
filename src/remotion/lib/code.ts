export type CodeTokenKind = "plain" | "keyword" | "string" | "number" | "comment" | "punctuation";

export interface CodeToken {
  text: string;
  kind: CodeTokenKind;
}

const KEYWORDS = new Set([
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "def",
  "default",
  "else",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "from",
  "func",
  "function",
  "if",
  "import",
  "in",
  "interface",
  "let",
  "new",
  "nil",
  "none",
  "null",
  "of",
  "package",
  "return",
  "static",
  "struct",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "type",
  "undefined",
  "var",
  "while",
  "curl",
]);

const PATTERN =
  /(\/\/.*$|#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d[\d_.]*\b)|([A-Za-z_$][\w$]*)|([{}()[\];,.:=<>+\-*/!&|?]+)/g;

/**
 * A deliberately small, language-agnostic tokenizer: enough to tint strings, numbers,
 * comments and common keywords so a snippet reads as code. It is not a parser and never
 * changes the text, only how spans are coloured.
 */
export function tokenizeLine(line: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let cursor = 0;
  for (const match of line.matchAll(PATTERN)) {
    const index = match.index;
    if (index > cursor) tokens.push({ text: line.slice(cursor, index), kind: "plain" });
    const [text, comment, string, number, word, punctuation] = match;
    let kind: CodeTokenKind = "plain";
    if (comment !== undefined) kind = "comment";
    else if (string !== undefined) kind = "string";
    else if (number !== undefined) kind = "number";
    else if (word !== undefined) kind = KEYWORDS.has(word.toLowerCase()) ? "keyword" : "plain";
    else if (punctuation !== undefined) kind = "punctuation";
    tokens.push({ text, kind });
    cursor = index + text.length;
  }
  if (cursor < line.length) tokens.push({ text: line.slice(cursor), kind: "plain" });
  return tokens;
}

/** JetBrains Mono advances 0.6em per glyph, so the fit can be computed exactly. */
const MONO_ADVANCE = 0.6;

/** Largest code size at which every line fits the panel without wrapping or clipping. */
export function fitCodeSize(
  lines: readonly string[],
  width: number,
  height: number,
  preferred: number,
  minimum: number,
  lineHeight: number,
): number {
  const longest = Math.max(1, ...lines.map((line) => line.length));
  const byWidth = width / (longest * MONO_ADVANCE);
  const byHeight = height / (Math.max(1, lines.length) * lineHeight);
  return Math.max(minimum, Math.min(preferred, byWidth, byHeight));
}
