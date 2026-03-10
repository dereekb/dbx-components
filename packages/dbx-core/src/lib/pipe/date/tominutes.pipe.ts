import { Pipe, type PipeTransform } from '@angular/core';

/**
 * Converts a duration in milliseconds to whole minutes by dividing by 60,000 and flooring the result.
 *
 * Returns the original value (0 or falsy) if the input is falsy.
 *
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
  transform(milliseconds: number): number {
    if (milliseconds) {
      return Math.floor(milliseconds / (60 * 1000));
    }

    return milliseconds;
  }
}
