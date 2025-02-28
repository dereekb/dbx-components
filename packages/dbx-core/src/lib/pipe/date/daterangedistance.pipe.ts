import { Pipe, PipeTransform } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DateRange, formatDateDistance } from '@dereekb/date';

@Pipe({ name: 'dateRangeDistance', pure: false })
export class DateRangeDistancePipe implements PipeTransform {
  transform(input: Maybe<Date | DateRange>, unavailable: string = 'Not Available'): string {
    if (input != null) {
      return formatDateDistance(input as Date, new Date());
    } else {
      return unavailable;
    }
  }
}
