import { Pipe, PipeTransform } from '@angular/core';
import { Maybe } from '@dereekb/util';

@Pipe({ name: 'minutesString', pure: false })
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
