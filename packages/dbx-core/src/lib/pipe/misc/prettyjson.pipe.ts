import { Pipe, type PipeTransform } from '@angular/core';
import { type Maybe } from '@dereekb/util';

/**
 * Formats a value as a pretty-printed JSON string using {@link JSON.stringify} with configurable indentation.
 *
 * Returns `undefined` for falsy input. If serialization fails, returns `'ERROR'` and logs the error to the console.
 *
 * @example
 * ```html
 * <pre>{{ myObject | prettyjson }}</pre>
 * <!-- Output: formatted JSON with 2-space indentation -->
 *
 * <pre>{{ myObject | prettyjson:4 }}</pre>
 * <!-- Output: formatted JSON with 4-space indentation -->
 * ```
 */
@Pipe({
  name: 'prettyjson',
  standalone: true
})
export class PrettyJsonPipe implements PipeTransform {
  public static toPrettyJson(input: Maybe<unknown>, spacing: number = 2): Maybe<string> {
    let json: Maybe<string>;

    if (input) {
      try {
        json = JSON.stringify(input, null, spacing);
      } catch {
        console.error('prettyjson pipe failed parsing input: ', input);
        json = 'ERROR';
      }
    }

    return json;
  }

  transform(input: Maybe<unknown>, spacing?: number): Maybe<string> {
    return PrettyJsonPipe.toPrettyJson(input, spacing);
  }
}
