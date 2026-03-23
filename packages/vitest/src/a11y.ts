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
