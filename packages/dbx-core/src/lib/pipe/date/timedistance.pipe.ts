import { Pipe, type PipeTransform } from '@angular/core';
import { type Maybe, type DateOrDateString } from '@dereekb/util';
import { formatDistance, isPast } from 'date-fns';
import { ToJsDatePipe } from './tojsdate.pipe';

/**
 * Formats the distance from now to a future date as a countdown string.
 *
 * If the target date is in the past, returns the `soonString` (defaults to `"Soon"`).
 * Otherwise, returns a human-readable distance string with suffix (e.g., "in 3 hours").
 * Returns the `unavailable` string when the input is falsy.
 *
 * @dbxPipe
 * @dbxPipeSlug time-countdown-distance
 * @dbxPipeCategory date
 * @dbxPipeRelated time-distance
 * @example
 * ```html
 * <span>{{ futureDate | timeCountdownDistance }}</span>
 * <!-- Output: "in 3 hours" or "Soon" if past -->
 *
 * <span>{{ futureDate | timeCountdownDistance:'Imminent':'N/A' }}</span>
 * <!-- Output: "Imminent" if past, "N/A" if null -->
 * ```
 */
@Pipe({
  name: 'timeCountdownDistance',
  standalone: true,
  pure: false
})
export class TimeDistanceCountdownPipe implements PipeTransform {
  transform(input: Maybe<DateOrDateString>, soonString: string = 'Soon', unavailable: string = 'Not Available'): string {
    let result: string;

    if (input) {
      const from = ToJsDatePipe.toJsDate(input);

      if (isPast(from)) {
        result = soonString;
      } else {
        const to = new Date();
        result = formatDistance(from, to, {
          addSuffix: true
        });
      }
    } else {
      result = unavailable;
    }

    return result;
  }
}

/**
 * Formats the distance between a date and a reference date (defaults to now) as a human-readable string with suffix.
 *
 * Uses date-fns {@link formatDistance} to produce output like "3 hours ago" or "in 2 days".
 * Returns the `unavailable` string when the input is falsy.
 *
 * @dbxPipe
 * @dbxPipeSlug time-distance
 * @dbxPipeCategory date
 * @dbxPipeRelated date-distance, time-countdown-distance
 * @example
 * ```html
 * <span>{{ someDate | timeDistance }}</span>
 * <!-- Output: "3 hours ago" -->
 *
 * <span>{{ someDate | timeDistance:referenceDate }}</span>
 * <!-- Output: "2 days ago" (relative to referenceDate) -->
 *
 * <span>{{ nullDate | timeDistance:null:'Unknown' }}</span>
 * <!-- Output: "Unknown" -->
 * ```
 */
@Pipe({
  name: 'timeDistance',
  standalone: true,
  pure: false
})
export class TimeDistancePipe implements PipeTransform {
  transform(input: Maybe<DateOrDateString>, to?: Maybe<Date>, unavailable: string = 'Not Available'): string {
    let result: string;

    if (input) {
      const from = ToJsDatePipe.toJsDate(input);
      result = formatDistance(from, to ?? new Date(), {
        addSuffix: true
      });
    } else {
      result = unavailable;
    }

    return result;
  }
}
