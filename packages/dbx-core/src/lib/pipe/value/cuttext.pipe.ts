import { Pipe, PipeTransform } from '@angular/core';
import { cutString, type Maybe } from '@dereekb/util';

/**
 * Pipe that cuts the input text to the requested length and adds elipsis.
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
