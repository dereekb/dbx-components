import { Pipe, type PipeTransform } from '@angular/core';
import { type Milliseconds, type Minutes, millisecondsToMinutes } from '@dereekb/util';

/**
 * Converts a duration in milliseconds to whole minutes using {@link millisecondsToMinutes}.
 *
 * Returns the original value (0 or falsy) if the input is falsy.
 *
 * @dbxPipe
 * @dbxPipeSlug to-minutes
 * @dbxPipeCategory date
 * @dbxPipeRelated minutes-string
 * @example
 * ```html
 * <span>{{ 180000 | toMinutes }}</span>
 * <!-- Output: 3 -->
 *
 * <span>{{ durationMs | toMinutes }} min</span>
 * <!-- Output: "5 min" -->
 * ```
 */
@Pipe({
  name: 'toMinutes',
  standalone: true,
  pure: true
})
export class ToMinutesPipe implements PipeTransform {
  transform(milliseconds: Milliseconds): Minutes {
    let result: Minutes = milliseconds;

    if (milliseconds) {
      result = millisecondsToMinutes(milliseconds);
    }

    return result;
  }
}
