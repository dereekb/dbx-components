import { Pipe, PipeTransform, Inject, LOCALE_ID } from '@angular/core';
import { formatDate } from '@angular/common';
import { formatDistanceToNow, isValid } from 'date-fns';
import { DateOrDateString, Maybe } from '@dereekb/util';
import { toJsDate } from '@dereekb/date';

/**
 * Pipe that takes in a date and appends the distance to it in parenthesis.
 */
@Pipe({ name: 'dateFormatDistance', pure: false })
export class DateFormatDistancePipe implements PipeTransform {

  constructor(@Inject(LOCALE_ID) private locale: string) { }

  transform(input: Maybe<DateOrDateString>, format: string, includeSeconds = false): Maybe<string> {
    if (input) {
      const date = toJsDate(input)!;

      if (isValid(date)) {

        const dateString = formatDate(date, format, this.locale);

        const distance = formatDistanceToNow(date, {
          includeSeconds,
          addSuffix: true
        });

        return `${dateString} (${distance})`;
      }
    }

    return undefined;
  }

}
