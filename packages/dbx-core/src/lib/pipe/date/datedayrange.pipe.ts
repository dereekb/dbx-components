import { Pipe, type PipeTransform } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DateRange, formatToDayRangeString } from '@dereekb/date';

/**
 * Formats a {@link DateRange} as a human-readable day range string using {@link formatToDayRangeString}.
 *
 * Displays only the date portion (no times). Returns a fallback string when the input is `null` or `undefined`.
 *
 * @example
 * ```html
 * <span>{{ dateRange | dateDayRange }}</span>
 * <!-- Output: "Jan 5 - Jan 8" -->
 *
 * <span>{{ nullRange | dateDayRange:'No dates' }}</span>
 * <!-- Output: "No dates" -->
 * ```
 */
@Pipe({
  name: 'dateDayRange',
  standalone: true,
  pure: true
})
export class DateDayRangePipe implements PipeTransform {
  transform(input: Maybe<DateRange>, unavailable: string = 'Not Available'): string {
    return input ? formatToDayRangeString(input) : unavailable;
  }
}
