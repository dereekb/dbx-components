import { Pipe, type PipeTransform } from '@angular/core';
import { cutString, type Maybe } from '@dereekb/util';

/**
 * Truncates the input string to a maximum length and appends an ellipsis (or custom suffix) using {@link cutString}.
 *
 * Returns the original value if the input is `null` or `undefined`.
 *
 * @dbxPipe
 * @dbxPipeSlug cut-text
 * @dbxPipeCategory value
 * @dbxPipeSkillRefs dbx-value-pipes
 * @example
 * ```html
 * <span>{{ 'Hello World' | cutText:8 }}</span>
 * <!-- Output: "Hello..." -->
 *
 * <span>{{ 'Hello World' | cutText:8:'…' }}</span>
 * <!-- Output: "Hello W…" -->
 * ```
 * @param maxLength Maximum allowed length before truncation, including the end text.
 * @param endText Suffix appended when truncation occurs. Defaults to "..." when undefined; null appends nothing.
 */
@Pipe({
  name: 'cutText',
  pure: true
})
export class CutTextPipe implements PipeTransform {
  transform(input: Maybe<string>, maxLength: number, endText?: Maybe<string>): Maybe<string> {
    return input == null ? input : cutString(input, maxLength, endText);
  }
}
