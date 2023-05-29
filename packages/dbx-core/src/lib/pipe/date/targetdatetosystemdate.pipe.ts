import { Pipe, PipeTransform } from '@angular/core';
import { Maybe, DateOrDateString } from '@dereekb/util';
import { formatDistance } from 'date-fns';
import { ToJsDatePipe } from './tojsdate.pipe';
import { TimezoneString, dateTimezoneUtcNormal } from '@dereekb/date';

/**
 * Converts the input date and timezone to a system date that represents that date/time.
 */
@Pipe({ name: 'targetDateToSystemDate', pure: false })
export class TargetDateToSystemDatePipe implements PipeTransform {
  transform(input: Maybe<Date>, timezone: Maybe<TimezoneString>): Maybe<Date> {
    if (input && timezone) {
      return dateTimezoneUtcNormal({ timezone }).targetDateToSystemDate(input);
    } else {
      return undefined;
    }
  }
}
