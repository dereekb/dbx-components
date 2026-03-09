import { Pipe, type PipeTransform } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DateRange, formatToDayTimeRangeString } from '@dereekb/date';

@Pipe({
  name: 'dateDayTimeRange',
  standalone: true,
  pure: true
})
export class DateDayTimeRangePipe implements PipeTransform {
  transform(input: Maybe<DateRange>, unavailable: string = 'Not Available'): string {
    if (input) {
      return formatToDayTimeRangeString(input);
    } else {
      return unavailable;
    }
  }
}
