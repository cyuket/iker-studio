import type { Page } from "playwright";
import type { Logger } from "../../application/ports";
import { errorMessage } from "../../domain/errors";
import type { Target } from "../../domain/recording";
import { resolveTarget } from "./locators";
import { MASK_ATTRIBUTE, MASK_SWEEP_FUNCTION } from "./overlay";

export interface MaskRegistry {
  /** Blurs everything matching these targets from now until the recording ends. */
  add(targets: readonly Target[]): Promise<void>;
  /** Blurs anything that has started matching since the last sweep. Never rejects. */
  reapply(): Promise<void>;
}

/**
 * Keeps sensitive elements blurred for the whole recording. A mask outlives the document it
 * was declared on, so every sweep re-resolves the targets: after a navigation, and whenever
 * the page reports that it has added content.
 */
export async function createMaskRegistry(page: Page, logger: Logger): Promise<MaskRegistry> {
  const targets: Target[] = [];

  const sweep = async (): Promise<void> => {
    if (targets.length === 0) return;
    for (const target of targets) {
      await resolveTarget(page, target).evaluateAll((elements, attribute) => {
        for (const element of elements) element.setAttribute(attribute, "");
      }, MASK_ATTRIBUTE);
    }
    await page.evaluate(() => window.__studioOverlay?.watchForMaskTargets());
  };

  const reapply = (): Promise<void> =>
    sweep().catch((error: unknown) => {
      // A sweep that races a navigation loses its document; the next document's own
      // load event triggers another sweep, so there is nothing to recover here.
      logger.debug("Mask sweep skipped", { reason: errorMessage(error).split("\n")[0] });
    });

  await page.exposeFunction(MASK_SWEEP_FUNCTION, reapply);
  page.on("domcontentloaded", () => void reapply());
  page.on("load", () => void reapply());

  return {
    add: async (added) => {
      targets.push(...added);
      await sweep();
    },
    reapply,
  };
}
