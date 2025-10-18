import { type EnvironmentProviders, importProvidersFrom } from '@angular/core';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory as dateAdapterFactory } from 'angular-calendar/date-adapters/date-fns';

/**
 * Provides default configuration for the DbxCalendarModule
 */
export function provideDbxCalendar() {
  const providers: EnvironmentProviders = importProvidersFrom(CalendarModule.forRoot({ provide: DateAdapter, useFactory: dateAdapterFactory }));

  return providers;
}
