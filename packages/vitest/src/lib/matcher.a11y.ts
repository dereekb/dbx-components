import { expect } from 'vitest';
import * as matchers from 'vitest-axe/matchers.js';
import { axe } from 'vitest-axe';
import type AxeCore from 'axe-core';

export type { AxeMatchers } from 'vitest-axe/matchers.js';

/**
 * Object or wrapper that exposes a native DOM element, such as Angular's `ComponentFixture`.
 */
export interface NativeElementRef {
  readonly nativeElement: Element;
}

/**
 * Input accepted by a11y helpers: a raw DOM element or any object exposing `nativeElement`.
 */
export type A11yTestTarget = Element | NativeElementRef;

function resolveElement(target: A11yTestTarget): Element {
  return 'nativeElement' in target ? target.nativeElement : target;
}

/**
 * All vitest-axe matchers, ready to register via `expect.extend()`.
 *
 * @example
 * ```typescript
 * import { allA11yMatchers } from '@dereekb/vitest';
 * expect.extend(allA11yMatchers);
 *
 * const results = await axe(document.body);
 * expect(results).toHaveNoViolations();
 * ```
 */
export const allA11yMatchers = matchers;

/**
 * Runs axe-core on a target element and asserts zero accessibility violations.
 *
 * Accepts a raw DOM `Element` or any object with a `nativeElement` property (e.g. Angular `ComponentFixture`).
 *
 * @param target - Element or fixture to test.
 * @param options - Optional axe-core run options.
 *
 * @example
 * ```typescript
 * // With Angular ComponentFixture
 * await expectNoA11yViolations(fixture);
 *
 * // With raw element
 * await expectNoA11yViolations(document.getElementById('app')!);
 * ```
 */
export async function expectNoA11yViolations(target: A11yTestTarget, options?: AxeCore.RunOptions): Promise<void> {
  const results = await axe(resolveElement(target), options);
  expect(results).toHaveNoViolations();
}

/**
 * Runs axe-core on a target element and returns the results without asserting.
 *
 * Useful when you need to inspect violations or filter results before asserting.
 *
 * @param target - Element or fixture to check.
 * @param options - Optional axe-core run options.
 * @returns The axe-core results object.
 *
 * @example
 * ```typescript
 * const results = await getA11yResults(fixture);
 * const critical = results.violations.filter(v => v.impact === 'critical');
 * expect(critical).toHaveLength(0);
 * ```
 */
export async function getA11yResults(target: A11yTestTarget, options?: AxeCore.RunOptions): Promise<AxeCore.AxeResults> {
  return axe(resolveElement(target), options);
}
