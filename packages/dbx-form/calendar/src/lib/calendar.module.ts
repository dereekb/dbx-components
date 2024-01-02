import { MatDatepickerModule } from '@angular/material/datepicker';
import { NgModule } from '@angular/core';
import { CalendarDayModule, CalendarModule, CalendarWeekModule } from 'angular-calendar';
import { CommonModule } from '@angular/common';
import { DbxActionModule, DbxButtonModule, DbxContentLayoutModule, DbxDialogInteractionModule, DbxPopoverInteractionModule, DbxTextModule } from '@dereekb/dbx-web';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { DbxScheduleSelectionCalendarComponent } from './calendar.schedule.selection.component';
import { DbxScheduleSelectionCalendarDatePopoverButtonComponent } from './calendar.schedule.selection.popover.button.component';
import { DbxScheduleSelectionCalendarDateDaysComponent } from './calendar.schedule.selection.days.component';
import { DbxScheduleSelectionCalendarDatePopoverComponent } from './calendar.schedule.selection.popover.component';
import { DbxScheduleSelectionCalendarDatePopoverContentComponent } from './calendar.schedule.selection.popover.content.component';
import { DbxScheduleSelectionCalendarDateRangeComponent } from './calendar.schedule.selection.range.component';
import { DbxCalendarModule } from '@dereekb/dbx-web/calendar';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DbxScheduleSelectionCalendarDateDaysFormComponent } from './calendar.schedule.selection.days.form.component';
import { DbxFormlyModule, DbxFormModule } from '@dereekb/dbx-form';
import { DbxScheduleSelectionCalendarCellComponent } from './calendar.schedule.selection.cell.component';
import { DbxCalendarScheduleSelectionStoreInjectionBlockDirective } from './calendar.schedule.selection.store.provide';
import { DbxScheduleSelectionCalendarDateDialogComponent } from './calendar.schedule.selection.dialog.component';
import { DbxScheduleSelectionCalendarDateDialogButtonComponent } from './calendar.schedule.selection.dialog.button.component';
import { DbxScheduleSelectionCalendarSelectionToggleButtonComponent } from './calendar.schedule.selection.toggle.button.component';
import { DbxDatePipeModule, DbxInjectionComponentModule } from '@dereekb/dbx-core';

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
  DbxScheduleSelectionCalendarDateDialogButtonComponent,
  DbxScheduleSelectionCalendarSelectionToggleButtonComponent
];

@NgModule({
  imports: [
    //
    DbxInjectionComponentModule,
    DbxContentLayoutModule,
    DbxTextModule,
    DbxActionModule,
    DbxFormModule,
    DbxFormlyModule,
    DbxCalendarModule,
    CommonModule,
    MatIconModule,
    MatButtonModule,
    FormsModule,
    ReactiveFormsModule,
    MatLegacyFormFieldModule,
    MatButtonToggleModule,
    DbxButtonModule,
    MatDatepickerModule,
    DbxDialogInteractionModule,
    DbxPopoverInteractionModule,
    CalendarModule,
    CalendarDayModule,
    FlexLayoutModule,
    CalendarWeekModule,
    DbxDatePipeModule
  ],
  declarations,
  exports: declarations
})
export class DbxFormCalendarModule {}
