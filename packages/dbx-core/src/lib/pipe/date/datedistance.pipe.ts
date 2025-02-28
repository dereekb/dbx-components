import { Pipe, PipeTransform } from '@angular/core';
import { DateOrDateString, type Maybe } from '@dereekb/util';
import { ToJsDatePipe } from './tojsdate.pipe';
import { formatDateDistance } from '@dereekb/date';

@Pipe({ name: 'dateDistance', pure: false })
export class DateDistancePipe implements PipeTransform {
  transform(input: Maybe<DateOrDateString>, inputTo?: Maybe<Date>, unavailable: string = 'Not Available'): string {
    if (input != null) {
      const to = inputTo ?? new Date();
      const from = ToJsDatePipe.toJsDate(input);
      return formatDateDistance(to, from);
    } else {
      return unavailable;
    }
  }
}
