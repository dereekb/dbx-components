import { computed, inject, type Signal } from '@angular/core';
import { FORM_OPTIONS } from '@ng-forge/dynamic-forms';

/**
 * Creates a computed signal that reads the disabled state from ng-forge's form-level options.
 *
 * Injects the `FORM_OPTIONS` token provided by ng-forge's `DynamicForm` component and reads
 * `formOptions.disabled`. This is the correct way to check form-level disabled state in
 * custom field components, since `FormOptions.disabled` does not propagate to individual
 * `FieldState.disabled()` signals.
 *
 * Must be called in an injection context (constructor, field initializer, or inject()-capable context).
 *
 * @returns A computed signal that is `true` when the form is disabled
 *
 * @example
 * ```typescript
 * readonly isDisabled = forgeFieldDisabled();
 * ```
 */
export function forgeFieldDisabled(): Signal<boolean> {
  const formOptions = inject(FORM_OPTIONS, { optional: true });

  return computed(() => {
    try {
      return formOptions?.()?.disabled ?? false;
    } catch {
      return false;
    }
  });
}
