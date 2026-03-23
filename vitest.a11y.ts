/**
 * Shared accessibility testing utilities using vitest-axe.
 *
 * Import this in spec files that need to run axe-core a11y checks on rendered Angular components.
 *
 * @example
 * ```typescript
 * import { expectNoA11yViolations } from '../../../vitest.a11y';
 *
 * it('should have no a11y violations', async () => {
 *   fixture.detectChanges();
 *   await expectNoA11yViolations(fixture);
 * });
 * ```
 */
import { type ComponentFixture } from '@angular/core/testing';
import * as matchers from 'vitest-axe/matchers';
import { axe } from 'vitest-axe';
import type AxeCore from 'axe-core';

expect.extend(matchers);

/**
 * Runs axe-core on a rendered Angular component fixture and asserts zero a11y violations.
 *
 * @param fixture - Angular component fixture to test.
 * @param options - Optional axe-core run options to customize the check.
 */
export async function expectNoA11yViolations<T>(fixture: ComponentFixture<T>, options?: AxeCore.RunOptions): Promise<void> {
  const results = await axe(fixture.nativeElement, options);
  expect(results).toHaveNoViolations();
}

/**
 * Runs axe-core on a rendered Angular component fixture and returns the results without asserting.
 *
 * Useful when you need to inspect violations or filter results before asserting.
 *
 * @param fixture - Angular component fixture to check.
 * @param options - Optional axe-core run options.
 * @returns The axe-core results object.
 */
export async function getA11yResults<T>(fixture: ComponentFixture<T>, options?: AxeCore.RunOptions): Promise<AxeCore.AxeResults> {
  return axe(fixture.nativeElement, options);
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Assertion extends matchers.AxeMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface AsymmetricMatchersContaining extends matchers.AxeMatchers {}
}
