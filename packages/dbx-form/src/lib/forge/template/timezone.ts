import { type TimezoneString } from '@dereekb/util';
import { timezoneStringSearchFunction, timezoneStringDisplayFunction, type TimezoneStringAutoValueConfig, type TimezoneStringSearchableValueMeta } from '../../shared/template/timezone';
import { dbxForgeSearchableTextField, type DbxForgeSearchableTextFieldConfig } from '../field/selection/searchable/searchable-text.field';

/**
 * Configuration for a forge timezone string field.
 *
 * Omits search-related properties that are internally configured. The "Auto" option's label can be customized with `autoLabel`.
 */
export interface DbxForgeTimezoneStringFieldConfig
  extends
    Omit<DbxForgeSearchableTextFieldConfig<TimezoneString, TimezoneStringSearchableValueMeta>, 'key' | 'search' | 'displayForValue' | 'searchOnEmptyText' | 'allowStringValues' | 'showClearValue'>,
    Partial<Pick<DbxForgeSearchableTextFieldConfig<TimezoneString, TimezoneStringSearchableValueMeta>, 'key'>>,
    TimezoneStringAutoValueConfig {}

/**
 * Creates a forge searchable field for selecting a timezone.
 *
 * Defaults to the key `'timezone'` and label `'Timezone'`. Searches all known timezones
 * and displays the timezone name with its abbreviation. An "Auto" option that shows the
 * user's current timezone is listed first, and selecting it sets the value to that timezone.
 *
 * @param config - Optional configuration overrides for the timezone field.
 * @returns A forge searchable text field definition for timezone selection.
 *
 * @example
 * ```typescript
 * const field = dbxForgeTimezoneStringField();
 * const fieldWithKey = dbxForgeTimezoneStringField({ key: 'tz', label: 'Select Timezone' });
 * const fieldWithAutoLabel = dbxForgeTimezoneStringField({ autoLabel: 'Use My Timezone' });
 * ```
 */
export function dbxForgeTimezoneStringField(config: DbxForgeTimezoneStringFieldConfig = {}) {
  const { autoLabel, ...fieldConfig } = config;
  const autoValueConfig: TimezoneStringAutoValueConfig = { autoLabel };

  return dbxForgeSearchableTextField<TimezoneString, TimezoneStringSearchableValueMeta>({
    key: 'timezone',
    label: 'Timezone',
    ...fieldConfig,
    props: {
      ...fieldConfig.props,
      searchOnEmptyText: true,
      allowStringValues: false,
      showClearValue: true,
      search: timezoneStringSearchFunction(autoValueConfig),
      displayForValue: timezoneStringDisplayFunction(autoValueConfig)
    }
  });
}
