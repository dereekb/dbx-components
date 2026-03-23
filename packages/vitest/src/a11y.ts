/**
 * Extend entry point for vitest-axe a11y matchers.
 *
 * This is a separate entry point from `./extend` (which registers date matchers)
 * because `vitest-axe` and `axe-core` are optional peer dependencies. Keeping them
 * in a dedicated entry point means consumers who only need date matchers don't
 * require the a11y packages to be installed.
 *
 * @example
 * ```typescript
 * // In a vitest setup file or spec:
 * import '@dereekb/vitest/a11y';
 *
 * const results = await axe(element);
 * expect(results).toHaveNoViolations();
 * ```
 */
import 'vitest';
import { expect } from 'vitest';

import type { AxeMatchers } from './lib/matcher.a11y.js';
import { allA11yMatchers } from './lib/matcher.a11y.js';

expect.extend(allA11yMatchers);

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Assertion extends AxeMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
