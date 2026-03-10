import { Pipe, type PipeTransform, LOCALE_ID, inject } from '@angular/core';
import { formatDate } from '@angular/common';
import { formatDistanceToNow, isValid } from 'date-fns';
import { type DateOrDateString, type Maybe } from '@dereekb/util';
import { toJsDate } from '@dereekb/date';

/**
 * Formats a date using a locale-aware format string and appends the relative distance to now in parentheses.
 *
 * Returns `undefined` if the input is falsy or not a valid date.
 *
 * @example
 * ```html
 * <span>{{ someDate | dateFormatDistance:'MMM d, y' }}</span>
 * <!-- Output: "Jan 5, 2024 (3 days ago)" -->
 *
 * <span>{{ someDate | dateFormatDistance:'short':true }}</span>
 * <!-- Output: "1/5/24, 2:30 PM (about 3 days ago)" with includeSeconds enabled -->
 * ```
 */
@Pipe({
  name: 'dateFormatDistance',
  standalone: true,
  pure: false
})
export class DateFormatDistancePipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

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
