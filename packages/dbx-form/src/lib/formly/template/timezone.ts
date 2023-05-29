import { TimezoneString } from '@dereekb/util';
import { allTimezoneInfos, searchTimezoneInfos, TimezoneInfo, timezoneInfoForSystem } from '@dereekb/date';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { Observable, of } from 'rxjs';
import { SearchableValueFieldStringSearchFn, SearchableValueFieldValue, SearchableValueFieldDisplayFn, SearchableValueFieldDisplayValue } from '../field/selection/searchable';
import { searchableTextField, SearchableTextFieldConfig } from '../field/selection/searchable/searchable.field';

export type TestStringSearchFunction = (text: string) => string[];

export function timezoneStringSearchFunction(): SearchableValueFieldStringSearchFn<string, TimezoneInfo> {
  const timezoneInfos = allTimezoneInfos();

  return (search: string) => {
    let searchResults;

    if (search.length === 0) {
      searchResults = [timezoneInfoForSystem()].concat(timezoneInfos);
    } else {
      searchResults = searchTimezoneInfos(search, timezoneInfos);
    }

    return of(searchResults.map((meta) => ({ value: meta.timezone, meta })));
  };
}

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
 * textPasswordField() configuration.
 */
export interface TimezoneStringFieldConfig extends Omit<SearchableTextFieldConfig<TimezoneString, TimezoneInfo>, 'inputType' | 'searchOnEmptyText' | 'search' | 'displayForValue' | 'key'>, Partial<Pick<SearchableTextFieldConfig<TimezoneString, TimezoneInfo>, 'key' | 'materialFormField'>> {}

/**
 * Template for a searchable text field for a timezone.
 *
 * @param param0
 * @returns
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
