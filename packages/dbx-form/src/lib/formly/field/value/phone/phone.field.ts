import { DbxFormSectionConfig } from '../../wrapper/section.wrapper.component';
import { sectionWrapper } from '../../wrapper/wrapper';
import { textField, TextFieldConfig } from '../text/text.field';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { LabeledFieldConfig, formlyField } from '../../field';
import { flexLayoutWrapper } from '../../wrapper/wrapper';
import { DbxInternationalPhoneFieldConfig, InternationalPhoneFormlyFieldConfig } from './phone.field.component';
import { repeatArrayField, RepeatArrayFieldConfig } from '../array/array.field';

export interface InternationalPhoneFieldConfig extends LabeledFieldConfig, DbxInternationalPhoneFieldConfig { }

export function phoneField({
  key = 'phone', label = '', placeholder,
  required = false
}: Partial<InternationalPhoneFieldConfig> = {}): InternationalPhoneFormlyFieldConfig {
  const fieldConfig: FormlyFieldConfig = formlyField({
    key,
    type: 'intphone',
    templateOptions: {
      label,
      placeholder,
      required
    }
  });

  // TODO: Add configuration...

  return fieldConfig;
}

export interface WrappedPhoneAndLabelFieldConfig {
  phoneField?: Partial<InternationalPhoneFieldConfig>;
  labelField?: TextFieldConfig;
}

/**
 * Puts a phone and 
 * @param param0 
 * @returns 
 */
export function wrappedPhoneAndLabelField({ phoneField: phone, labelField: label }: WrappedPhoneAndLabelFieldConfig = {}): FormlyFieldConfig {
  return flexLayoutWrapper([
    {
      field: phoneField(phone),
      size: 2
    },
    {
      field: textField({
        key: 'label',
        label: 'Label',
        autocomplete: 'phone-label',
        ...label
      }),
      size: 4
    }
  ], { relative: true });
}

export interface PhoneAndLabelFieldSectionConfig extends DbxFormSectionConfig, WrappedPhoneAndLabelFieldConfig {
  key?: string;
}

export function phoneAndLabelSectionField({ key, header = 'Phone Number', hint, phoneField, labelField }: PhoneAndLabelFieldSectionConfig = {}): FormlyFieldConfig {
  return sectionWrapper({
    key,
    fieldGroup: [wrappedPhoneAndLabelField({ phoneField, labelField })]
  }, {
    header,
    hint
  })
}

export interface PhoneListFieldConfig extends Omit<RepeatArrayFieldConfig, 'repeatFieldGroup'> {
  phoneAndLabel?: WrappedPhoneAndLabelFieldConfig;
  repeatFieldGroup?: FormlyFieldConfig[];
}

export function phoneListField(repeatConfig: Partial<PhoneListFieldConfig> = {}): FormlyFieldConfig {
  const { key = 'phones', label = 'Phone Numbers', addText = 'Add Phone Number', removeText = 'Remove Phone Number', repeatFieldGroup, phoneAndLabel } = repeatConfig;

  return repeatArrayField({
    ...repeatConfig,
    key,
    label,
    addText,
    removeText,
    repeatFieldGroup: repeatFieldGroup ?? [wrappedPhoneAndLabelField(phoneAndLabel)]
  });
};
