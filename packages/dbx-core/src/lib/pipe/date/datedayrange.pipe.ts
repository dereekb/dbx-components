import { Pipe, PipeTransform } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DateRange, formatToDayRangeString } from '@dereekb/date';

@Pipe({ name: 'dateDayRange' })
export class DateDayRangePipe implements PipeTransform {
  transform(input: Maybe<DateRange>, unavailable: string = 'Not Available'): string {
    if (input) {
      return formatToDayRangeString(input);
    } else {
      return unavailable;
    }
  }
}
