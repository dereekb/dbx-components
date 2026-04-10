import type { MatInputField, MatInputProps, MatTextareaField, MatTextareaProps } from '@ng-forge/dynamic-forms-material';
import type { ValidationMessages } from '@ng-forge/dynamic-forms';
import { filterFromPOJO, transformStringFunction, mapMaybeFunction, type TransformStringFunctionConfig, type TransformStringFunctionConfigRef } from '@dereekb/util';
import type { FieldValueParser, FieldConfigParsersRef } from '../../../../field';
import { forgeField, forgeAutocompleteFieldMeta, type DbxForgeFieldAutocompleteConfig } from '../../field';
import { forgeDefaultValidationMessages } from '../../../validation';

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
 * HTML input type for a text field.
 */
export type DbxForgeTextFieldInputType = 'text' | 'password' | 'email';

/**
 * Full configuration for a single-line text input field in forge.
 *
 * Combines labeling, validation (pattern, length), and string transformation
 * into one config object.
 */
export interface DbxForgeTextFieldConfig extends DbxForgeTextFieldPatternConfig, DbxForgeTextFieldLengthConfig, Partial<TransformStringFunctionConfigRef> {
  readonly key: string;
  readonly label?: string;
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
  /**
   * HTML input type. Defaults to `'text'`.
   */
  readonly inputType?: DbxForgeTextFieldInputType;
  /**
   * String transformation applied as a value parser (e.g., trim, uppercase).
   */
  readonly transform?: TransformStringFunctionConfig;
  readonly defaultValue?: string;
  /**
   * Sets the autocomplete attribute on the input. Pass `false` to disable browser autofill.
   */
  readonly autocomplete?: DbxForgeFieldAutocompleteConfig;
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
 * const parsers = forgeTextFieldTransformParser({ transform: { trim: true, toLowercase: true } });
 * ```
 */
export function forgeTextFieldTransformParser(config: Partial<FieldConfigParsersRef> & Partial<TransformStringFunctionConfigRef>): FieldValueParser[] | undefined {
  const { parsers: inputParsers, transform } = config;
  let parsers: FieldValueParser[] | undefined;

  if (inputParsers) {
    parsers = inputParsers;
  }

  if (transform) {
    const transformParser: FieldValueParser = mapMaybeFunction(transformStringFunction(transform));
    const existing = parsers ?? [];
    parsers = [transformParser, ...existing];
  }

  return parsers;
}

/**
 * Creates a forge field definition for a single-line text input.
 *
 * @param config - Text field configuration including key, label, validation, and transform options
 * @returns A validated {@link MatInputField} with type `'input'`
 *
 * @example
 * ```typescript
 * const field = forgeTextField({ key: 'username', label: 'Username', maxLength: 50, required: true });
 * ```
 */
export function forgeTextField(config: DbxForgeTextFieldConfig): MatInputField {
  const { key, label, placeholder, required, readonly: isReadonly, description, minLength, maxLength, pattern, inputType = 'text', defaultValue = '', autocomplete } = config;

  const props: Partial<MatInputProps> = filterFromPOJO({
    type: inputType,
    hint: description
  });

  const validationMessages: ValidationMessages = forgeDefaultValidationMessages();
  const meta = forgeAutocompleteFieldMeta(autocomplete);

  return forgeField(
    filterFromPOJO({
      key,
      type: 'input' as const,
      label: label ?? '',
      placeholder,
      value: defaultValue,
      required,
      readonly: isReadonly,
      minLength,
      maxLength,
      pattern: pattern != null ? (typeof pattern === 'string' ? pattern : pattern.source) : undefined,
      validationMessages,
      meta,
      props: Object.keys(props).length > 0 ? props : undefined
    }) as MatInputField
  );
}

// MARK: TextArea Field
/**
 * Configuration for a multi-line textarea input field in forge.
 */
export interface DbxForgeTextAreaFieldConfig extends DbxForgeTextFieldPatternConfig, DbxForgeTextFieldLengthConfig, Partial<TransformStringFunctionConfigRef> {
  readonly key: string;
  readonly label?: string;
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
  /**
   * Number of visible text rows. Defaults to 3.
   */
  readonly rows?: number;
  readonly defaultValue?: string;
  /**
   * Sets the autocomplete attribute on the textarea. Pass `false` to disable browser autofill.
   */
  readonly autocomplete?: DbxForgeFieldAutocompleteConfig;
}

/**
 * Creates a forge field definition for a multi-line textarea input.
 *
 * @param config - Textarea field configuration including key, label, rows, and validation options
 * @returns A validated {@link MatTextareaField} with type `'textarea'`
 *
 * @example
 * ```typescript
 * const field = forgeTextAreaField({ key: 'bio', label: 'Biography', rows: 5, maxLength: 500 });
 * ```
 */
export function forgeTextAreaField(config: DbxForgeTextAreaFieldConfig): MatTextareaField {
  const { key, label, placeholder, required, readonly: isReadonly, description, rows = 3, minLength, maxLength, pattern, defaultValue = '', autocomplete } = config;

  const props: Partial<MatTextareaProps> = filterFromPOJO({
    hint: description,
    rows
  });

  const validationMessages: ValidationMessages = forgeDefaultValidationMessages();
  const meta = forgeAutocompleteFieldMeta(autocomplete);

  return forgeField(
    filterFromPOJO({
      key,
      type: 'textarea' as const,
      label: label ?? '',
      placeholder,
      value: defaultValue,
      required,
      readonly: isReadonly,
      minLength,
      maxLength,
      pattern: pattern != null ? (typeof pattern === 'string' ? pattern : pattern.source) : undefined,
      validationMessages,
      meta,
      props: Object.keys(props).length > 0 ? props : undefined
    }) as MatTextareaField
  );
}
