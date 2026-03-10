import { Pipe, type PipeTransform } from '@angular/core';
import { type Maybe } from '@dereekb/util';

/**
 * Converts a numeric minute value into a human-readable duration string with automatic unit scaling.
 *
 * - Values over 3600 minutes are displayed as days (e.g., "~2 days")
 * - Values over 180 minutes are displayed as hours (e.g., "~4 hours")
 * - Values at or below 180 minutes are displayed as minutes (e.g., "90 minutes")
 *
 * A `~` prefix is added when the value is rounded up. Returns `undefined` for `null` or non-numeric input.
 *
 * @example
 * ```html
 * <span>{{ 90 | minutesString }}</span>
 * <!-- Output: "90 minutes" -->
 *
 * <span>{{ 250 | minutesString }}</span>
 * <!-- Output: "~5 hours" -->
 *
 * <span>{{ 5000 | minutesString }}</span>
 * <!-- Output: "~2 days" -->
 * ```
 */
@Pipe({
  name: 'minutesString',
  standalone: true,
  pure: false
})
export class MinutesStringPipe implements PipeTransform {
  transform(input: Maybe<number | string>): Maybe<string> {
    const minutes = Number(input);

    if (input != null && !isNaN(minutes)) {
      if (minutes > 3600) {
        const unrounded = minutes / 3600;
        const days = Math.ceil(unrounded);
        return (unrounded !== days ? '~' : '') + days + ' days';
      } else if (minutes > 180) {
        const unrounded = minutes / 60;
        const hours = Math.ceil(unrounded);
        return (unrounded !== hours ? '~' : '') + hours + ' hours';
      } else {
        return minutes + ' minutes';
      }
    } else {
      return undefined;
    }
  }
}
