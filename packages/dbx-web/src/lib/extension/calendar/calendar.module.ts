import { NgModule } from '@angular/core';
import { DbxCalendarComponent } from './calendar.component';
import { CalendarDayModule, CalendarModule, CalendarWeekModule, DateAdapter } from 'angular-calendar';
import { CommonModule } from '@angular/common';
import { DbxButtonModule } from '../../button/button.module';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { adapterFactory as dateAdapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { MatButtonModule } from '@angular/material/button';
import { FlexLayoutModule } from '@angular/flex-layout';

const declarations = [DbxCalendarComponent];

@NgModule({
  declarations,
  imports: [
    //
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    CalendarModule,
    CalendarDayModule,
    FlexLayoutModule,
    CalendarWeekModule,
    DbxButtonModule
  ],
  exports: declarations
})
export class DbxCalendarModule {}

/**
 * Provides default configuration for the DbxCalendarModule
 */
@NgModule({
  imports: [CalendarModule.forRoot({ provide: DateAdapter, useFactory: dateAdapterFactory })],
  exports: [DbxCalendarModule]
})
export class DbxCalendarRootModule {}
