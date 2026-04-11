import { Pipe, type PipeTransform } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DateRange, formatDateRangeDistance, type FormatDateRangeDistanceFunctionConfig } from '@dereekb/date';

/**
 * Formats a {@link DateRange} as a human-readable distance string using {@link formatDateRangeDistance}.
 *
 * Accepts an optional {@link FormatDateRangeDistanceFunctionConfig} to customize the output format.
 * Returns a fallback string when the input is `null` or `undefined`.
 *
 * @example
 * ```html
 * <span>{{ dateRange | dateTimeRangeOnlyDistance }}</span>
 * <!-- Output: "3 hours" -->
 *
 * <span>{{ dateRange | dateTimeRangeOnlyDistance:config }}</span>
 * <!-- Output varies based on config -->
 *
 * <span>{{ nullRange | dateTimeRangeOnlyDistance:null:'TBD' }}</span>
 * <!-- Output: "TBD" -->
 * ```
 */
@Pipe({
  name: 'dateTimeRangeOnlyDistance',
  standalone: true,
  pure: true
})
export class DateTimeRangeOnlyDistancePipe implements PipeTransform {
  transform(input: Maybe<DateRange>, config?: FormatDateRangeDistanceFunctionConfig, unavailable: string = 'Not Available'): string {
    return input ? formatDateRangeDistance(input, { ...config }) : unavailable;
  }
}
