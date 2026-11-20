import type { FieldWithValidation } from '@ng-forge/dynamic-forms';

/**
 * Includes the validators and validation messages set on a FieldWithValidation.
 *
 * An undefined value means the field has no validators/messages set. Passing undefined to `setValidation()` clears that value.
 */
export interface DbxForgeFieldValidation {
  readonly validators?: FieldWithValidation['validators'] | undefined;
  readonly validationMessages?: FieldWithValidation['validationMessages'] | undefined;
}
