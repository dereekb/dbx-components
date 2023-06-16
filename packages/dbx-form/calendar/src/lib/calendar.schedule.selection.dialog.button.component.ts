import { Component, Injector, Input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DbxScheduleSelectionCalendarDateDialogComponent } from './calendar.schedule.selection.dialog.component';
import { DbxDialogContentFooterConfig } from '@dereekb/dbx-web';
import { Maybe } from '@dereekb/util';

@Component({
  selector: 'dbx-schedule-selection-calendar-date-dialog-button',
  template: `
    <button mat-raised-button color="accent" (click)="clickCustomize()">{{ buttonText }}</button>
  `
})
export class DbxScheduleSelectionCalendarDateDialogButtonComponent {
  @Input()
  buttonText = 'Customize';

  @Input()
  closeConfig?: Maybe<DbxDialogContentFooterConfig>;

  constructor(readonly matDialog: MatDialog, readonly injector: Injector) {}

  clickCustomize() {
    DbxScheduleSelectionCalendarDateDialogComponent.openDialog(this.matDialog, { injector: this.injector, closeConfig: this.closeConfig });
  }
}
