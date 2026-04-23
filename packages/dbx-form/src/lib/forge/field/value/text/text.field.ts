import type { BaseValueField, DynamicText } from '@ng-forge/dynamic-forms';
import type { MatInputField, MatInputProps } from '@ng-forge/dynamic-forms-material';
import { transformStringFunction, type TransformStringFunctionConfig } from '@dereekb/util';
import type { FieldAutocompleteAttributeOptionRef } from '../../../../field/field.autocomplete';
import { dbxForgeFieldFunction, dbxForgeBuildFieldDef, dbxForgeFieldFunctionConfigPropsWithHintBuilder, type DbxForgeFieldFunctionDef, type DbxForgeFieldFunction, type DbxForgeFieldHintOrDescriptionValueRef } from '../../field';
import { configureForgeAutocompleteFieldMeta } from '../../field.util.meta';
import { dbxForgeEmailValidator, dbxForgePatternValidator } from '../../field.util.validation';

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
type DbxForgeStringInputFieldDef = BaseValueField<Omit<MatInputProps, 'type'> & { type?: DbxForgeTextFieldInputType }, string> & { type: 'input' } & DbxForgeFieldHintOrDescriptionValueRef<DynamicText>;

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
export interface DbxForgeTextFieldConfig extends DbxForgeFieldFunctionDef<DbxForgeStringInputFieldDef>, FieldAutocompleteAttributeOptionRef {
  /**
   * HTML input type. Defaults to `'text'`.
   */
  readonly inputType?: DbxForgeTextFieldInputType;
  /**
   * An idempotent string transformation applied as a value parser (e.g., trim, uppercase).
   *
   * For non-idempotent transformations, you should directly configure the `transform` property instead.
   */
  readonly idempotentTransform?: TransformStringFunctionConfig;
}

/**
 * Creates a forge field definition for a single-line text input.
 *
 * @param config - Text field configuration including key, label, validation, and transform options
 * @returns A text input field with type `'input'`
 *
 * @example
 * ```typescript
 * const field = dbxForgeTextField({
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
export const dbxForgeTextField = dbxForgeFieldFunction<DbxForgeTextFieldConfig>({
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

    if (config.inputType === 'email') {
      x.addValidation(dbxForgeEmailValidator());
    }

    // configure autocomplete
    x.configure(configureForgeAutocompleteFieldMeta);

    // configure pattern validation
    if (pattern) {
      x.addValidation(dbxForgePatternValidator({ pattern }));
    }
  })
}) as DbxForgeFieldFunction<DbxForgeTextFieldConfig, MatInputField>;
