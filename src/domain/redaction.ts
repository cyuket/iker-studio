const REDACTED = "[redacted]";

/** Shapes that are secrets regardless of where they came from. */
const SECRET_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: "elevenlabs-api-key", pattern: /\bsk_[a-f0-9]{32,}\b/g },
  { name: "bearer-token", pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/g },
  { name: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  { name: "aws-access-key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g },
  { name: "google-oauth-secret", pattern: /\bGOCSPX-[A-Za-z0-9_-]{20,}\b/g },
  { name: "private-key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
];

export interface SecretFinding {
  name: string;
  /** Position only: the matched value is never returned. */
  index: number;
}

export function findSecretPatterns(text: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  for (const { name, pattern } of SECRET_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      findings.push({ name, index: match.index });
    }
  }
  return findings;
}

/**
 * Builds a redactor that removes both known secret shapes and the exact values of the
 * secrets this process holds, so a value never reaches a log line or an error report.
 */
export function createRedactor(secretValues: readonly string[]): (text: string) => string {
  // Short values would redact ordinary words, and are too weak to be real secrets anyway.
  const values = [...new Set(secretValues.filter((v) => v.length >= 6))].sort(
    (a, b) => b.length - a.length,
  );
  return (text) => {
    let out = text;
    for (const value of values) out = out.split(value).join(REDACTED);
    for (const { pattern } of SECRET_PATTERNS) out = out.replace(pattern, REDACTED);
    return out;
  };
}

const PERSONAL_DATA_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: "email", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { name: "card-number", pattern: /\b(?:\d[ -]?){13,19}\b/g },
];

/** Domains reserved for documentation and testing (RFC 2606 / RFC 6761). */
const SYNTHETIC_EMAIL_DOMAINS =
  /@(?:[a-z0-9-]+\.)*(?:example\.(?:com|org|net)|[a-z0-9-]+\.(?:test|example|invalid))$/i;

export interface PersonalDataFinding {
  name: string;
  /** Masked excerpt safe to show in a report. */
  excerpt: string;
}

/** Flags personal data that is not obviously synthetic. Heuristic: a human still reviews. */
export function findPersonalData(text: string): PersonalDataFinding[] {
  const findings: PersonalDataFinding[] = [];
  for (const { name, pattern } of PERSONAL_DATA_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const value = match[0];
      if (name === "email" && SYNTHETIC_EMAIL_DOMAINS.test(value)) continue;
      if (name === "card-number" && !passesLuhn(value)) continue;
      findings.push({ name, excerpt: maskMiddle(value) });
    }
  }
  return findings;
}

function maskMiddle(value: string): string {
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}${"*".repeat(Math.max(3, value.length - 4))}${value.slice(-2)}`;
}

function passesLuhn(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, "");
  if (digits.length < 13) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}
