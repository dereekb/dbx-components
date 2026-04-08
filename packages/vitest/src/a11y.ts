/**
 * Extend entry point for vitest-axe a11y matchers.
 *
 * This is a separate entry point from `./extend` (which registers date matchers)
 * because `vitest-axe` and `axe-core` are optional peer dependencies. Keeping them
 * in a dedicated entry point means consumers who only need date matchers don't
 * require the a11y packages to be installed.
 *
 * The `declare module 'vitest'` augmentation ships with the npm package so downstream
 * consumers get types automatically. Within this workspace, `vitest.setup.typings.ts`
 * also declares the same augmentation so the IDE resolves types from `tsconfig.spec.json`.
 *
 * @example
 * ```typescript
 * // In a vitest setup file (e.g. vitest.setup.angular.ts):
 * import '@dereekb/vitest/a11y';
 *
 * const results = await axe(element);
 * expect(results).toHaveNoViolations();
 * ```
 */
import { expect } from 'vitest';

import { type AxeMatchers, allA11yMatchers } from './lib/matcher.a11y.js';

expect.extend(allA11yMatchers);

declare module 'vitest' {
  interface Assertion extends AxeMatchers {}

  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
