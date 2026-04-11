import { type DbxFormSectionConfig } from '../../wrapper/section.wrapper.component';
import { formlySectionWrapper, formlyFlexLayoutWrapper } from '../../wrapper/wrapper';
import { formlyTextField, type TextFieldConfig } from '../text/text.field';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type LabeledFieldConfig, formlyField, propsAndConfigForFieldConfig, validatorsForFieldConfig } from '../../field';
import { type InternationalPhoneFormlyFieldProps } from './phone.field.component';
import { formlyRepeatArrayField, type RepeatArrayFieldConfig } from '../array/array.field';
import { isE164PhoneNumber } from '../../../../validator/phone';

/**
 * Configuration for an international phone number input field.
 */
export interface InternationalPhoneFieldConfig extends LabeledFieldConfig, InternationalPhoneFormlyFieldProps {}

/**
 * Creates a Formly field configuration for an international phone number input
 * with E.164 validation.
 *
 * @param config - Optional overrides; defaults to key `'phone'`, label `'Phone Number'`
 * @returns A validated {@link FormlyFieldConfig} with type `'intphone'`
 *
 * @example
 * ```typescript
 * const field = phoneField({ preferredCountries: ['us', 'ca'], required: true });
 * ```
 */
export function formlyPhoneField(config: Partial<InternationalPhoneFieldConfig> = {}): FormlyFieldConfig<InternationalPhoneFormlyFieldProps> {
  const { key = 'phone', label = 'Phone Number', preferredCountries, enableSearch, onlyCountries, allowExtension: inputAllowExtension } = config;
  const allowExtension = inputAllowExtension ?? false;

  return formlyField({
    key,
    type: 'intphone',
    ...propsAndConfigForFieldConfig(config, {
      label,
      preferredCountries,
      onlyCountries,
      enableSearch,
      allowExtension
    }),
    ...validatorsForFieldConfig({
      validators: [isE164PhoneNumber(allowExtension)]
    })
  });
}

/**
 * Configuration for a phone number field paired with a text label field.
 */
export interface WrappedPhoneAndLabelFieldConfig {
  readonly phoneField?: Partial<InternationalPhoneFieldConfig>;
  readonly labelField?: TextFieldConfig;
}

/**
 * Creates a flex-layout-wrapped pair of a phone number field and a label text field,
 * useful for collecting named phone numbers (e.g., "Work", "Home").
 *
 * @param config - Optional phone and label field configurations
 * @param config.phoneField - Optional configuration overrides for the phone number input
 * @param config.labelField - Optional configuration overrides for the label text input
 * @returns A flex-layout-wrapped {@link FormlyFieldConfig}
 *
 * @example
 * ```typescript
 * const field = wrappedPhoneAndLabelField({ phoneField: { required: true } });
 * ```
 */
export function formlyWrappedPhoneAndLabelField({ phoneField: phone, labelField: label }: WrappedPhoneAndLabelFieldConfig = {}): FormlyFieldConfig {
  return formlyFlexLayoutWrapper(
    [
      {
        field: formlyPhoneField(phone),
        size: 2
      },
      {
        field: formlyTextField({
          key: 'label',
          label: 'Label',
          autocomplete: 'phone-label',
          ...label
        }),
        size: 4
      }
    ],
    { relative: true }
  );
}

/**
 * Configuration for a section-wrapped phone + label field pair.
 */
export interface PhoneAndLabelFieldSectionConfig extends DbxFormSectionConfig, WrappedPhoneAndLabelFieldConfig {
  readonly key?: string;
}

/**
 * Creates a section-wrapped phone + label field pair with a configurable header.
 *
 * @param config - Optional overrides; defaults to header `'Phone Number'`
 * @param config.key - Optional form model key for the section group
 * @param config.header - Section header text; defaults to `'Phone Number'`
 * @param config.hint - Optional hint text displayed below the section header
 * @param config.phoneField - Optional phone field configuration overrides
 * @param config.labelField - Optional label field configuration overrides
 * @returns A section-wrapped {@link FormlyFieldConfig}
 *
 * @example
 * ```typescript
 * const field = phoneAndLabelSectionField({ header: 'Contact Phone' });
 * ```
 */
export function formlyPhoneAndLabelSectionField({ key, header = 'Phone Number', hint, phoneField, labelField }: PhoneAndLabelFieldSectionConfig = {}): FormlyFieldConfig {
  return formlySectionWrapper(
    {
      key,
      fieldGroup: [formlyWrappedPhoneAndLabelField({ phoneField, labelField })]
    },
    {
      header,
      hint
    }
  );
}

/**
 * Configuration for a repeatable list of phone + label field pairs.
 */
export interface PhoneListFieldConfig extends Omit<RepeatArrayFieldConfig, 'repeatFieldGroup'> {
  phoneAndLabel?: WrappedPhoneAndLabelFieldConfig;
  repeatFieldGroup?: FormlyFieldConfig[];
}

/**
 * Creates a repeat-array field that allows the user to add multiple phone number entries.
 *
 * @param repeatConfig - Optional overrides; defaults to key `'phones'`, label `'Phone Numbers'`
 * @returns A {@link FormlyFieldConfig} with repeat-array type for multiple phone entries
 *
 * @example
 * ```typescript
 * const field = phoneListField({ phoneAndLabel: { phoneField: { preferredCountries: ['us'] } } });
 * ```
 */
export function formlyPhoneListField(repeatConfig: Partial<PhoneListFieldConfig> = {}): FormlyFieldConfig {
  const { key = 'phones', label = 'Phone Numbers', addText = 'Add Phone Number', removeText = 'Remove Phone Number', repeatFieldGroup, phoneAndLabel } = repeatConfig;

  return formlyRepeatArrayField({
    ...repeatConfig,
    key,
    label,
    addText,
    removeText,
    repeatFieldGroup: repeatFieldGroup ?? [formlyWrappedPhoneAndLabelField(phoneAndLabel)]
  });
}

// MARK: Deprecated Aliases
/**
 * @deprecated Use formlyPhoneField instead.
 */
export const phoneField = formlyPhoneField;
/**
 * @deprecated Use formlyWrappedPhoneAndLabelField instead.
 */
export const wrappedPhoneAndLabelField = formlyWrappedPhoneAndLabelField;
/**
 * @deprecated Use formlyPhoneAndLabelSectionField instead.
 */
export const phoneAndLabelSectionField = formlyPhoneAndLabelSectionField;
/**
 * @deprecated Use formlyPhoneListField instead.
 */
export const phoneListField = formlyPhoneListField;
