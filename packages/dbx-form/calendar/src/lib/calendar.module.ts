import { MatDatepickerModule } from '@angular/material/datepicker';
import { NgModule } from '@angular/core';
import { CalendarDayModule, CalendarModule, CalendarWeekModule, DateAdapter } from 'angular-calendar';
import { CommonModule } from '@angular/common';
import { DbxActionModule, DbxButtonModule, DbxPopoverInteractionModule } from '@dereekb/dbx-web';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { adapterFactory as dateAdapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { MatButtonModule } from '@angular/material/button';
import { FlexLayoutModule } from '@angular/flex-layout';
import { DbxScheduleSelectionCalendarComponent } from './calendar.schedule.selection.component';
import { DbxScheduleSelectionCalendarDatePopoverButtonComponent } from './calendar.schedule.selection.popover.button.component';
import { DbxScheduleSelectionCalendarDateDaysComponent } from './calendar.schedule.selection.days.component';
import { DbxScheduleSelectionCalendarDatePopoverComponent } from './calendar.schedule.selection.popover.component';
import { DbxScheduleSelectionCalendarDatePopoverContentComponent } from './calendar.schedule.selection.popover.content.component';
import { DbxScheduleSelectionCalendarDateRangeComponent } from './calendar.schedule.selection.range.component';
import { DbxCalendarModule } from '@dereekb/dbx-web/calendar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DbxScheduleSelectionCalendarDateDaysFormComponent } from './calendar.schedule.selection.days.form.component';
import { DbxFormlyModule, DbxFormModule } from '@dereekb/dbx-form';
import { DbxScheduleSelectionCalendarCellComponent } from './calendar.schedule.selection.cell.component';

const declarations = [
  //
  DbxScheduleSelectionCalendarComponent,
  DbxScheduleSelectionCalendarDateDaysComponent,
  DbxScheduleSelectionCalendarDateDaysFormComponent,
  DbxScheduleSelectionCalendarDateRangeComponent,
  DbxScheduleSelectionCalendarDatePopoverButtonComponent,
  DbxScheduleSelectionCalendarCellComponent,
  DbxScheduleSelectionCalendarDatePopoverComponent,
  DbxScheduleSelectionCalendarDatePopoverContentComponent
];

@NgModule({
  imports: [
    //
    DbxActionModule,
    DbxFormModule,
    DbxFormlyModule,
    DbxCalendarModule,
    CommonModule,
    MatIconModule,
    MatButtonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatButtonToggleModule,
    DbxButtonModule,
    MatDatepickerModule,
    DbxPopoverInteractionModule,
    CalendarModule,
    CalendarDayModule,
    FlexLayoutModule,
    CalendarWeekModule
  ],
  declarations,
  exports: declarations
})
export class DbxFormCalendarModule {}
