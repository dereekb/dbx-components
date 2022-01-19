import { EmailAddressDomain } from '@/app/common/model';
import { EmailUtility, EmailValidators } from '@/app/common/utility/email';
import { of } from 'rxjs';
import { searchableChipField, SearchableChipFieldConfig, SearchableChipFieldFormlyConfig } from '../generic/searchable.field';
import { SearchableValueFieldDisplayFn, SearchableValueFieldValue } from '../generic/searchable';

export interface EmailAddressDomainChipsFieldConfig extends SearchableChipFieldConfig<EmailAddressDomain> { }
export interface EmailAddressDomainChipsFieldFormlyConfig extends SearchableChipFieldFormlyConfig<EmailAddressDomain> { }

export const DEFAULT_EMAIL_ADDRESS_DOMAIN_DISPLAY_FOR_VALUE: SearchableValueFieldDisplayFn<EmailAddressDomain> =
  (values: SearchableValueFieldValue<EmailAddressDomain>[]) => of(values.map(x => ({ ...x, label: '@' + x.value })));

export function emailAddressDomainChipsField({
  key = 'domains', label = 'Email Address Domains', description, readonly,
  search, displayForValue = DEFAULT_EMAIL_ADDRESS_DOMAIN_DISPLAY_FOR_VALUE, required = false
}: Partial<EmailAddressDomainChipsFieldConfig>
): EmailAddressDomainChipsFieldFormlyConfig {
  return searchableChipField<EmailAddressDomainChipsFieldFormlyConfig>({
    allowStringValues: true,
    convertStringValue: (x) => EmailUtility.readDomain(x),
    hashForValue: (x) => x.toLowerCase(),
    search,
    displayForValue,
    textInputValidator: EmailValidators.domain,
    key,
    name: 'domains',
    modelOptions: {},
    templateOptions: {
      label,
      required,
      readonly,
      description
    },
  });
}
