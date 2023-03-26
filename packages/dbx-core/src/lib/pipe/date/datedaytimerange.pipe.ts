import { Pipe, PipeTransform } from '@angular/core';
import { formatDistance, isSameDay, startOfDay } from 'date-fns';
import { DateOrDateString, Maybe } from '@dereekb/util';
import { ToJsDatePipe } from './tojsdate.pipe';
import { DateRange, formatToDayRangeString, formatToDayTimeRangeString, formatToTimeRangeString } from '@dereekb/date';

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
