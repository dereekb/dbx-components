import type { BaseFieldConfig, DescriptionFieldConfig, DisableAutocompleteForField } from '../../field';
import type { LogicConfig, StateLogicConfig } from '@ng-forge/dynamic-forms';

export type { LogicConfig, StateLogicConfig };

/**
 * Base configuration for a forge field, extending BaseFieldConfig with logic support.
 *
 * All forge field config interfaces should extend this (or {@link DbxForgeLabeledFieldConfig})
 * to inherit `key`, `required`, `readonly`, and `logic`.
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

/**
 * Configuration for a labeled forge field with label, placeholder, description, and autocomplete.
 *
 * Extends {@link DbxForgeFieldConfig} with common UI properties used by most value fields.
 */
export interface DbxForgeLabeledFieldConfig extends DbxForgeFieldConfig, DescriptionFieldConfig {
  /**
   * Field label displayed in the form.
   */
  readonly label?: string;
  /**
   * Placeholder text displayed when the field is empty.
   */
  readonly placeholder?: string;
  /**
   * Sets the autocomplete attribute. Pass `false` to disable browser autofill.
   */
  readonly autocomplete?: string | DisableAutocompleteForField;
}
