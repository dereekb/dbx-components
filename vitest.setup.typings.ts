import { AllDateMatchers } from '@dereekb/vitest';
import { AxeMatchers } from '@dereekb/vitest';

declare module 'vitest' {
  interface Matchers<T = any> extends AllDateMatchers {}
  interface Assertion extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
