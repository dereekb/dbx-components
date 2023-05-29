import { Pipe, PipeTransform } from '@angular/core';
import { Maybe, DateOrDateString } from '@dereekb/util';
import { formatDistance } from 'date-fns';
import { ToJsDatePipe } from './tojsdate.pipe';
import { TimezoneString, dateTimezoneUtcNormal } from '@dereekb/date';

/**
 * Converts the input date and timezone to a target date that represents that date/time for the timezone.
 */
@Pipe({ name: 'systemDateToTargetDate', pure: false })
export class SystemDateToTargetDatePipe implements PipeTransform {
  transform(input: Maybe<Date>, timezone: Maybe<TimezoneString>): Maybe<Date> {
    if (input && timezone) {
      return dateTimezoneUtcNormal({ timezone }).systemDateToTargetDate(input);
    } else {
      return undefined;
    }
  }
}
