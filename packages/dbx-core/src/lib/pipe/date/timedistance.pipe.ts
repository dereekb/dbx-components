import { Pipe, PipeTransform } from '@angular/core';
import { Maybe, DateOrDateString } from '@dereekb/util';
import { formatDistance, isPast } from 'date-fns';
import { ToJsDatePipe } from './tojsdate.pipe';

@Pipe({ name: 'timeCountdownDistance', pure: false })
export class TimeDistanceCountdownPipe implements PipeTransform {
  transform(input: Maybe<DateOrDateString>, soonString: string = 'Soon', unavailable: string = 'Not Available'): string {
    if (input) {
      const from = ToJsDatePipe.toJsDate(input);

      if (isPast(from)) {
        return soonString;
      } else {
        const to = new Date();
        return formatDistance(from, to, {
          addSuffix: true
        });
      }
    } else {
      return unavailable;
    }
  }
}

@Pipe({ name: 'timeDistance', pure: false })
export class TimeDistancePipe implements PipeTransform {
  transform(input: Maybe<DateOrDateString>, to: Date = new Date(), unavailable: string = 'Not Available'): string {
    if (input) {
      const from = ToJsDatePipe.toJsDate(input);
      return formatDistance(from, to, {
        addSuffix: true
      });
    } else {
      return unavailable;
    }
  }
}
