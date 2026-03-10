import { Pipe, type PipeTransform } from '@angular/core';
import { dollarAmountString, type Maybe } from '@dereekb/util';

/**
 * Formats a numeric value as a US dollar currency string using {@link dollarAmountString}.
 *
 * Optionally accepts a default string to display when the input is `null` or `undefined`.
 *
 * @example
 * ```html
 * <span>{{ 19.5 | dollarAmount }}</span>
 * <!-- Output: "$19.50" -->
 *
 * <span>{{ nullValue | dollarAmount:'N/A' }}</span>
 * <!-- Output: "N/A" -->
 * ```
 */
@Pipe({
  name: 'dollarAmount',
  standalone: true,
  pure: true
})
export class DollarAmountPipe implements PipeTransform {
  transform(input: Maybe<number>, defaultIfNull?: Maybe<string>): Maybe<string> {
    return defaultIfNull == null || input != null ? dollarAmountString(input) : defaultIfNull;
  }
}
