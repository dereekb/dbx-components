import { Pipe, PipeTransform } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { TimezoneString, dateTimezoneUtcNormal } from '@dereekb/date';

/**
 * Converts the input date and timezone to a system date that represents that date/time.
 */
@Pipe({
  name: 'targetDateToSystemDate',
  standalone: true,
  pure: false
})
export class TargetDateToSystemDatePipe implements PipeTransform {
  transform(input: Maybe<Date>, timezone: Maybe<TimezoneString>): Maybe<Date> {
    if (input && timezone) {
      return dateTimezoneUtcNormal({ timezone }).targetDateToSystemDate(input);
    } else {
      return undefined;
    }
  }
}
