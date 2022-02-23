import { Pipe, PipeTransform } from '@angular/core';
import { formatDistance, isPast, isSameDay, startOfDay } from 'date-fns';
import { DateOrDateString, Maybe } from '@dereekb/util';
import { ToJsDatePipe } from './tojsdate.pipe';

@Pipe({ name: 'dateDistance', pure: false })
export class DateDistancePipe implements PipeTransform {

  transform(input: Maybe<DateOrDateString>, to?: Maybe<Date>, unavailable: string = 'Not Available'): string {
    if (input) {
      const useDefaultTo: boolean = !to;

      if (useDefaultTo) {
        to = new Date();
      }

      const from = ToJsDatePipe.toJsDate(input)!;

      const fromStart = startOfDay(from);
      const toStart = startOfDay(to!);

      if (isSameDay(fromStart, toStart)) {
        let text;

        if (useDefaultTo || isSameDay(from, new Date())) {
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
