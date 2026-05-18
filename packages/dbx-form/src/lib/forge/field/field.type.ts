import type { FieldWithValidation } from '@ng-forge/dynamic-forms';

/**
 * Includes the validators and validation messages set on a FieldWithValidation.
 */
export type DbxForgeFieldValidation = Pick<FieldWithValidation, 'validators' | 'validationMessages'>;

// COMPAT: Deprecated aliases
/**
 * @deprecated Use {@link DbxForgeFieldValidation} instead.
 */
export type ForgeFieldValidation = DbxForgeFieldValidation;
