import { Pipe, PipeTransform } from '@angular/core';
import { formatDistance, isSameDay, startOfDay } from 'date-fns';
import { DateOrDateString, Maybe } from '@dereekb/util';
import { ToJsDatePipe } from './tojsdate.pipe';

@Pipe({ name: 'dateDistance', pure: false })
export class DateDistancePipe implements PipeTransform {

  transform(input: Maybe<DateOrDateString>, inputTo?: Maybe<Date>, unavailable: string = 'Not Available'): string {
    if (input) {
      const to = inputTo ?? new Date();
      const from = ToJsDatePipe.toJsDate(input);

      const fromStart = startOfDay(from);
      const toStart = startOfDay(to);

      if (isSameDay(fromStart, toStart)) {
        let text;

        if (!inputTo || isSameDay(from, new Date())) {
          text = 'Today';
        } else {
          text = 'Same Day';
        }

        return text;
      } else {
        return formatDistance(fromStart, toStart, {
          addSuffix: true
        });
      }
    } else {
      return unavailable;
    }
  }

}
