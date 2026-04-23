import { concatArrays, mapMaybeFunction, transformStringFunction, type TransformStringFunctionConfig, type TransformStringFunctionConfigRef } from '@dereekb/util';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type LabeledFieldConfig, formlyField, propsAndConfigForFieldConfig, type MaterialFormFieldConfig, type DescriptionFieldConfig, type AttributesFieldConfig, type FieldValueParser, type FieldConfigParsersRef } from '../../field';

/**
 * Configuration for minimum and maximum text length constraints.
 */
export interface TextFieldLengthConfig {
  minLength?: number;
  maxLength?: number;
}

/**
 * Configuration for regex pattern validation on a text field.
 */
export interface TextFieldPatternConfig {
  pattern?: string | RegExp;
}

/**
 * HTML input type for a text field.
 */
export type TextFieldInputType = 'text' | 'password' | 'email';

/**
 * Full configuration for a single-line text input field.
 *
 * Combines labeling, validation (pattern, length), string transformation,
 * and Material form field styling into one config object.
 */
export interface TextFieldConfig extends LabeledFieldConfig, DescriptionFieldConfig, TextFieldPatternConfig, TextFieldLengthConfig, AttributesFieldConfig, Partial<TransformStringFunctionConfigRef>, MaterialFormFieldConfig {
  /**
   * HTML input type. Defaults to `'text'`.
   */
  inputType?: TextFieldInputType;
  /**
   * String transformation applied as a value parser (e.g., trim, uppercase).
   */
  transform?: TransformStringFunctionConfig;
}

/**
 * Builds an array of value parsers for a text field, incorporating any configured
 * string transformation (e.g., trim, lowercase) as a parser prepended to existing parsers.
 *
 * @param config - Parser and transform configuration
 * @returns Array of value parsers, or undefined if none configured
 *
 * @example
 * ```typescript
 * const parsers = textFieldTransformParser({ transform: { trim: true, toLowercase: true } });
 * ```
 */
export function formlyTextFieldTransformParser(config: Partial<FieldConfigParsersRef> & Partial<TransformStringFunctionConfigRef>) {
  const { parsers: inputParsers, transform } = config;
  let parsers: FieldValueParser[] | undefined;

  if (inputParsers) {
    parsers = inputParsers;
  }

  if (transform) {
    const transformParser: FieldValueParser = mapMaybeFunction(transformStringFunction(transform));
    parsers = concatArrays([transformParser], parsers);
  }

  return parsers;
}

/**
 * Creates a Formly field configuration for a single-line text input.
 *
 * @param config - Text field configuration including key, label, validation, and transform options
 * @returns A validated {@link FormlyFieldConfig} with type `'input'`
 *
 * @example
 * ```typescript
 * const field = textField({ key: 'username', label: 'Username', maxLength: 50, required: true });
 * ```
 */
export function formlyTextField(config: TextFieldConfig): FormlyFieldConfig {
  const { transform: _transform, key, pattern, minLength, maxLength, inputType: type = 'text', materialFormField } = config;
  const parsers = formlyTextFieldTransformParser(config);

  return formlyField({
    key,
    type: 'input',
    ...propsAndConfigForFieldConfig(config, {
      ...materialFormField,
      type,
      minLength,
      maxLength,
      pattern
    }),
    parsers
  });
}

/**
 * Configuration for a multi-line textarea input field.
 */
export interface TextAreaFieldConfig extends LabeledFieldConfig, DescriptionFieldConfig, TextFieldPatternConfig, TextFieldLengthConfig, AttributesFieldConfig, Partial<TransformStringFunctionConfigRef>, MaterialFormFieldConfig {
  /**
   * Number of visible text rows. Defaults to 3.
   */
  rows?: number;
}

/**
 * Creates a Formly field configuration for a multi-line textarea input.
 *
 * @param config - Textarea field configuration including key, label, rows, and validation options
 * @returns A validated {@link FormlyFieldConfig} with type `'textarea'`
 *
 * @example
 * ```typescript
 * const field = textAreaField({ key: 'bio', label: 'Biography', rows: 5, maxLength: 500 });
 * ```
 */
export function formlyTextAreaField(config: TextAreaFieldConfig): FormlyFieldConfig {
  const { key, rows = 3, pattern, minLength, maxLength, materialFormField } = config;
  const parsers = formlyTextFieldTransformParser(config);

  return formlyField({
    key,
    type: 'textarea',
    ...propsAndConfigForFieldConfig(config, {
      ...materialFormField,
      rows,
      minLength,
      maxLength,
      pattern
    }),
    parsers
  });
}

// MARK: Deprecated Aliases
/**
 * @deprecated Use formlyTextFieldTransformParser instead.
 */
export const textFieldTransformParser = formlyTextFieldTransformParser;
/**
 * @deprecated Use formlyTextField instead.
 */
export const textField = formlyTextField;
/**
 * @deprecated Use formlyTextAreaField instead.
 */
export const textAreaField = formlyTextAreaField;
