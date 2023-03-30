import { Pipe, PipeTransform } from '@angular/core';
import { formatDistance, isSameDay, startOfDay } from 'date-fns';
import { DateOrDateString, Maybe } from '@dereekb/util';
import { ToJsDatePipe } from './tojsdate.pipe';
import { DateRange, formatToDayRangeString, formatToTimeRangeString } from '@dereekb/date';

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