import { AllDateMatchers } from '@dereekb/vitest';

declare module 'vitest' {
  interface Matchers<T = any> extends AllDateMatchers { }
}
