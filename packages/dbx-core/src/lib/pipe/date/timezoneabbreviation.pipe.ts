import { Pipe, type PipeTransform } from '@angular/core';
import { type TimezoneString, type Maybe } from '@dereekb/util';
import { getTimezoneAbbreviation } from '@dereekb/date';

/**
 * Returns the abbreviated name for a timezone string (e.g., "EST", "PDT") using {@link getTimezoneAbbreviation}.
 *
 * Optionally accepts a reference date to determine the correct abbreviation (e.g., for daylight saving time).
 * Defaults to the current date if no reference date is provided.
 * Returns `undefined` if the timezone is falsy.
 *
 * @dbxPipe
 * @dbxPipeSlug timezone-abbreviation
 * @dbxPipeCategory date
 * @dbxPipeRelated system-date-to-target-date, target-date-to-system-date
 * @example
 * ```html
 * <span>{{ 'America/New_York' | timezoneAbbreviation }}</span>
 * <!-- Output: "EST" or "EDT" depending on the current date -->
 *
 * <span>{{ timezone | timezoneAbbreviation:referenceDate }}</span>
 * <!-- Output: abbreviation for the timezone at the given reference date -->
 * ```
 */
@Pipe({
  name: 'timezoneAbbreviation',
  standalone: true,
  pure: false
})
export class TimezoneAbbreviationPipe implements PipeTransform {
  transform(timezone: Maybe<TimezoneString>, input?: Maybe<Date>): Maybe<string> {
    return timezone ? getTimezoneAbbreviation(timezone, input ?? undefined) : undefined;
  }
}
