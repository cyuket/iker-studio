import { chromium, type Page } from "playwright";
import { errorMessage, StudioError } from "../../domain/errors";
import type { Scenario } from "../../domain/recording";
import { installOverlay } from "./overlay";
import { CAPTURE } from "./pacing";

export interface BrowserSession {
  page: Page;
  close(): Promise<void>;
}

export interface BrowserSessionOptions {
  viewport: Scenario["viewport"];
  headless: boolean;
  accentColour: string;
  /** Saved session to start from; null starts with nothing. */
  storageStateFile: string | null;
}

async function launch(headless: boolean) {
  try {
    return await chromium.launch({ headless });
  } catch (error) {
    if (!errorMessage(error).includes("Executable doesn't exist")) throw error;
    throw new StudioError(
      "DEPENDENCY_MISSING",
      "The Chromium browser used for recording is not installed.",
      {
        hint: "Run: pnpm playwright:install",
      },
    );
  }
}

/**
 * Opens a browser with a new context. Without a saved session nothing is loaded from disk.
 * With one, the context starts signed in, and still writes nothing back: cookies set during
 * the take are discarded when the browser closes.
 */
export async function openBrowserSession(options: BrowserSessionOptions): Promise<BrowserSession> {
  const browser = await launch(options.headless);
  try {
    const context = await browser.newContext({
      viewport: options.viewport,
      deviceScaleFactor: CAPTURE.deviceScaleFactor,
      // Fixed so dates and number formats render the same on every machine.
      locale: "en-GB",
      timezoneId: "UTC",
      colorScheme: "light",
      ...(options.storageStateFile === null ? {} : { storageState: options.storageStateFile }),
    });
    await installOverlay(context, options.accentColour);
    const page = await context.newPage();
    return { page, close: () => browser.close() };
  } catch (error) {
    await browser.close();
    throw error;
  }
}
