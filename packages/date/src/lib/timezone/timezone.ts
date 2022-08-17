import { cachedGetter, replaceStringsFunction, TimezoneString, TimezoneStringRef, UTC_TIMEZONE_STRING } from '@dereekb/util';
import { formatInTimeZone } from 'date-fns-tz';
import { timeZonesNames } from '@vvo/tzdb';
import { guessCurrentTimezone } from '../date';

export function allTimezoneStrings(): TimezoneString[] {
  return timeZonesNames.concat(UTC_TIMEZONE_STRING);
}

export const allTimezoneInfos = cachedGetter(() => allTimezoneStrings().map(timezoneStringToTimezoneInfo));

export interface TimezoneInfo extends TimezoneStringRef {
  search: string;
  lowercase: string;
  abbreviation: string;
}

export function timezoneInfoForSystem(): TimezoneInfo {
  return timezoneStringToTimezoneInfo(guessCurrentTimezone());
}

export function timezoneStringToTimezoneInfo(timezone: TimezoneString): TimezoneInfo {
  return {
    timezone,
    search: timezoneStringToSearchableString(timezone),
    lowercase: timezone.toLowerCase(),
    abbreviation: formatInTimeZone(new Date(), timezone, 'zzz')
  };
}

export function searchTimezoneInfos(search: string, infos: TimezoneInfo[]): TimezoneInfo[] {
  const searchString = search.toLocaleLowerCase();
  return infos.filter((x) => (search.length > 2 && x.search.includes(searchString)) || x.lowercase.startsWith(searchString) || x.abbreviation.includes(search) || x.search === x.timezone);
}

const timezoneStringToSearchableStringReplace = replaceStringsFunction({
  replace: ['/', '_'],
  replaceWith: ' '
});

export function timezoneStringToSearchableString(timezone: TimezoneString): string {
  return timezoneStringToSearchableStringReplace(timezone.toLocaleLowerCase());
}
