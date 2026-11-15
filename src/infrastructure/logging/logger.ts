import type { LogFields, Logger } from "../../application/ports";

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LoggerOptions {
  level: Level;
  format: "pretty" | "json";
  /** Applied to every line before it is written, so secrets cannot reach the log. */
  redact: (text: string) => string;
  write?: (line: string) => void;
  now?: () => Date;
}

/**
 * Structured logger. Logs go to stderr so stdout stays clean for command output and
 * `--json` results that other tools parse.
 */
export function createLogger(options: LoggerOptions, bound: LogFields = {}): Logger {
  const write = options.write ?? ((line: string) => void process.stderr.write(`${line}\n`));
  const now = options.now ?? (() => new Date());

  const emit = (level: Level, message: string, fields: LogFields = {}): void => {
    if (ORDER[level] < ORDER[options.level]) return;
    const merged = { ...bound, ...fields };
    const line =
      options.format === "json"
        ? JSON.stringify({ time: now().toISOString(), level, message, ...merged }, replaceErrors)
        : pretty(level, message, merged);
    write(options.redact(line));
  };

  return {
    debug: (message, fields) => emit("debug", message, fields),
    info: (message, fields) => emit("info", message, fields),
    warn: (message, fields) => emit("warn", message, fields),
    error: (message, fields) => emit("error", message, fields),
    child: (fields) => createLogger(options, { ...bound, ...fields }),
  };
}

function replaceErrors(_key: string, value: unknown): unknown {
  return value instanceof Error ? { name: value.name, message: value.message } : value;
}

function pretty(level: Level, message: string, fields: LogFields): string {
  const tail = Object.entries(fields)
    .map(
      ([key, value]) =>
        `${key}=${typeof value === "string" ? value : JSON.stringify(value, replaceErrors)}`,
    )
    .join(" ");
  const label = level === "info" ? "" : `${level.toUpperCase()} `;
  return tail ? `${label}${message}  ${tail}` : `${label}${message}`;
}
