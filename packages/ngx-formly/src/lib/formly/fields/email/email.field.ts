import { FormlyFieldConfig } from '@ngx-formly/core';
import { FieldConfig, formlyField } from '../field';
import { textField } from '../text';
import { EmailFromTargetSummaryFieldConfig, EmailUserSummary } from './user.summary.picker.field.component';
import { searchableChipField, SearchableChipFieldConfig, SearchableChipFieldFormlyConfig } from '../generic/searchable.field';
import { EmailAddress, EmailParticipant } from '@/app/common/model';
import { EmailValidator, Validators } from '@angular/forms';
import { of } from 'rxjs';
import { SearchableValueFieldDisplayFn, SearchableValueFieldValue } from '../generic/searchable';
import { FormExpandableSectionConfig } from '../wrappers/expandable.wrapper.component';
import { concatArraysUnique } from '@/app/common/utility/value';

export function emailSubjectField(): FormlyFieldConfig {
  return textField({ key: 'subject', label: 'Subject', placeholder: 'Email Subject', required: true });
}

export function emailFromTargetSummaryField<T extends EmailUserSummary, O extends string>(
  { key = 'from', label = 'From', searchEmailUserSummaries, toFormConfig, mapping = null, required = true }: Partial<FieldConfig> & Pick<EmailFromTargetSummaryFieldConfig<T, O>, 'searchEmailUserSummaries' | 'mapping' | 'toFormConfig'>
): EmailFromTargetSummaryFieldConfig<T> {
  return formlyField<EmailFromTargetSummaryFieldConfig<T>>({
    searchEmailUserSummaries,
    mapping,
    toFormConfig,
    key,
    type: 'emailusersummarypicker',
    modelOptions: {},
    templateOptions: {
      label,
      required
    },
  });
}

export function emailToField(config?: EmailParticipantsFieldConfig): EmailParticipantsFieldFormlyConfig {
  return emailAddressParticipantsField({ alwaysOpen: true, key: 'to', label: 'To', placeholder: 'To', required: true, ...config });
}

export function emailCCField(config?: EmailParticipantsFieldConfig): EmailParticipantsFieldFormlyConfig {
  return emailAddressParticipantsField({ alwaysOpen: false, key: 'cc', label: 'CC', placeholder: 'CC', required: false, ...config });
}

export function emailBCCField(config?: EmailParticipantsFieldConfig): EmailParticipantsFieldFormlyConfig {
  return emailAddressParticipantsField({ alwaysOpen: false, key: 'bcc', label: 'BCC', placeholder: 'BCC', required: false, ...config });
}

export function emailAddressParticipantsField(config: EmailParticipantsFieldConfig): EmailParticipantsFieldFormlyConfig {
  const fieldConfig = emailParticipantsField(config);

  if (config.alwaysOpen === false) {
    fieldConfig.wrappers = concatArraysUnique(fieldConfig.wrappers, ['expandable']);
    fieldConfig.templateOptions = {
      ...fieldConfig.templateOptions,
      expandableSection: {
        expandLabel: config.label
      } as FormExpandableSectionConfig,
      attributes: {
        autocomplete: `email-${config.key}`
      }
    };
  }

  return fieldConfig;
}

export interface EmailParticipantsFieldConfig extends SearchableChipFieldConfig<EmailParticipant> {
  alwaysOpen?: boolean;
  autocomplete?: string;
}

export interface EmailParticipantsFieldFormlyConfig extends SearchableChipFieldFormlyConfig<EmailParticipant> { }

export const DEFAULT_EMAIL_PARTICIPANT_DISPLAY_FOR_VALUE: SearchableValueFieldDisplayFn<EmailParticipant> =
  (values: SearchableValueFieldValue<EmailParticipant>[]) => of(values.map(x => ({ ...x, label: x.value.email, sublabel: x.value.name })));

export function emailParticipantsField({
  key, label, name, description, readonly, autocomplete,
  search, displayForValue = DEFAULT_EMAIL_PARTICIPANT_DISPLAY_FOR_VALUE, required = false
}: Partial<EmailParticipantsFieldConfig>): EmailParticipantsFieldFormlyConfig {
  return searchableChipField<EmailParticipantsFieldFormlyConfig>({
    allowStringValues: true,
    convertStringValue: (x) => ({ email: x }) as EmailParticipant,
    hashForValue: (x) => x.email.toLowerCase(),
    search,
    displayForValue,
    textInputValidator: Validators.email,
    key,
    name: name ?? `email-${key}`,
    modelOptions: {},
    templateOptions: {
      label,
      required,
      readonly,
      description,
      attributes: {
        autocomplete: autocomplete ?? `email-${key}`,
      }
    }
  });
}

export interface EmailAddressChipsFieldConfig extends SearchableChipFieldConfig<EmailAddress> {
  autocomplete?: string;
}

export interface EmailAddressChipsFieldFormlyConfig extends SearchableChipFieldFormlyConfig<EmailAddress> { }

export const DEFAULT_EMAIL_ADDRESS_DISPLAY_FOR_VALUE: SearchableValueFieldDisplayFn<EmailAddress> =
  (values: SearchableValueFieldValue<EmailAddress>[]) => of(values.map(x => ({ ...x, label: x.value })));

export function emailAddressChipsField({
  key = 'emails', label = 'Email Addresses', name, description, readonly, autocomplete,
  search, displayForValue = DEFAULT_EMAIL_ADDRESS_DISPLAY_FOR_VALUE, required = false
}: Partial<EmailAddressChipsFieldConfig>
): EmailAddressChipsFieldFormlyConfig {
  return searchableChipField<EmailAddressChipsFieldFormlyConfig>({
    allowStringValues: true,
    convertStringValue: (x) => x,
    hashForValue: (x) => x.toLowerCase(),
    search,
    displayForValue,
    textInputValidator: Validators.email,
    key,
    name: name ?? 'emailaddresses',
    modelOptions: {},
    templateOptions: {
      label,
      required,
      readonly,
      description,
      attributes: {
        autocomplete: autocomplete ?? `email-${key}`
      }
    },
  });
}
