import { Pipe, PipeTransform } from '@angular/core';
import { type Maybe } from '@dereekb/util';

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
      } catch (e) {
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
