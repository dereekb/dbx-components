import { Pipe, type PipeTransform } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DateRange, formatToTimeRangeString } from '@dereekb/date';

@Pipe({
  name: 'dateTimeRange',
  standalone: true,
  pure: true
})
export class DateTimeRangePipe implements PipeTransform {
  transform(input: Maybe<DateRange>, unavailable: string = 'Not Available'): string {
    if (input) {
      return formatToTimeRangeString(input);
    } else {
      return unavailable;
    }
  }
}
