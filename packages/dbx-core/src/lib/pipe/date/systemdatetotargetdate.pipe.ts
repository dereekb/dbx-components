import { Pipe, type PipeTransform } from '@angular/core';
import { type TimezoneString, type Maybe } from '@dereekb/util';
import { dateTimezoneUtcNormal } from '@dereekb/date';

/**
 * Converts a system (UTC-based) date to the equivalent local date in the given timezone using {@link dateTimezoneUtcNormal}.
 *
 * This is useful when you have a date in the system's timezone and need to display it as if it were in the target timezone.
 * Returns `undefined` if either the input date or timezone is falsy.
 *
 * @example
 * ```html
 * <span>{{ systemDate | systemDateToTargetDate:'America/New_York' | date:'short' }}</span>
 * <!-- Output: the date/time as it appears in the New York timezone -->
 * ```
 */
@Pipe({
  name: 'systemDateToTargetDate',
  standalone: true,
  pure: false
})
export class SystemDateToTargetDatePipe implements PipeTransform {
  transform(input: Maybe<Date>, timezone: Maybe<TimezoneString>): Maybe<Date> {
    return input && timezone ? dateTimezoneUtcNormal({ timezone }).systemDateToTargetDate(input) : undefined;
  }
}
