import type { BaseValueField } from '@ng-forge/dynamic-forms';
import type { MatInputField, MatInputProps } from '@ng-forge/dynamic-forms-material';
import { transformStringFunction, type TransformStringFunctionConfig, type TransformStringFunctionConfigRef } from '@dereekb/util';
import type { FieldAutocompleteAttributeOptionRef } from '../../../../field/field.autocomplete';
import { dbxForgeFieldFunction, dbxForgeBuildFieldDef, dbxForgeFieldFunctionConfigPropsWithHintBuilder, type DbxForgeFieldFunctionDef, type DbxForgeFieldFunction } from '../../field';
import { configureForgeAutocompleteFieldMeta } from '../../field.util.meta';
import { dbxForgePatternValidator } from '../../field.util.validation';

// MARK: Text Field
/**
 * Configuration for minimum and maximum text length constraints.
 */
export interface DbxForgeTextFieldLengthConfig {
  readonly minLength?: number;
  readonly maxLength?: number;
}

/**
 * Configuration for regex pattern validation on a text field.
 */
export interface DbxForgeTextFieldPatternConfig {
  readonly pattern?: string | RegExp;
}

/**
 * We use this for DbxForgeNumberFieldConfig since MatInputField is a union type for both string and number input.
 */
type DbxForgeTextFieldDef = BaseValueField<Omit<MatInputProps, 'type'> & { type?: DbxForgeTextFieldInputType }, string> & { type: 'input' };

/**
 * HTML input type for a text field.
 */
export type DbxForgeTextFieldInputType = 'text' | 'password' | 'email';

/**
 * Full configuration for a single-line text input field in forge.
 *
 * Combines labeling, validation (pattern, length), and string transformation
 * into one config object.
 */
export interface DbxForgeTextFieldConfig extends DbxForgeFieldFunctionDef<DbxForgeTextFieldDef>, FieldAutocompleteAttributeOptionRef, Partial<TransformStringFunctionConfigRef> {
  /**
   * HTML input type. Defaults to `'text'`.
   */
  readonly inputType?: DbxForgeTextFieldInputType;
  /**
   * String transformation applied as a value parser (e.g., trim, uppercase).
   */
  readonly idempotentTransform?: TransformStringFunctionConfig;
  /**
   * Initial value for the text input. Defaults to empty string.
   */
  readonly defaultValue?: string;
}

/**
 * Creates a forge field definition for a single-line text input.
 *
 * @param config - Text field configuration including key, label, validation, and transform options
 * @returns A text input field with type `'input'`
 *
 * @example
 * ```typescript
 * const field = forgeTextField({
 *   key: 'email',
 *   label: 'Email',
 *   required: true,
 *   props: {
 *     type: 'email',
 *     placeholder: 'user@example.com'
 *   }
 * });
 * ```
 */
export const forgeTextField = dbxForgeFieldFunction<DbxForgeTextFieldConfig>({
  type: 'input',
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder((input) => ({
    type: input.inputType ?? 'text'
  })),
  buildFieldDef: dbxForgeBuildFieldDef<DbxForgeTextFieldConfig, string>((x, config) => {
    const { pattern, idempotentTransform: transform } = config;

    if (transform) {
      x.addLogic([
        {
          type: 'transform',
          transformType: 'idempotent',
          transform: transformStringFunction(transform)
        }
      ]);
    }

    // configure autocomplete
    x.configure(configureForgeAutocompleteFieldMeta);

    // configure pattern validation
    if (pattern) {
      x.addValidation(dbxForgePatternValidator({ pattern }));
    }
  })
}) as DbxForgeFieldFunction<DbxForgeTextFieldConfig, MatInputField>;
