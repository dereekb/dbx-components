import { isValid } from 'date-fns';
import { Pipe, type PipeTransform } from '@angular/core';
import { toJsDate } from '@dereekb/date';
import { type DateOrDateString, type Maybe } from '@dereekb/util';

/**
 * Converts a {@link DateOrDateString} value to a JavaScript {@link Date} object using {@link toJsDate}.
 *
 * Returns `undefined` if the input is `null`, `undefined`, or results in an invalid date.
 * Also provides a static `toJsDate()` method used by other pipes in this package.
 *
 * @example
 * ```html
 * <span>{{ '2024-01-05T12:00:00Z' | toJsDate | date:'short' }}</span>
 * <!-- Output: "1/5/24, 12:00 PM" -->
 *
 * <span>{{ dateOrString | toJsDate | date:'fullDate' }}</span>
 * ```
 */
@Pipe({
  name: 'toJsDate',
  standalone: true,
  pure: true
})
export class ToJsDatePipe implements PipeTransform {
  public static toJsDate(input: DateOrDateString): Date;
  public static toJsDate(input: Maybe<DateOrDateString>): Maybe<Date>;
  public static toJsDate(input: Maybe<DateOrDateString>): Maybe<Date> {
    let date: Maybe<Date>;

    if (input != null) {
      date = toJsDate(input);

      if (!isValid(date)) {
        date = undefined;
      }
    }

    return date;
  }

  transform(input: Maybe<DateOrDateString>): Maybe<Date> {
    return ToJsDatePipe.toJsDate(input);
  }
}
