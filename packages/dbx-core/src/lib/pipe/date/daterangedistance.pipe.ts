import { Pipe, type PipeTransform } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DateRange, formatDateDistance } from '@dereekb/date';

/**
 * Formats a {@link Date} or {@link DateRange} as a human-readable distance string relative to now using {@link formatDateDistance}.
 *
 * This is an impure pipe that recalculates on every change detection cycle to keep the distance up to date.
 * Returns a fallback string when the input is `null` or `undefined`.
 *
 * @dbxPipe
 * @dbxPipeSlug date-range-distance
 * @dbxPipeCategory date
 * @dbxPipeRelated date-distance
 * @example
 * ```html
 * <span>{{ someDate | dateRangeDistance }}</span>
 * <!-- Output: "3 hours ago" -->
 *
 * <span>{{ nullDate | dateRangeDistance:'Unknown' }}</span>
 * <!-- Output: "Unknown" -->
 * ```
 */
@Pipe({
  name: 'dateRangeDistance',
  standalone: true,
  pure: false
})
export class DateRangeDistancePipe implements PipeTransform {
  transform(input: Maybe<Date | DateRange>, unavailable: string = 'Not Available'): string {
    return input != null ? formatDateDistance(input as Date, new Date()) : unavailable;
  }
}
