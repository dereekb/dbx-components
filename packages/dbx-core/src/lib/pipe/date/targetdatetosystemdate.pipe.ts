import { Pipe, type PipeTransform } from '@angular/core';
import { type TimezoneString, type Maybe } from '@dereekb/util';
import { dateTimezoneUtcNormal } from '@dereekb/date';

/**
 * Converts a target timezone date back to the equivalent system (UTC-based) date using {@link dateTimezoneUtcNormal}.
 *
 * This is the inverse of {@link SystemDateToTargetDatePipe}. Useful when you have a date representing
 * local time in a target timezone and need to convert it back to the system timezone.
 * Returns `undefined` if either the input date or timezone is falsy.
 *
 * @dbxPipe
 * @dbxPipeSlug target-date-to-system-date
 * @dbxPipeCategory date
 * @dbxPipeRelated system-date-to-target-date, timezone-abbreviation
 * @example
 * ```html
 * <span>{{ targetDate | targetDateToSystemDate:'America/New_York' | date:'short' }}</span>
 * <!-- Output: the date/time converted back to the system timezone -->
 * ```
 */
@Pipe({
  name: 'targetDateToSystemDate',
  standalone: true,
  pure: false
})
export class TargetDateToSystemDatePipe implements PipeTransform {
  transform(input: Maybe<Date>, timezone: Maybe<TimezoneString>): Maybe<Date> {
    return input && timezone ? dateTimezoneUtcNormal({ timezone }).targetDateToSystemDate(input) : undefined;
  }
}
