import { isValid } from 'date-fns';
import { Pipe, PipeTransform } from '@angular/core';
import { toJsDate } from '@dereekb/date';
import { DateOrDateString, type Maybe } from '@dereekb/util';

@Pipe({ name: 'toJsDate' })
export class ToJsDatePipe implements PipeTransform {
  public static toJsDate(input: DateOrDateString): Date;
  public static toJsDate(input: Maybe<DateOrDateString>): Maybe<Date>;
  public static toJsDate(input: Maybe<DateOrDateString>): Maybe<Date> {
    let date: Maybe<Date>;

    if (input != null) {
      date = toJsDate(input);

      if (!isValid(date)) {
        date = undefined;
      }
    }

    return date;
  }

  transform(input: Maybe<DateOrDateString>): Maybe<Date> {
    return ToJsDatePipe.toJsDate(input);
  }
}
