import { Pipe, PipeTransform } from '@angular/core';
import { Maybe, DateOrDateString } from '@dereekb/util';
import { formatDistance } from 'date-fns';
import { ToJsDatePipe } from './tojsdate.pipe';
import { TimezoneString, dateTimezoneUtcNormal, getTimezoneAbbreviation } from '@dereekb/date';

/**
 * Converts the input date and timezone to the proper abbreviation. Uses the input date for the context, or uses now.
 */
@Pipe({ name: 'timezoneAbbreviation', pure: false })
export class TimezoneAbbreviationPipe implements PipeTransform {
  transform(timezone: Maybe<TimezoneString>, input?: Maybe<Date>): Maybe<string> {
    if (timezone) {
      return getTimezoneAbbreviation(timezone, input ?? undefined);
    } else {
      return undefined;
    }
  }
}
