import type { Page } from "playwright";
import { StudioError } from "../../domain/errors";
import { TIMEOUTS } from "./pacing";
import { resolveScenarioUrl } from "./urls";

export interface DemoCredentials {
  username: string;
  password: string;
}

const SIGN_IN_PATH = "/login";

type SignInOutcome = "signed-in" | "two-factor" | "unresolved";

/** The sign-in form and the password screens under /auth. */
export const isOnSignInScreen = (pathname: string): boolean =>
  pathname === SIGN_IN_PATH || pathname.startsWith("/auth/");

/** Resolves with the tag when the wait succeeds and with "unresolved" when it does not. */
const outcomeOf = (wait: Promise<unknown>, tag: SignInOutcome): Promise<SignInOutcome> =>
  wait.then(
    () => tag,
    () => "unresolved" as const,
  );

/** Whichever happens first after submitting: the app lets us in, or it asks for a second factor. */
async function waitForOutcome(page: Page): Promise<SignInOutcome> {
  const leftSignIn = page.waitForURL((url) => !isOnSignInScreen(url.pathname), {
    timeout: TIMEOUTS.signInMs,
  });
  const secondFactor = page
    .getByRole("heading", { name: "Two-factor authentication" })
    .waitFor({ state: "visible", timeout: TIMEOUTS.signInMs });
  return Promise.race([outcomeOf(leftSignIn, "signed-in"), outcomeOf(secondFactor, "two-factor")]);
}

/**
 * Signs the demo account in through Iker's login page (apps/web/app/login/login-form.tsx in
 * the slot-books repository). The page opens on the magic-link form, so the recorder
 * switches to the password form first. This always runs before
 * the capture starts, so neither the email nor the password is ever in a recorded frame.
 * Nothing here puts a credential into an error message.
 */
export async function signIn(
  page: Page,
  origin: string,
  credentials: DemoCredentials,
): Promise<void> {
  await page.goto(resolveScenarioUrl(origin, SIGN_IN_PATH), { timeout: TIMEOUTS.navigationMs });
  await page.getByRole("button", { name: "Use a password instead", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(credentials.username);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();

  const outcome = await waitForOutcome(page);
  if (outcome === "signed-in") return;
  if (outcome === "two-factor") {
    throw new StudioError(
      "RECORDING_FAILED",
      "The demo account asks for two-factor authentication.",
      {
        hint: "Record with a demo account that has two-factor authentication turned off. The recorder never attempts to pass a second factor.",
      },
    );
  }
  throw new StudioError(
    "RECORDING_FAILED",
    "Sign-in did not complete: the page stayed on the sign-in screen.",
    {
      hint: "Check the demo account's email and password, and that the account can reach the dashboard.",
    },
  );
}
