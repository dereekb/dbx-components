/**
 * Extend entry point for date matchers.
 *
 * A11y matchers (vitest-axe) are registered separately via `@dereekb/vitest/a11y`
 * because `vitest-axe` and `axe-core` are optional peer dependencies.
 *
 * @see {@link file://./a11y.ts} for the a11y extend entry point.
 */
// File structure derived from https://github.com/stschulte/aws-sdk-client-mock-vitest

import 'vitest';
import { expect } from 'vitest';

import type { AllDateMatchers } from './lib/matcher.date.js';
import { allDateMatchers } from './lib/matcher.date.js';

expect.extend(allDateMatchers);

/*
 * see https://vitest.dev/guide/extending-matchers.html
 */
declare module 'vitest' {
  interface Matchers<T = any> extends AllDateMatchers {}
}
