import { AllDateMatchers } from './packages/vitest/src/lib/matcher.date';
import { AxeMatchers } from './packages/vitest/src/lib/matcher.a11y';

declare module 'vitest' {
  interface Matchers<T = any> extends AllDateMatchers {}
  interface Assertion extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
