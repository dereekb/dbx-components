import { MatDatepickerModule } from '@angular/material/datepicker';
import { NgModule } from '@angular/core';
import { CalendarDayModule, CalendarModule, CalendarWeekModule } from 'angular-calendar';
import { CommonModule } from '@angular/common';
import { DbxActionModule, DbxButtonModule, DbxDialogInteractionModule, DbxPopoverInteractionModule } from '@dereekb/dbx-web';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
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
import { DbxCalendarScheduleSelectionStoreInjectionBlockDirective } from './calendar.schedule.selection.store.provide';
import { DbxScheduleSelectionCalendarDateDialogComponent } from './calendar.schedule.selection.dialog.component';
import { DbxScheduleSelectionCalendarDateDialogButtonComponent } from './calendar.schedule.selection.dialog.button.component';

const declarations = [
  //
  DbxScheduleSelectionCalendarComponent,
  DbxScheduleSelectionCalendarDateDaysComponent,
  DbxScheduleSelectionCalendarDateDaysFormComponent,
  DbxScheduleSelectionCalendarDateRangeComponent,
  DbxScheduleSelectionCalendarDatePopoverButtonComponent,
  DbxScheduleSelectionCalendarCellComponent,
  DbxScheduleSelectionCalendarDatePopoverComponent,
  DbxScheduleSelectionCalendarDatePopoverContentComponent,
  DbxCalendarScheduleSelectionStoreInjectionBlockDirective,
  DbxScheduleSelectionCalendarDateDialogComponent,
  DbxScheduleSelectionCalendarDateDialogButtonComponent
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
    DbxDialogInteractionModule,
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