import { Pipe, type PipeTransform } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DateRange, formatToTimeRangeString } from '@dereekb/date';

/**
 * Formats a {@link DateRange} as a time range string using {@link formatToTimeRangeString}.
 *
 * Displays the date and time of both the start and end. Returns a fallback string when the input is `null` or `undefined`.
 *
 * @dbxPipe
 * @dbxPipeSlug date-time-range
 * @dbxPipeCategory date
 * @dbxPipeRelated date-time-range-only, date-day-range, date-day-time-range
 * @example
 * ```html
 * <span>{{ dateRange | dateTimeRange }}</span>
 * <!-- Output: "Jan 5, 2:00 PM - 4:00 PM" -->
 *
 * <span>{{ nullRange | dateTimeRange:'TBD' }}</span>
 * <!-- Output: "TBD" -->
 * ```
 */
@Pipe({
  name: 'dateTimeRange',
  standalone: true,
  pure: true
})
export class DateTimeRangePipe implements PipeTransform {
  transform(input: Maybe<DateRange>, unavailable: string = 'Not Available'): string {
    return input ? formatToTimeRangeString(input) : unavailable;
  }
}
