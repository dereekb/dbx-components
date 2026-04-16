import type { BaseValueField } from '@ng-forge/dynamic-forms';
import type { MatInputField, MatInputProps } from '@ng-forge/dynamic-forms-material';
import { DOLLAR_AMOUNT_PRECISION, type TransformNumberFunctionConfigRef } from '@dereekb/util';
import { dbxForgeBuildFieldDef, DbxForgeFieldFunction, dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, DbxForgeFieldFunctionDef } from '../../field';
import { configureForgeAutocompleteFieldMeta } from '../../field.util.meta';
import { FieldAutocompleteAttributeOptionRef } from '../../../../field/field.autocomplete';

// MARK: Number Field
/**
 * Validation error kind used by the `enforceStep` divisibility validator.
 */
export const FORGE_IS_DIVISIBLE_BY_VALIDATION_KEY = 'isDivisibleBy';

/**
 * Numeric constraint configuration for forge number fields.
 */
export interface DbxForgeNumberFieldNumberConfig {
  readonly min?: number;
  readonly max?: number;
  /**
   * Step increment for the input.
   */
  readonly step?: number;
  /**
   * When true, validates that the value is divisible by `step`.
   * Requires `step` to be set.
   */
  readonly enforceStep?: boolean;
}

/**
 * We use this for DbxForgeNumberFieldConfig since MatInputField is a union type for both string and number input.
 */
type DbxForgeNumberFieldDef = BaseValueField<Omit<MatInputProps, 'type'> & { type?: 'number' }, number> & { type: 'input' };

/**
 * Full configuration for a numeric input field in forge.
 *
 * Combines labeling, numeric constraints (min/max/step), and number transformation.
 */
export interface DbxForgeNumberFieldConfig extends DbxForgeFieldFunctionDef<DbxForgeNumberFieldDef>, FieldAutocompleteAttributeOptionRef, DbxForgeNumberFieldNumberConfig, Partial<TransformNumberFunctionConfigRef> {}

/**
 * Creates a forge field definition for a numeric input.
 *
 * When `step` is provided, sets the HTML `step` attribute on the input via `meta`.
 * When both `step` and `enforceStep` are set, adds a custom divisibility validator.
 *
 * @param config - Number field configuration
 * @returns A validated {@link MatInputField} with input type `'number'`
 *
 * @example
 * ```typescript
 * const field = forgeNumberField({ key: 'quantity', label: 'Quantity', min: 1, max: 100, step: 1 });
 * ```
 */
export const forgeNumberField = dbxForgeFieldFunction<DbxForgeNumberFieldConfig>({
  type: 'input' as const,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder(() => {
    return {
      type: 'number' as const // set props type to number always
    };
  }),
  buildFieldDef: dbxForgeBuildFieldDef((x, config) => {
    const { step, enforceStep } = config;

    // configure autocomplete
    x.configure(configureForgeAutocompleteFieldMeta);

    // Apply the HTML step attribute to the <input> element via meta, merged with autocomplete
    if (step != null) {
      x.addMeta({ step });
    }

    // Add a divisibility validator when enforceStep is enabled
    if (step && enforceStep) {
      x.addValidation({
        validators: [
          {
            type: 'custom',
            expression: `fieldValue == null || fieldValue % ${step} === 0`,
            kind: FORGE_IS_DIVISIBLE_BY_VALIDATION_KEY
          }
        ],
        validationMessages: {
          [FORGE_IS_DIVISIBLE_BY_VALIDATION_KEY]: `Number must be divisible by ${step}.`
        }
      });
    }
  })
}) as DbxForgeFieldFunction<DbxForgeNumberFieldConfig, MatInputField>;

// MARK: Dollar Amount Field
/**
 * Configuration for a forge dollar amount field, which enforces cent-level precision.
 */
export type DbxForgeDollarAmountFieldConfig = Omit<DbxForgeNumberFieldConfig, 'roundToStep' | 'precision'>;

/**
 * Creates a forge number field pre-configured for dollar amount input with cent-level precision.
 *
 * @param config - Number field configuration (precision is overridden to dollar amount precision)
 * @returns A {@link MatInputField} for dollar amount input
 *
 * @example
 * ```typescript
 * const field = forgeDollarAmountField({ key: 'price', label: 'Price', min: 0, required: true });
 * ```
 */
export function forgeDollarAmountField(config: DbxForgeDollarAmountFieldConfig) {
  return forgeNumberField({
    ...config,
    transform: {
      ...config.transform,
      precision: config.transform?.precision ?? DOLLAR_AMOUNT_PRECISION
    }
  });
}
