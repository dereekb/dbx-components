import { type TimezoneString } from '@dereekb/util';
import { allTimezoneInfos, searchTimezoneInfos, type TimezoneInfo, timezoneInfoForSystem } from '@dereekb/date';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type Observable, of } from 'rxjs';
import { type SearchableValueFieldStringSearchFn, type SearchableValueFieldValue, type SearchableValueFieldDisplayFn, type SearchableValueFieldDisplayValue } from '../field/selection/searchable';
import { searchableTextField, type SearchableTextFieldConfig } from '../field/selection/searchable/searchable.field';

/**
 * A function that takes a search string and returns matching string results.
 */
export type TestStringSearchFunction = (text: string) => string[];

/**
 * Creates a search function for timezone strings that searches across all known timezone infos.
 *
 * When the search string is empty, the system timezone is returned first, followed by all timezones.
 *
 * @returns A {@link SearchableValueFieldStringSearchFn} for searching timezone values.
 */
export function timezoneStringSearchFunction(): SearchableValueFieldStringSearchFn<string, TimezoneInfo> {
  const timezoneInfos = allTimezoneInfos();

  return (search: string) => {
    let searchResults;

    if (search.length === 0) {
      searchResults = [timezoneInfoForSystem(), ...timezoneInfos];
    } else {
      searchResults = searchTimezoneInfos(search, timezoneInfos);
    }

    return of(searchResults.map((meta) => ({ value: meta.timezone, meta })));
  };
}

/**
 * Display function for timezone string values in a searchable field.
 *
 * Maps each timezone value to a display object with the timezone name as the label
 * and its abbreviation as the sublabel.
 *
 * @param values - The timezone values to convert to display values
 * @returns An observable emitting display values with label and sublabel
 *
 * @param values - The timezone values to convert to display values
 */
export const DISPLAY_FOR_TIMEZONE_STRING_VALUE: SearchableValueFieldDisplayFn<string, TimezoneInfo> = (values: SearchableValueFieldValue<string, TimezoneInfo>[]) => {
  const timezoneInfos = allTimezoneInfos();

  const displayValues: SearchableValueFieldDisplayValue<string, TimezoneInfo>[] = values.map((x) => {
    const meta = x.meta ?? timezoneInfos.find((y) => x.value === y.timezone); // attempt to find the metadata in the timeInfos if it isn't provided.
    return { ...x, label: x.value, sublabel: meta?.abbreviation ?? 'Unknown' };
  });

  const obs: Observable<SearchableValueFieldDisplayValue<string, TimezoneInfo>[]> = of(displayValues);
  return obs;
};

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
export function timezoneStringField(config: TimezoneStringFieldConfig = {}): FormlyFieldConfig {
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
