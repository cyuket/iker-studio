import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import { errorMessage, StudioError } from "../../domain/errors";
import { openBrowserSession } from "./browser-session";
import { DEFAULT_ACCENT_COLOUR } from "./overlay";
import { TIMEOUTS } from "./pacing";
import { resolveScenarioUrl } from "./urls";

/** Iker's sign-in page (apps/web/app/login in the slot-books repository). */
export const SIGN_IN_PATH = "/login";

/**
 * Pages a person is on while still signing in: the sign-in form, the password and invite
 * screens under /auth, the location picker shown to a business with several locations, and
 * the marketing home page. Anywhere else means the dashboard has accepted the session.
 */
export function isSignedInPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "") return false;
  return !["/login", "/auth/", "/choose-location"].some(
    (prefix) => pathname === prefix.replace(/\/$/, "") || pathname.startsWith(prefix),
  );
}

/** How long a person has to finish signing in. */
const SIGN_IN_WINDOW_MS = 10 * 60 * 1000;
const POLL_MS = 1000;

export interface DemoLoginRequest {
  origin: string;
  /** Browser profile kept between sign-ins so the identity provider remembers the device. */
  profileDir: string;
  sessionFile: string;
  /** Tells the person what to do in the window. */
  announce: (message: string) => void;
}

async function launchVisible(profileDir: string): Promise<BrowserContext> {
  await mkdir(profileDir, { recursive: true, mode: 0o700 });
  const options = { headless: false, viewport: null } as const;
  try {
    // The person's own Chrome build: an ordinary window they can sign in to as usual.
    return await chromium.launchPersistentContext(profileDir, { ...options, channel: "chrome" });
  } catch (error) {
    if (!/chrome|channel|executable/i.test(errorMessage(error))) throw error;
    return chromium.launchPersistentContext(profileDir, options);
  }
}

interface StorageState {
  cookies: { name: string; domain: string }[];
  origins: { origin: string }[];
}

/**
 * Keeps only what belongs to the dashboard itself. The sign-in window also holds the
 * identity provider's cookies (for example a Google account session); those are far more
 * powerful than the demo session and the recorder has no use for them, so they are never
 * written to disk.
 */
export function onlyDashboardState<T extends StorageState>(state: T, origin: string): T {
  const host = new URL(origin).hostname;
  const appliesToHost = (domain: string): boolean => {
    const bare = domain.replace(/^\./, "");
    return host === bare || host.endsWith(`.${bare}`);
  };
  return {
    ...state,
    cookies: state.cookies.filter((cookie) => appliesToHost(cookie.domain)),
    origins: state.origins.filter((entry) => entry.origin === new URL(origin).origin),
  };
}

function signedInPath(page: Page, origin: string): string | null {
  const url = new URL(page.url());
  if (url.origin !== new URL(origin).origin) return null;
  return isSignedInPath(url.pathname) ? url.pathname : null;
}

/**
 * Opens a visible browser for a person to sign in. Nothing is typed, clicked or bypassed
 * on their behalf: the window is theirs until the dashboard has accepted the session (the
 * page has left the sign-in screens), and only then is the session saved, readable by the
 * owner alone.
 */
export async function captureDemoSession(request: DemoLoginRequest): Promise<{ path: string }> {
  const context = await launchVisible(request.profileDir);
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(resolveScenarioUrl(request.origin, SIGN_IN_PATH), {
      timeout: TIMEOUTS.navigationMs,
    });
    request.announce(
      "A browser window is open. Sign in to the demo business (and pick a location if asked). This command finishes by itself when the dashboard opens.",
    );

    const deadline = Date.now() + SIGN_IN_WINDOW_MS;
    while (Date.now() < deadline) {
      if (context.pages().length === 0) {
        throw new StudioError(
          "RECORDING_FAILED",
          "The browser window was closed before sign-in finished.",
        );
      }
      const active = context.pages().at(-1) ?? page;
      const seen = signedInPath(active, request.origin);
      if (seen !== null) {
        await mkdir(path.dirname(request.sessionFile), { recursive: true, mode: 0o700 });
        const state = onlyDashboardState(await context.storageState(), request.origin);
        await writeFile(request.sessionFile, JSON.stringify(state), { mode: 0o600 });
        await chmod(request.sessionFile, 0o600);
        return { path: seen };
      }
      await active.waitForTimeout(POLL_MS);
    }
    throw new StudioError("RECORDING_FAILED", "Sign-in was not completed in time.", {
      hint: "Run `pnpm studio demo-login` again when you are ready.",
    });
  } finally {
    await context.close().catch(() => undefined);
  }
}

export interface DemoSnapshotRequest {
  origin: string;
  path: string;
  sessionFile: string;
  viewport: { width: number; height: number };
  /**
   * Controls to open before reading, by role and exact name ("~" first for part of a name), for content behind a tab or
   * a disclosure. Meant for navigation only: never name a control that changes data.
   */
  open: readonly { role: string; name: string }[];
  /** Where to save a picture of the page; null saves none. */
  screenshotFile: string | null;
}

/**
 * Loads one page of the demo workspace with the saved session and returns its accessibility
 * tree. This is how scenarios are written against what the product really shows, rather
 * than against a guess. Read-only: it navigates and reads, and clicks nothing.
 */
export async function snapshotDemoPage(
  request: DemoSnapshotRequest,
): Promise<{ url: string; tree: string }> {
  const session = await openBrowserSession({
    viewport: request.viewport,
    headless: true,
    accentColour: DEFAULT_ACCENT_COLOUR,
    storageStateFile: request.sessionFile,
  });
  try {
    const { page } = session;
    await page.goto(resolveScenarioUrl(request.origin, request.path), {
      timeout: TIMEOUTS.navigationMs,
    });
    if (!isSignedInPath(new URL(page.url()).pathname)) {
      throw new StudioError("RECORDING_FAILED", "The saved demo session is no longer signed in.", {
        hint: "Run `pnpm studio demo-login` and sign in again.",
      });
    }
    await page
      .waitForLoadState("networkidle", { timeout: TIMEOUTS.navigationMs })
      .catch(() => undefined);
    for (const control of request.open) {
      // A leading "~" matches part of the name, for controls whose name carries a description.
      const partial = control.name.startsWith("~");
      await page
        .getByRole(control.role as Parameters<Page["getByRole"]>[0], {
          name: partial ? control.name.slice(1) : control.name,
          exact: !partial,
        })
        .first()
        .click({ timeout: TIMEOUTS.elementMs });
      await page
        .waitForLoadState("networkidle", { timeout: TIMEOUTS.navigationMs })
        .catch(() => undefined);
    }
    if (request.screenshotFile !== null) {
      await page.screenshot({ path: request.screenshotFile, fullPage: true });
    }
    const tree = await page.locator("body").ariaSnapshot();
    const url = new URL(page.url());
    return { url: `${url.origin}${url.pathname}`, tree };
  } finally {
    await session.close();
  }
}
