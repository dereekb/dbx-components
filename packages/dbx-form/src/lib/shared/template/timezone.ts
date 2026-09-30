/**
 * A function that takes a search string and returns matching string results.
 */

import { type Maybe, type TimezoneString } from '@dereekb/util';
import { type TimezoneInfo, allTimezoneInfos, timezoneInfoForSystem, searchTimezoneInfos } from '@dereekb/date';
import { of, type Observable } from 'rxjs';
import type { SearchableValueFieldDisplayFn, SearchableValueFieldDisplayValue, SearchableValueFieldStringSearchFn, SearchableValueFieldValue } from '../../field';

export type TestStringSearchFunction = (text: string) => string[];

/**
 * Default label displayed for the "Auto" timezone option.
 */
export const DEFAULT_AUTO_TIMEZONE_STRING_VALUE_LABEL = 'Auto';

/**
 * Metadata for a timezone searchable field value.
 */
export interface TimezoneStringSearchableValueMeta extends TimezoneInfo {
  /**
   * Whether or not this value is the "Auto" option, which selects the user's current (system) timezone.
   */
  readonly auto?: Maybe<boolean>;
}

/**
 * Configuration for the "Auto" timezone option.
 */
export interface TimezoneStringAutoValueConfig {
  /**
   * Label displayed for the "Auto" option.
   *
   * Defaults to {@link DEFAULT_AUTO_TIMEZONE_STRING_VALUE_LABEL}.
   */
  readonly autoLabel?: Maybe<string>;
}

/**
 * Creates a search function for timezone strings that searches across all known timezone infos.
 *
 * When the search string is empty, an "Auto" option for the system timezone is returned first, followed by all timezones. The "Auto" option is also returned first when the search string matches the start of its label (i.e. "au").
 *
 * Selecting the "Auto" option sets the value to the system timezone string.
 *
 * @param config - Optional configuration for the "Auto" option. Use the same config with {@link timezoneStringDisplayFunction}.
 * @returns A {@link SearchableValueFieldStringSearchFn} for searching timezone values.
 * @__NO_SIDE_EFFECTS__
 */
export function timezoneStringSearchFunction(config?: TimezoneStringAutoValueConfig): SearchableValueFieldStringSearchFn<TimezoneString, TimezoneStringSearchableValueMeta> {
  const timezoneInfos = allTimezoneInfos();
  const lowercaseAutoLabel = (config?.autoLabel ?? DEFAULT_AUTO_TIMEZONE_STRING_VALUE_LABEL).toLowerCase();

  return (search: string) => {
    const matchingTimezoneInfos: TimezoneStringSearchableValueMeta[] = search.length === 0 ? timezoneInfos : searchTimezoneInfos(search, timezoneInfos);
    const searchResults: SearchableValueFieldValue<TimezoneString, TimezoneStringSearchableValueMeta>[] = matchingTimezoneInfos.map((meta) => ({ value: meta.timezone, meta }));

    if (lowercaseAutoLabel.startsWith(search.toLowerCase())) {
      const systemTimezoneInfo = timezoneInfoForSystem();

      // the auto option shares its value with the system timezone's result, so it skips the display cache to keep its own display
      searchResults.unshift({ value: systemTimezoneInfo.timezone, meta: { ...systemTimezoneInfo, auto: true }, skipDisplayCache: true });
    }

    return of(searchResults);
  };
}

/**
 * Creates a display function for timezone string values in a searchable field.
 *
 * Maps each timezone value to a display object with the timezone name as the label
 * and its abbreviation as the sublabel. The "Auto" option is labeled with the configured
 * auto label and shows the system timezone and its abbreviation as the sublabel.
 *
 * @param config - Optional configuration for the "Auto" option. Use the same config with {@link timezoneStringSearchFunction}.
 * @returns A {@link SearchableValueFieldDisplayFn} for displaying timezone values.
 * @__NO_SIDE_EFFECTS__
 */
export function timezoneStringDisplayFunction(config?: TimezoneStringAutoValueConfig): SearchableValueFieldDisplayFn<TimezoneString, TimezoneStringSearchableValueMeta> {
  const autoLabel = config?.autoLabel ?? DEFAULT_AUTO_TIMEZONE_STRING_VALUE_LABEL;

  return (values: SearchableValueFieldValue<TimezoneString, TimezoneStringSearchableValueMeta>[]) => {
    const timezoneInfos = allTimezoneInfos();

    const displayValues: SearchableValueFieldDisplayValue<TimezoneString, TimezoneStringSearchableValueMeta>[] = values.map((x) => {
      const meta: Maybe<TimezoneStringSearchableValueMeta> = x.meta ?? timezoneInfos.find((y) => x.value === y.timezone); // attempt to find the metadata in the timeInfos if it isn't provided.
      const abbreviation = meta?.abbreviation ?? 'Unknown';
      let displayValue: SearchableValueFieldDisplayValue<TimezoneString, TimezoneStringSearchableValueMeta>;

      if (meta?.auto) {
        displayValue = { ...x, label: autoLabel, sublabel: abbreviation === x.value ? x.value : `${x.value} - ${abbreviation}` };
      } else {
        displayValue = { ...x, label: x.value, sublabel: abbreviation };
      }

      return displayValue;
    });

    const obs: Observable<SearchableValueFieldDisplayValue<TimezoneString, TimezoneStringSearchableValueMeta>[]> = of(displayValues);
    return obs;
  };
}

/**
 * Default display function for timezone string values in a searchable field.
 *
 * The "Auto" option uses the {@link DEFAULT_AUTO_TIMEZONE_STRING_VALUE_LABEL}. Use {@link timezoneStringDisplayFunction} to customize it.
 */
export const DISPLAY_FOR_TIMEZONE_STRING_VALUE: SearchableValueFieldDisplayFn<TimezoneString, TimezoneStringSearchableValueMeta> = timezoneStringDisplayFunction();
