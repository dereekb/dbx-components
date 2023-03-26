import { Pipe, PipeTransform } from '@angular/core';
import { formatDistance, isSameDay, startOfDay } from 'date-fns';
import { DateOrDateString, Maybe } from '@dereekb/util';
import { ToJsDatePipe } from './tojsdate.pipe';
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
