import { cachedGetter, Maybe, replaceStringsFunction, TimezoneAbbreviation, TimezoneString, TimezoneStringRef, UTC_TIMEZONE_STRING, UTCTimezoneAbbreviation } from '@dereekb/util';
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
  lowercaseAbbreviation: string;
}

export function timezoneInfoForSystem(): TimezoneInfo {
  return timezoneStringToTimezoneInfo(guessCurrentTimezone() ?? UTC_TIMEZONE_STRING);
}

export function getTimezoneAbbreviation(timezone: Maybe<TimezoneString | UTCTimezoneAbbreviation>): TimezoneAbbreviation {
  return timezone === UTC_TIMEZONE_STRING ? UTC_TIMEZONE_STRING : timezone ? formatInTimeZone(new Date(), timezone, 'zzz') : 'UKNOWN';
}

export function getTimezoneLongName(timezone: Maybe<TimezoneString>): string {
  return timezone ? formatInTimeZone(new Date(), timezone, 'zzzz') : 'Unknown Timezone';
}

export function timezoneStringToTimezoneInfo(timezone: TimezoneString): TimezoneInfo {
  const abbreviation = getTimezoneAbbreviation(timezone);
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
