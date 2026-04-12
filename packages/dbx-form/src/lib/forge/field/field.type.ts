import type { BaseFieldConfig } from '../../field';
import type { FieldWithValidation, LogicConfig } from '@ng-forge/dynamic-forms';

/**
 * Includes the validators and validation messages set on a FieldWithValidation.
 */
export type ForgeFieldValidation = Pick<FieldWithValidation, 'validators' | 'validationMessages'>;

/**
 * Base configuration for a forge field, extending BaseFieldConfig with logic support.
 *
 * All forge field config interfaces should extend this (or {@link DbxForgeLabeledFieldConfig})
 * to inherit `key`, `required`, `readonly`, and `logic`.
 *
 * @deprecated remove; don't use this anymore.
 */
export interface DbxForgeFieldConfig extends BaseFieldConfig {
  /**
   * Logic configurations for conditional field state (hidden, readonly, disabled, required)
   * and value derivation.
   *
   * Uses ng-forge's `LogicConfig` which supports `StateLogicConfig` (conditional state changes)
   * and `DerivationLogicConfig` (computed values).
   *
   * @example
   * ```typescript
   * logic: [{
   *   type: 'hidden',
   *   condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: false }
   * }]
   * ```
   */
  readonly logic?: LogicConfig[];
}
