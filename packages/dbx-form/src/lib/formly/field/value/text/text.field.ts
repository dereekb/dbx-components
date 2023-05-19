import { concatArrays, mapMaybeFunction, transformStringFunction, TransformStringFunctionConfig, TransformStringFunctionConfigRef } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { AttributesFieldConfig, LabeledFieldConfig, formlyField, propsAndConfigForFieldConfig, DescriptionFieldConfig, FormlyValueParser, FieldConfigParsersRef, MaterialFormFieldConfig } from '../../field';

export interface TextFieldLengthConfig {
  minLength?: number;
  maxLength?: number;
}

export interface TextFieldPatternConfig {
  pattern?: string | RegExp;
}

export type TextFieldInputType = 'text' | 'password' | 'email';

export interface TextFieldConfig extends LabeledFieldConfig, DescriptionFieldConfig, TextFieldPatternConfig, TextFieldLengthConfig, AttributesFieldConfig, Partial<TransformStringFunctionConfigRef>, MaterialFormFieldConfig {
  inputType?: TextFieldInputType;
  transform?: TransformStringFunctionConfig;
}

export function textFieldTransformParser(config: Partial<FieldConfigParsersRef> & Partial<TransformStringFunctionConfigRef>) {
  const { parsers: inputParsers, transform } = config;
  let parsers: FormlyValueParser[] | undefined;

  if (inputParsers) {
    parsers = inputParsers;
  }

  if (transform) {
    const transformParser: FormlyValueParser = mapMaybeFunction(transformStringFunction(transform));
    parsers = concatArrays([transformParser], parsers);
  }

  return parsers;
}

export function textField(config: TextFieldConfig): FormlyFieldConfig {
  const { transform, key, pattern, minLength, maxLength, inputType: type = 'text', materialFormField } = config;
  const parsers = textFieldTransformParser(config);

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

export interface TextAreaFieldConfig extends LabeledFieldConfig, DescriptionFieldConfig, TextFieldPatternConfig, TextFieldLengthConfig, AttributesFieldConfig, Partial<TransformStringFunctionConfigRef>, MaterialFormFieldConfig {
  rows?: number;
}

export function textAreaField(config: TextAreaFieldConfig): FormlyFieldConfig {
  const { key, rows = 3, pattern, minLength, maxLength, materialFormField } = config;
  const parsers = textFieldTransformParser(config);

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
