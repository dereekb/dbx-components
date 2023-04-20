import { Pipe, PipeTransform } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { DateRange, formatDateRangeDistance, FormatDateRangeDistanceFunctionConfig } from '@dereekb/date';

@Pipe({ name: 'dateTimeRangeOnlyDistance' })
export class DateTimeRangeOnlyDistancePipe implements PipeTransform {
  transform(input: Maybe<DateRange>, config?: FormatDateRangeDistanceFunctionConfig, unavailable: string = 'Not Available'): string {
    if (input) {
      return formatDateRangeDistance(input, config);
    } else {
      return unavailable;
    }
  }
}
