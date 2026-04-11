import { Pipe, type PipeTransform } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DateRange, formatToTimeRangeString } from '@dereekb/date';

/**
 * Formats a {@link DateRange} as a time-only range string using {@link formatToTimeRangeString} with the time-only flag enabled.
 *
 * Displays only the time portion (no date). Returns a fallback string when the input is `null` or `undefined`.
 *
 * @example
 * ```html
 * <span>{{ dateRange | dateTimeRangeOnly }}</span>
 * <!-- Output: "2:00 PM - 4:00 PM" -->
 *
 * <span>{{ nullRange | dateTimeRangeOnly:'TBD' }}</span>
 * <!-- Output: "TBD" -->
 * ```
 */
@Pipe({
  name: 'dateTimeRangeOnly',
  standalone: true,
  pure: true
})
export class DateTimeRangeOnlyPipe implements PipeTransform {
  transform(input: Maybe<DateRange>, unavailable: string = 'Not Available'): string {
    return input ? formatToTimeRangeString(input, undefined, true) : unavailable;
  }
}
