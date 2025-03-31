import { Pipe, PipeTransform } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { TimezoneString, getTimezoneAbbreviation } from '@dereekb/date';

/**
 * Converts the input date and timezone to the proper abbreviation. Uses the input date for the context, or uses now.
 */
@Pipe({
  name: 'timezoneAbbreviation',
  standalone: true,
  pure: false
})
export class TimezoneAbbreviationPipe implements PipeTransform {
  transform(timezone: Maybe<TimezoneString>, input?: Maybe<Date>): Maybe<string> {
    if (timezone) {
      return getTimezoneAbbreviation(timezone, input ?? undefined);
    } else {
      return undefined;
    }
  }
}
