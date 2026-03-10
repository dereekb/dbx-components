import { Pipe, type PipeTransform } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DateRange, formatToDayTimeRangeString } from '@dereekb/date';

/**
 * Formats a {@link DateRange} as a human-readable day and time range string using {@link formatToDayTimeRangeString}.
 *
 * Includes both the date and time portions. Returns a fallback string when the input is `null` or `undefined`.
 *
 * @example
 * ```html
 * <span>{{ dateRange | dateDayTimeRange }}</span>
 * <!-- Output: "Jan 5, 2:00 PM - Jan 8, 4:00 PM" -->
 *
 * <span>{{ nullRange | dateDayTimeRange:'No dates' }}</span>
 * <!-- Output: "No dates" -->
 * ```
 */
@Pipe({
  name: 'dateDayTimeRange',
  standalone: true,
  pure: true
})
export class DateDayTimeRangePipe implements PipeTransform {
  transform(input: Maybe<DateRange>, unavailable: string = 'Not Available'): string {
    if (input) {
      return formatToDayTimeRangeString(input);
    } else {
      return unavailable;
    }
  }
}
