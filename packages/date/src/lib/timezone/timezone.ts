import { cachedGetter, type Maybe, replaceStringsFunction, type TimezoneAbbreviation, type TimezoneString, type TimezoneStringRef, UTC_TIMEZONE_STRING, type UTCTimezoneAbbreviation } from '@dereekb/util';
import { formatInTimeZone } from 'date-fns-tz';
import { timeZonesNames } from '@vvo/tzdb';
import { guessCurrentTimezone } from '../date/date';

export function allTimezoneStrings(): TimezoneString[] {
  return timeZonesNames.concat(UTC_TIMEZONE_STRING);
}

export const allKnownTimezoneStrings = cachedGetter(() => {
  return new Set(allTimezoneStrings());
});

export const allTimezoneInfos = cachedGetter(() => {
  const now = new Date();
  return allTimezoneStrings().map((x) => timezoneStringToTimezoneInfo(x, now));
});

export interface TimezoneInfo extends TimezoneStringRef {
  search: string;
  lowercase: string;
  abbreviation: string;
  lowercaseAbbreviation: string;
}

export function timezoneInfoForSystem(): TimezoneInfo {
  return timezoneStringToTimezoneInfo(guessCurrentTimezone() ?? UTC_TIMEZONE_STRING);
}

export function getTimezoneAbbreviation(timezone: Maybe<TimezoneString | UTCTimezoneAbbreviation>, date = new Date()): TimezoneAbbreviation {
  return timezone === UTC_TIMEZONE_STRING ? UTC_TIMEZONE_STRING : timezone ? formatInTimeZone(date, timezone, 'zzz') : 'UKNOWN';
}

export function getTimezoneLongName(timezone: Maybe<TimezoneString>, date = new Date()): string {
  return timezone ? formatInTimeZone(date, timezone, 'zzzz') : 'Unknown Timezone';
}

export function timezoneStringToTimezoneInfo(timezone: TimezoneString, date = new Date()): TimezoneInfo {
  const abbreviation = getTimezoneAbbreviation(timezone, date);
  const result = {
    timezone,
    search: timezoneStringToSearchableString(timezone),
    lowercase: timezone.toLowerCase(),
    abbreviation,
    lowercaseAbbreviation: abbreviation.toLowerCase()
  };

  return result;
}

export function searchTimezoneInfos(search: string, infos: TimezoneInfo[]): TimezoneInfo[] {
  const searchString = search.toLocaleLowerCase();
  return infos.filter((x) => (search.length > 2 && x.search.includes(searchString)) || x.lowercase.startsWith(searchString) || x.lowercaseAbbreviation.startsWith(searchString) || x.abbreviation.includes(search) || x.search === x.timezone);
}

const timezoneStringToSearchableStringReplace = replaceStringsFunction({
  replace: ['/', '_'],
  replaceWith: ' '
});

export function timezoneStringToSearchableString(timezone: TimezoneString): string {
  return timezoneStringToSearchableStringReplace(timezone.toLocaleLowerCase());
}

/**
 * Returns true if the input string is a known timezone.
 *
 * @param input
 */
export function isKnownTimezone(input: string | TimezoneString): boolean {
  return allKnownTimezoneStrings().has(input);
}
