import { Pipe, PipeTransform } from '@angular/core';
import { toJsDate } from '@dereekb/date';
import { DateOrDateString, Maybe } from '@dereekb/util';

@Pipe({ name: 'toJsDate' })
export class ToJsDatePipe implements PipeTransform {

  public static toJsDate(input: Maybe<DateOrDateString>): Maybe<Date> {
    return (input) ? toJsDate(input) : undefined;
  }

  transform(input: Maybe<DateOrDateString>): Maybe<Date> {
    return ToJsDatePipe.toJsDate(input);
  }

}
