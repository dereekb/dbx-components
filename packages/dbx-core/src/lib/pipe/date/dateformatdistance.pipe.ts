import { Pipe, PipeTransform, LOCALE_ID, inject } from '@angular/core';
import { formatDate } from '@angular/common';
import { formatDistanceToNow, isValid } from 'date-fns';
import { DateOrDateString, type Maybe } from '@dereekb/util';
import { toJsDate } from '@dereekb/date';

/**
 * Pipe that takes in a date and appends the distance to it in parenthesis.
 */
@Pipe({ name: 'dateFormatDistance', pure: false })
export class DateFormatDistancePipe implements PipeTransform {
  private locale = inject(LOCALE_ID);

  transform(input: Maybe<DateOrDateString>, format: string, includeSeconds = false): Maybe<string> {
    if (input) {
      const date = toJsDate(input);

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
