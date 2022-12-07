import { Component, ElementRef, Injector } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AbstractDialogDirective } from '@dereekb/dbx-web';

export interface DbxScheduleSelectionCalendarDatePopupConfig {
  injector: Injector;
}

@Component({
  template: `
    <dbx-dialog-content>
      <dbx-dialog-content-close (close)="close()"></dbx-dialog-content-close>
      <dbx-schedule-selection-calendar></dbx-schedule-selection-calendar>
      <dbx-dialog-content-footer closeText="Close Calendar" (close)="close()"></dbx-dialog-content-footer>
    </dbx-dialog-content>
  `
})
export class DbxScheduleSelectionCalendarDateDialogComponent extends AbstractDialogDirective<void> {
  static openDialog(matDialog: MatDialog, { injector }: DbxScheduleSelectionCalendarDatePopupConfig) {
    return matDialog.open(DbxScheduleSelectionCalendarDateDialogComponent, {
      injector,
      width: '80vw',
      minWidth: 460
    });
  }
}
