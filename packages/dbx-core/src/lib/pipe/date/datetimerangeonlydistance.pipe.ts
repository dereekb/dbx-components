import { Pipe, type PipeTransform } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DateRange, formatDateRangeDistance, type FormatDateRangeDistanceFunctionConfig } from '@dereekb/date';

@Pipe({
  name: 'dateTimeRangeOnlyDistance',
  standalone: true,
  pure: true
})
export class DateTimeRangeOnlyDistancePipe implements PipeTransform {
  transform(input: Maybe<DateRange>, config?: FormatDateRangeDistanceFunctionConfig, unavailable: string = 'Not Available'): string {
    if (input) {
      return formatDateRangeDistance(input, { ...config });
    } else {
      return unavailable;
    }
  }
}
