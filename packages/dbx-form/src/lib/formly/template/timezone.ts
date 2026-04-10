import { type TimezoneString } from '@dereekb/util';
import { type TimezoneInfo } from '@dereekb/date';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { searchableTextField, type SearchableTextFieldConfig } from '../field/selection/searchable/searchable.field';
import { DISPLAY_FOR_TIMEZONE_STRING_VALUE, timezoneStringSearchFunction } from '../../shared/template/timezone';

/**
 * Configuration for a timezone string searchable field.
 *
 * Omits search-related properties that are internally configured by {@link timezoneStringField}.
 */
export interface TimezoneStringFieldConfig extends Omit<SearchableTextFieldConfig<TimezoneString, TimezoneInfo>, 'inputType' | 'searchOnEmptyText' | 'search' | 'displayForValue' | 'key'>, Partial<Pick<SearchableTextFieldConfig<TimezoneString, TimezoneInfo>, 'key' | 'materialFormField'>> {}

/**
 * Creates a searchable text field for selecting a timezone.
 *
 * Defaults to the key `'timezone'` and label `'Timezone'`. Searches all known timezones
 * and displays the timezone name with its abbreviation.
 *
 * @param config - Optional configuration overrides for the timezone field.
 * @returns A Formly field configuration for timezone selection.
 */
export function formlyTimezoneStringField(config: TimezoneStringFieldConfig = {}): FormlyFieldConfig {
  return searchableTextField({
    key: 'timezone',
    label: 'Timezone',
    asArrayValue: false,
    required: false,
    ...config,
    searchOnEmptyText: true,
    allowStringValues: false,
    showClearValue: true,
    search: timezoneStringSearchFunction(),
    displayForValue: DISPLAY_FOR_TIMEZONE_STRING_VALUE
  });
}

// MARK: Deprecated Aliases
/**
 * @deprecated Use formlyTimezoneStringField instead.
 */
export const timezoneStringField = formlyTimezoneStringField;
