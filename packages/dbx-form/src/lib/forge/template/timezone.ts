import { type TimezoneString } from '@dereekb/util';
import { type TimezoneInfo } from '@dereekb/date';
import { timezoneStringSearchFunction, DISPLAY_FOR_TIMEZONE_STRING_VALUE } from '../../shared/template/timezone';
import { forgeSearchableTextField, type ForgeSearchableTextFieldConfig } from '../field/selection/searchable/searchable.field';
import type { ForgeFormFieldWrapperFieldDef } from '../field/wrapper/formfield/formfield.field';
import type { ForgeSearchableTextFieldDef } from '../field/selection/searchable/searchable.field.component';

/**
 * Configuration for a forge timezone string field.
 *
 * Omits search-related properties that are internally configured.
 */
export interface ForgeTimezoneStringFieldConfig extends Omit<ForgeSearchableTextFieldConfig<TimezoneString, TimezoneInfo>, 'key' | 'search' | 'displayForValue' | 'searchOnEmptyText' | 'allowStringValues' | 'showClearValue'>, Partial<Pick<ForgeSearchableTextFieldConfig<TimezoneString, TimezoneInfo>, 'key'>> {}

/**
 * Creates a forge searchable field for selecting a timezone.
 *
 * Defaults to the key `'timezone'` and label `'Timezone'`. Searches all known timezones
 * and displays the timezone name with its abbreviation.
 *
 * @param config - Optional configuration overrides for the timezone field.
 * @returns A forge searchable text field definition for timezone selection.
 *
 * @example
 * ```typescript
 * const field = forgeTimezoneStringField();
 * const fieldWithKey = forgeTimezoneStringField({ key: 'tz', label: 'Select Timezone' });
 * ```
 */
export function forgeTimezoneStringField(config: ForgeTimezoneStringFieldConfig = {}): ForgeFormFieldWrapperFieldDef<ForgeSearchableTextFieldDef<TimezoneString, TimezoneInfo>> {
  return forgeSearchableTextField<TimezoneString, TimezoneInfo>({
    key: 'timezone',
    label: 'Timezone',
    ...config,
    searchOnEmptyText: true,
    allowStringValues: false,
    showClearValue: true,
    search: timezoneStringSearchFunction(),
    displayForValue: DISPLAY_FOR_TIMEZONE_STRING_VALUE
  });
}
