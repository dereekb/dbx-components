import { cachedGetter, type Maybe, replaceStringsFunction, type TimezoneAbbreviation, type TimezoneString, type TimezoneStringRef, UTC_TIMEZONE_STRING, type UTCTimezoneAbbreviation } from '@dereekb/util';
import { formatInTimeZone } from 'date-fns-tz';
import { timeZonesNames } from '@vvo/tzdb';
import { guessCurrentTimezone } from '../date/date';

/**
 * Returns all recognized IANA timezone strings, including the explicit UTC entry.
 *
 * @returns all known IANA timezone strings plus UTC
 *
 * @example
 * ```ts
 * const zones = allTimezoneStrings();
 * // ['Africa/Abidjan', ..., 'UTC']
 * ```
 */
export function allTimezoneStrings(): TimezoneString[] {
  return [...timeZonesNames, UTC_TIMEZONE_STRING];
}

/**
 * Lazily-computed set of all known timezone strings for O(1) membership checks.
 *
 * @example
 * ```ts
 * allKnownTimezoneStrings().has('America/New_York'); // true
 * ```
 */
export const allKnownTimezoneStrings = cachedGetter(() => {
  return new Set(allTimezoneStrings());
});

/**
 * Lazily-computed array of {@link TimezoneInfo} for every known timezone.
 *
 * Abbreviations are resolved at the time of first access, so results reflect
 * the DST state at that moment.
 */
export const allTimezoneInfos = cachedGetter(() => {
  const now = new Date();
  return allTimezoneStrings().map((x) => timezoneStringToTimezoneInfo(x, now));
});

/**
 * Pre-computed timezone metadata used for display and search operations.
 *
 * Contains lowercase and search-friendly string variants so that
 * {@link searchTimezoneInfos} can perform fast case-insensitive matching.
 */
export interface TimezoneInfo extends TimezoneStringRef {
  /**
   * Searchable form with slashes/underscores replaced by spaces and lowercased.
   */
  readonly search: string;
  /**
   * Lowercased IANA timezone identifier.
   */
  readonly lowercase: string;
  /**
   * Short abbreviation (e.g., `"EST"`, `"PDT"`).
   */
  readonly abbreviation: string;
  /**
   * Lowercased abbreviation for case-insensitive matching.
   */
  readonly lowercaseAbbreviation: string;
}

/**
 * Returns the {@link TimezoneInfo} for the current system timezone, falling back to UTC.
 *
 * @returns timezone info for the current system timezone
 *
 * @example
 * ```ts
 * const info = timezoneInfoForSystem();
 * console.log(info.abbreviation); // e.g., 'CST'
 * ```
 */
export function timezoneInfoForSystem(): TimezoneInfo {
  return timezoneStringToTimezoneInfo(guessCurrentTimezone() ?? UTC_TIMEZONE_STRING);
}

/**
 * Returns the short abbreviation (e.g., `"EST"`, `"PDT"`) for the given timezone at the specified date.
 *
 * The date matters because abbreviations change with DST transitions.
 * Returns `"UKNOWN"` if no timezone is provided.
 *
 * @param timezone - the IANA timezone string (or UTC abbreviation) to get the abbreviation for
 * @param date - the date at which to evaluate the abbreviation (defaults to now)
 * @returns the short timezone abbreviation
 *
 * @example
 * ```ts
 * getTimezoneAbbreviation('America/New_York'); // 'EST' or 'EDT'
 * ```
 */
export function getTimezoneAbbreviation(timezone: Maybe<TimezoneString | UTCTimezoneAbbreviation>, date = new Date()): TimezoneAbbreviation {
  return timezone === UTC_TIMEZONE_STRING ? UTC_TIMEZONE_STRING : timezone ? formatInTimeZone(date, timezone, 'zzz') : 'UKNOWN';
}

/**
 * Returns the full display name (e.g., `"Eastern Standard Time"`) for the given timezone.
 *
 * Returns `"Unknown Timezone"` if no timezone is provided.
 *
 * @param timezone - the IANA timezone string to get the long name for
 * @param date - the date at which to evaluate the name (defaults to now)
 * @returns the full timezone display name
 *
 * @example
 * ```ts
 * getTimezoneLongName('America/New_York'); // 'Eastern Standard Time'
 * ```
 */
export function getTimezoneLongName(timezone: Maybe<TimezoneString>, date = new Date()): string {
  return timezone ? formatInTimeZone(date, timezone, 'zzzz') : 'Unknown Timezone';
}

/**
 * Builds a {@link TimezoneInfo} for the given timezone, computing abbreviation and search variants.
 *
 * @param timezone - the IANA timezone string to build info for
 * @param date - the date at which to evaluate the abbreviation (defaults to now)
 * @returns the computed TimezoneInfo
 *
 * @example
 * ```ts
 * const info = timezoneStringToTimezoneInfo('America/Chicago');
 * // info.abbreviation => 'CST' or 'CDT'
 * // info.search => 'america chicago'
 * ```
 */
export function timezoneStringToTimezoneInfo(timezone: TimezoneString, date = new Date()): TimezoneInfo {
  const abbreviation = getTimezoneAbbreviation(timezone, date);
  return {
    timezone,
    search: timezoneStringToSearchableString(timezone),
    lowercase: timezone.toLowerCase(),
    abbreviation,
    lowercaseAbbreviation: abbreviation.toLowerCase()
  };
}

/**
 * Filters timezone infos by a search string, matching against the searchable name,
 * lowercase identifier, and abbreviation.
 *
 * For queries longer than 2 characters, substring matching on the searchable name is also used.
 *
 * @param search - the search query string
 * @param infos - the array of TimezoneInfo objects to filter
 * @returns the matching TimezoneInfo entries
 *
 * @example
 * ```ts
 * const results = searchTimezoneInfos('eastern', allTimezoneInfos());
 * ```
 */
export function searchTimezoneInfos(search: string, infos: TimezoneInfo[]): TimezoneInfo[] {
  const searchString = search.toLocaleLowerCase();
  return infos.filter((x) => (search.length > 2 && x.search.includes(searchString)) || x.lowercase.startsWith(searchString) || x.lowercaseAbbreviation.startsWith(searchString) || x.abbreviation.includes(search) || x.search === x.timezone);
}

const timezoneStringToSearchableStringReplace = replaceStringsFunction({
  replace: ['/', '_'],
  replaceWith: ' '
});

/**
 * Converts a timezone identifier into a lowercase, space-separated string for search indexing.
 *
 * Replaces `/` and `_` with spaces (e.g., `"America/New_York"` becomes `"america new york"`).
 *
 * @param timezone - the IANA timezone string to convert
 * @returns the searchable lowercase string
 *
 * @example
 * ```ts
 * timezoneStringToSearchableString('America/New_York'); // 'america new york'
 * ```
 */
export function timezoneStringToSearchableString(timezone: TimezoneString): string {
  return timezoneStringToSearchableStringReplace(timezone.toLocaleLowerCase());
}

/**
 * Checks whether the input string is a recognized IANA timezone identifier.
 *
 * Uses the cached set from {@link allKnownTimezoneStrings} for O(1) lookup.
 *
 * @param input - the string to check
 * @returns whether the input is a known timezone
 *
 * @example
 * ```ts
 * isKnownTimezone('America/New_York'); // true
 * isKnownTimezone('Mars/Olympus');     // false
 * ```
 */
export function isKnownTimezone(input: string | TimezoneString): boolean {
  return allKnownTimezoneStrings().has(input);
}
