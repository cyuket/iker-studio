/**
 * Command output. Results go to stdout; logs go to stderr (see the logger), so a caller
 * can pipe `--json` output straight into another tool.
 */
export interface Output {
  json: boolean;
  /** Prints a human-readable line; silent in JSON mode. */
  line(text?: string): void;
  /** Prints the command's result object in JSON mode; silent otherwise. */
  result(value: unknown): void;
  table(headers: readonly string[], rows: readonly (readonly string[])[]): void;
}

export function createOutput(
  json: boolean,
  write: (text: string) => void = (text) => void process.stdout.write(text),
): Output {
  const line = (text = ""): void => {
    if (!json) write(`${text}\n`);
  };
  return {
    json,
    line,
    result(value) {
      if (json) write(`${JSON.stringify(value, null, 2)}\n`);
    },
    table(headers, rows) {
      if (json) return;
      const widths = headers.map((header, i) =>
        Math.max(header.length, ...rows.map((row) => (row[i] ?? "").length)),
      );
      const format = (cells: readonly string[]): string =>
        cells
          .map((cell, i) => cell.padEnd(widths[i] ?? 0))
          .join("  ")
          .trimEnd();
      line(format(headers));
      line(widths.map((width) => "-".repeat(width)).join("  "));
      for (const row of rows) line(format(row));
    },
  };
}

export function megabytes(bytes: number): string {
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

export function seconds(value: number): string {
  const whole = Math.round(value);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
