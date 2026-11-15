import type { Target } from "../../domain/recording";

/**
 * The part of a Playwright page or locator that turns a target into a locator. Declared
 * here so the mapping can be tested without a browser.
 */
export interface LocatorSource<L> {
  getByRole(role: string, options: { name: string; exact: boolean }): L;
  getByLabel(text: string, options: { exact: boolean }): L;
  getByTestId(testId: string): L;
  getByText(text: string, options: { exact: boolean }): L;
  getByPlaceholder(text: string): L;
}

/** A located element can be searched inside and can be narrowed to one match. */
export interface ScopedLocator<L> extends LocatorSource<L> {
  nth(index: number): L;
}

function locate<L>(source: LocatorSource<L>, target: Target): L {
  if ("role" in target)
    return source.getByRole(target.role, { name: target.name, exact: target.exact });
  if ("label" in target) return source.getByLabel(target.label, { exact: target.exact });
  if ("testId" in target) return source.getByTestId(target.testId);
  if ("text" in target) return source.getByText(target.text, { exact: target.exact });
  return source.getByPlaceholder(target.placeholder);
}

/**
 * Scenarios describe elements the way a person would ("the Publish changes button"), and
 * this is the only place that description becomes a browser query. The result is left
 * strict on purpose: a target that matches two elements fails instead of acting on a guess,
 * unless the scenario says which one it means with `within` or `nth`.
 */
export function resolveTarget<L extends ScopedLocator<L>>(
  source: LocatorSource<L>,
  target: Target,
): L {
  const scope: LocatorSource<L> = target.within
    ? source.getByRole(target.within.role, { name: target.within.name, exact: target.within.exact })
    : source;
  const located = locate(scope, target);
  return target.nth === undefined ? located : located.nth(target.nth);
}
