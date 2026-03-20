import { type Provider } from '@angular/core';
import { DateAdapter, provideCalendar } from 'angular-calendar';
import { adapterFactory as dateAdapterFactory } from 'angular-calendar/date-adapters/date-fns';

/**
 * Provides default configuration for the DbxCalendarModule
 *
 * @returns Providers that register the calendar with a date-fns date adapter.
 */
export function provideDbxCalendar(): Provider[] {
  return provideCalendar({ provide: DateAdapter, useFactory: dateAdapterFactory });
}
