import { addMinutes } from 'date-fns';
import { Pipe, PipeTransform, Inject, LOCALE_ID } from '@angular/core';
import { formatDate } from '@angular/common';
import { Maybe, DateOrDateString } from '@dereekb/util';
import { formatToTimeString, toJsDate } from '@dereekb/date';

/**
 * Pipe that takes in a date and number of minutes and outputs a formatted date.
 */
@Pipe({ name: 'dateFromPlusTo' })
export class DateFromToTimePipe implements PipeTransform {

  static formatFromTo(input: Maybe<DateOrDateString>, format: string, minutes: number, locale: string): Maybe<string> {
    if (input) {
      const date = toJsDate(input);
      const endDate = addMinutes(date, minutes);
      const dateString = formatDate(date, format, locale);
      return dateString + ' - ' + formatToTimeString(endDate);
    }

    return undefined;
  }

  constructor(@Inject(LOCALE_ID) private locale: string) { }

  transform(input: Maybe<DateOrDateString>, format: string, minutes: number): Maybe<string> {
    return DateFromToTimePipe.formatFromTo(input, format, minutes, this.locale);
  }

}
