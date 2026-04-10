import { type DescriptionFieldConfig, type MaterialFormFieldConfig, type LabeledFieldConfig, formlyField, propsAndConfigForFieldConfig } from './../field';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type TextFieldLengthConfig } from '../value/text/text.field';

/**
 * Configuration for a rich text editor field with optional length constraints.
 */
export interface TextEditorFieldConfig extends LabeledFieldConfig, DescriptionFieldConfig, TextFieldLengthConfig, MaterialFormFieldConfig {}

/**
 * Creates a Formly field configuration for a rich text editor.
 *
 * The field defaults to an empty string and updates the model on blur events.
 *
 * @param config - Text editor field configuration
 * @returns A validated {@link FormlyFieldConfig} with type `'texteditor'`
 *
 * @example
 * ```typescript
 * const field = textEditorField({ key: 'bio', label: 'Biography', maxLength: 2000 });
 * ```
 */
export function formlyTextEditorField(config: TextEditorFieldConfig): FormlyFieldConfig {
  const { key, minLength, maxLength, materialFormField } = config;
  const fieldConfig: FormlyFieldConfig = formlyField({
    key,
    type: 'texteditor',
    defaultValue: '', // Set to always get a string as a result.
    modelOptions: {
      // https://formly.dev/examples/validation/async-validation-update-on
      // Set to trigger value update on blurs with the form. However, the value is set internally too.
      updateOn: 'blur'
    },
    ...propsAndConfigForFieldConfig(config, {
      ...materialFormField,
      minLength,
      maxLength
    })
  });

  return fieldConfig;
}

// MARK: Deprecated Aliases
/**
 * @deprecated Use formlyTextEditorField instead.
 */
export const textEditorField = formlyTextEditorField;
