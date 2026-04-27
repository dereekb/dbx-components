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
 * <span>{{ 'Hello World' | cutText:5 }}</span>
 * <!-- Output: "Hello..." -->
 *
 * <span>{{ longText | cutText:20:'--' }}</span>
 * <!-- Output: "Some long text here--" -->
 * ```
 * @param maxLength Maximum allowed length before truncation.
 * @param endText Suffix appended when truncation occurs.
 */
@Pipe({
  name: 'cutText',
  standalone: true,
  pure: true
})
export class CutTextPipe implements PipeTransform {
  transform(input: Maybe<string>, maxLength: number, endText?: Maybe<string>): Maybe<string> {
    return input != null ? cutString(input, maxLength, endText) : input;
  }
}
