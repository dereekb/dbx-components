// File Stucture derived from https://github.com/stschulte/aws-sdk-client-mock-vitest

import 'vitest';
import { expect } from 'vitest';

import type { AllDateMatchers } from './lib/matcher.date';
import { allDateMatchers } from './lib/matcher.date';

expect.extend(allDateMatchers);

/*
 * see https://vitest.dev/guide/extending-matchers.html
 */
declare module 'vitest' {
  interface Matchers<T = any> extends AllDateMatchers {}
}
