import { Pipe, type PipeTransform } from '@angular/core';
import { type Maybe, type Minutes, MINUTES_IN_DAY, MINUTES_IN_HOUR } from '@dereekb/util';

/**
 * Converts a numeric minute value into a human-readable duration string with automatic unit scaling.
 *
 * - Values over 3600 minutes are displayed as days (e.g., "~2 days")
 * - Values over 180 minutes are displayed as hours (e.g., "~4 hours")
 * - Values at or below 180 minutes are displayed as minutes (e.g., "90 minutes")
 *
 * A `~` prefix is added when the value is rounded up. Returns `undefined` for `null` or non-numeric input.
 *
 * @dbxPipe
 * @dbxPipeSlug minutes-string
 * @dbxPipeCategory date
 * @dbxPipeRelated to-minutes
 * @example
 * ```html
 * <span>{{ 90 | minutesString }}</span>
 * <!-- Output: "90 minutes" -->
 *
 * <span>{{ 250 | minutesString }}</span>
 * <!-- Output: "~5 hours" -->
 *
 * <span>{{ 5000 | minutesString }}</span>
 * <!-- Output: "~4 days" -->
 * ```
 */
@Pipe({
  name: 'minutesString',
  standalone: true,
  pure: false
})
export class MinutesStringPipe implements PipeTransform {
  transform(input: Maybe<Minutes | string>): Maybe<string> {
    const minutes = Number(input);

    let result: Maybe<string>;

    if (input != null && !isNaN(minutes)) {
      if (minutes > MINUTES_IN_DAY * 2.5) {
        const unrounded = minutes / MINUTES_IN_DAY;
        const days = Math.ceil(unrounded);
        result = (unrounded !== days ? '~' : '') + days + ' days';
      } else if (minutes > MINUTES_IN_HOUR * 3) {
        const unrounded = minutes / MINUTES_IN_HOUR;
        const hours = Math.ceil(unrounded);
        result = (unrounded !== hours ? '~' : '') + hours + ' hours';
      } else {
        result = minutes + ' minutes';
      }
    }

    return result;
  }
}
