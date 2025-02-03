import { Pipe, PipeTransform } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DateRange, formatToTimeRangeString } from '@dereekb/date';

@Pipe({ name: 'dateTimeRangeOnly' })
export class DateTimeRangeOnlyPipe implements PipeTransform {
  transform(input: Maybe<DateRange>, unavailable: string = 'Not Available'): string {
    if (input) {
      return formatToTimeRangeString(input, undefined, true);
    } else {
      return unavailable;
    }
  }
}
