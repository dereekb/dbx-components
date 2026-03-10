import { addMinutes } from 'date-fns';
import { Pipe, type PipeTransform, LOCALE_ID, inject } from '@angular/core';
import { formatDate } from '@angular/common';
import { type Maybe, type DateOrDateString } from '@dereekb/util';
import { formatToTimeString, toJsDate } from '@dereekb/date';

/**
 * Formats a date as a "from - to" time range string given a start date, format string, and duration in minutes.
 *
 * The start date is formatted using the Angular locale-aware {@link formatDate}, and the end time
 * is computed by adding the given minutes and formatted as a time-only string.
 *
 * @example
 * ```html
 * <span>{{ eventStart | dateFormatFromTo:'MMM d, h:mm a':90 }}</span>
 * <!-- Output: "Jan 5, 2:00 PM - 3:30 PM" -->
 * ```
 */
@Pipe({
  name: 'dateFormatFromTo',
  standalone: true,
  pure: true
})
export class DateFormatFromToPipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  static formatFromTo(input: Maybe<DateOrDateString>, format: string, minutes: number, locale: string): Maybe<string> {
    if (input) {
      const date = toJsDate(input);
      const endDate = addMinutes(date, minutes);
      const dateString = formatDate(date, format, locale);
      return dateString + ' - ' + formatToTimeString(endDate);
    }

    return undefined;
  }

  transform(input: Maybe<DateOrDateString>, format: string, minutes: number): Maybe<string> {
    return DateFormatFromToPipe.formatFromTo(input, format, minutes, this.locale);
  }
}
