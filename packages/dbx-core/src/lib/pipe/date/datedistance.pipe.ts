import { Pipe, PipeTransform } from '@angular/core';
import { formatDistance, isPast, isSameDay, startOfDay } from 'date-fns';
import { DateOrDateString } from '@dereekb/util';
import { ToJsDatePipe } from './tojsdate.pipe';

@Pipe({ name: 'dateDistance', pure: false })
export class DateDistancePipe implements PipeTransform {

  transform(input: DateOrDateString | undefined, to: Date, unavailable: string = 'Not Available'): string {
    if (input) {
      const defaultTo = !to;

      if (defaultTo) {
        to = new Date();
      }

      const from = ToJsDatePipe.toJsDate(input)!;

      const fromStart = startOfDay(from);
      const toStart = startOfDay(to);

      if (isSameDay(fromStart, toStart)) {
        let text;

        if (defaultTo || isSameDay(from, new Date())) {
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
