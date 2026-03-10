import { Pipe, type PipeTransform } from '@angular/core';
import { type DateOrDateString, type Maybe } from '@dereekb/util';
import { ToJsDatePipe } from './tojsdate.pipe';
import { formatDateDistance } from '@dereekb/date';

/**
 * Formats a date as a human-readable distance string relative to another date (or now) using {@link formatDateDistance}.
 *
 * Accepts an optional comparison date (defaults to now) and a fallback string for `null`/`undefined` input.
 *
 * @example
 * ```html
 * <span>{{ someDate | dateDistance }}</span>
 * <!-- Output: "3 hours ago" -->
 *
 * <span>{{ someDate | dateDistance:referenceDate }}</span>
 * <!-- Output: "2 days ago" -->
 *
 * <span>{{ nullDate | dateDistance:null:'Unknown' }}</span>
 * <!-- Output: "Unknown" -->
 * ```
 */
@Pipe({
  name: 'dateDistance',
  standalone: true,
  pure: false
})
export class DateDistancePipe implements PipeTransform {
  transform(input: Maybe<DateOrDateString>, inputTo?: Maybe<Date>, unavailable: string = 'Not Available'): string {
    if (input != null) {
      const to = inputTo ?? new Date();
      const from = ToJsDatePipe.toJsDate(input);
      return formatDateDistance(to, from);
    } else {
      return unavailable;
    }
  }
}
