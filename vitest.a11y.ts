/**
 * Re-exports accessibility testing utilities from `@dereekb/vitest/a11y`.
 *
 * Import from `@dereekb/vitest` directly in spec files, or use this file for
 * relative imports from shared setup files.
 */
export { expectNoA11yViolations, getA11yResults } from '@dereekb/vitest';
import '@dereekb/vitest/a11y';
