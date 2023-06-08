import { Pipe, PipeTransform } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { DateRange, formatToDayTimeRangeString } from '@dereekb/date';

@Pipe({ name: 'dateDayTimeRange' })
export class DateDayTimeRangePipe implements PipeTransform {
  transform(input: Maybe<DateRange>, unavailable: string = 'Not Available'): string {
    if (input) {
      return formatToDayTimeRangeString(input);
    } else {
      return unavailable;
    }
  }
}
