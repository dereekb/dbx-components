import { Component, Injector, Input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DbxScheduleSelectionCalendarDateDialogComponent } from './calendar.schedule.selection.dialog.component';

@Component({
  selector: 'dbx-schedule-selection-calendar-date-dialog-button',
  template: `
    <button mat-raised-button color="accent" (click)="clickCustomize()">{{ buttonText }}</button>
  `
})
export class DbxScheduleSelectionCalendarDateDialogButtonComponent {
  @Input()
  buttonText = 'Customize';

  constructor(readonly matDialog: MatDialog, readonly injector: Injector) {}

  clickCustomize() {
    DbxScheduleSelectionCalendarDateDialogComponent.openDialog(this.matDialog, { injector: this.injector });
  }
}
