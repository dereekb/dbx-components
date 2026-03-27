import type { AllDateMatchers } from './lib/matcher.date.js';
import type { AxeMatchers } from './lib/matcher.a11y.js';

declare module 'vitest' {
  interface Matchers<T = any> extends AllDateMatchers {}
  interface Assertion extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
