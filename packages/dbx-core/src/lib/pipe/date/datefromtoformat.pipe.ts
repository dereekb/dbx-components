import { addMinutes } from 'date-fns';
import { Pipe, PipeTransform, LOCALE_ID, inject } from '@angular/core';
import { formatDate } from '@angular/common';
import { Maybe, DateOrDateString } from '@dereekb/util';
import { formatToTimeString, toJsDate } from '@dereekb/date';

/**
 * Pipe that takes in a date and number of minutes and outputs a formatted date.
 */
@Pipe({ name: 'dateFromPlusTo' })
export class DateFromToTimePipe implements PipeTransform {
  private locale = inject(LOCALE_ID);

  static formatFromTo(input: Maybe<DateOrDateString>, format: string, minutes: number, locale: string): Maybe<string> {
    if (input) {
      const date = toJsDate(input);
      const endDate = addMinutes(date, minutes);
      const dateString = formatDate(date, format, locale);
      return dateString + ' - ' + formatToTimeString(endDate);
    }

    return undefined;
  }

  transform(input: Maybe<DateOrDateString>, format: string, minutes: number): Maybe<string> {
    return DateFromToTimePipe.formatFromTo(input, format, minutes, this.locale);
  }
}
