import { spawn } from "node:child_process";
import { StudioError } from "../../domain/errors";

export interface ProcessResult {
  stdout: string;
  stderr: string;
}

/**
 * Runs a program with an argument array. No shell is involved, so file names and text
 * taken from scripts or scenarios can never be interpreted as shell syntax.
 */
export function run(
  command: string,
  args: readonly string[],
  input?: string,
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error: NodeJS.ErrnoException) => {
      reject(
        error.code === "ENOENT"
          ? new StudioError("DEPENDENCY_MISSING", `${command} is not installed or not on PATH.`, {
              hint: "Run `pnpm studio doctor` for installation instructions.",
            })
          : error,
      );
    });
    child.on("close", (code) => {
      const result = {
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      };
      if (code === 0) {
        resolve(result);
        return;
      }
      const tail = result.stderr.trim().split("\n").slice(-6).join("\n");
      reject(new StudioError("EXTERNAL_SERVICE", `${command} exited with code ${code}:\n${tail}`));
    });
    child.stdin.end(input);
  });
}
