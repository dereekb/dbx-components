import type { FieldWithValidation } from '@ng-forge/dynamic-forms';

/**
 * Includes the validators and validation messages set on a FieldWithValidation.
 */
export type ForgeFieldValidation = Pick<FieldWithValidation, 'validators' | 'validationMessages'>;
