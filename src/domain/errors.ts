export type StudioErrorCode =
  | "CONFIG_INVALID"
  | "DEPENDENCY_MISSING"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "APPROVAL_REQUIRED"
  | "STAGE_BLOCKED"
  | "EXTERNAL_SERVICE"
  | "RECORDING_FAILED"
  | "RENDER_FAILED"
  | "UNSAFE_TARGET"
  | "PUBLISHING_DISABLED";

/**
 * An error the operator can act on. `hint` says what to do next; neither field may
 * contain secret values because both are printed and logged.
 */
export class StudioError extends Error {
  readonly code: StudioErrorCode;
  readonly hint: string | undefined;

  constructor(
    code: StudioErrorCode,
    message: string,
    options?: { hint?: string; cause?: unknown },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "StudioError";
    this.code = code;
    this.hint = options?.hint;
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
