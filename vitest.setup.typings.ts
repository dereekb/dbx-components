import { AllDateMatchers } from './packages/vitest/src/lib/matcher.date';

declare module 'vitest' {
  interface Matchers<T = any> extends AllDateMatchers {}
}
