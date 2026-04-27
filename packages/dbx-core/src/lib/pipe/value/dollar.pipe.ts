import { Pipe, type PipeTransform } from '@angular/core';
import { dollarAmountString, type Maybe } from '@dereekb/util';

/**
 * Formats a numeric value as a US dollar currency string using {@link dollarAmountString}.
 *
 * Optionally accepts a default string to display when the input is `null` or `undefined`.
 *
 * @dbxPipe
 * @dbxPipeSlug dollar-amount
 * @dbxPipeCategory value
 * @dbxPipeSkillRefs dbx-value-pipes
 * @example
 * ```html
 * <span>{{ 19.5 | dollarAmount }}</span>
 * <!-- Output: "$19.50" -->
 *
 * <span>{{ nullValue | dollarAmount:'N/A' }}</span>
 * <!-- Output: "N/A" -->
 * ```
 * @param defaultIfNull String to display when the input is `null` or `undefined`. Defaults to formatting `null` through `dollarAmountString`.
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
