import { NgModule } from '@angular/core';
import { DbxScheduleSelectionCalendarComponent } from './calendar.schedule.selection.component';
import { DbxScheduleSelectionCalendarDatePopoverButtonComponent } from './calendar.schedule.selection.popover.button.component';
import { DbxScheduleSelectionCalendarDateDaysComponent } from './calendar.schedule.selection.days.component';
import { DbxScheduleSelectionCalendarDatePopoverComponent } from './calendar.schedule.selection.popover.component';
import { DbxScheduleSelectionCalendarDatePopoverContentComponent } from './calendar.schedule.selection.popover.content.component';
import { DbxScheduleSelectionCalendarDateRangeComponent } from './calendar.schedule.selection.range.component';
import { DbxScheduleSelectionCalendarDateDaysForgeFormComponent } from './field/selection/calendar.schedule.selection.days.forge.form.component';
import { DbxScheduleSelectionCalendarCellComponent } from './calendar.schedule.selection.cell.component';
import { DbxCalendarScheduleSelectionStoreInjectionBlockDirective } from './calendar.schedule.selection.store.provide';
import { DbxScheduleSelectionCalendarDateDialogComponent } from './calendar.schedule.selection.dialog.component';
import { DbxScheduleSelectionCalendarDateDialogButtonComponent } from './calendar.schedule.selection.dialog.button.component';
import { DbxScheduleSelectionCalendarSelectionToggleButtonComponent } from './calendar.schedule.selection.toggle.button.component';

const importsAndExports = [
  DbxScheduleSelectionCalendarComponent,
  DbxScheduleSelectionCalendarDateDaysComponent,
  DbxScheduleSelectionCalendarDateDaysForgeFormComponent,
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

/**
 * @deprecated Import components directly and use provideDbxForgeCalendarFieldDeclarations().
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFormCalendarModule {}
