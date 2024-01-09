import { Component, Injector, Input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DbxScheduleSelectionCalendarDateDialogComponent, DbxScheduleSelectionCalendarDatePopupContentConfig } from './calendar.schedule.selection.dialog.component';
import { DbxDialogContentFooterConfig } from '@dereekb/dbx-web';
import { Maybe } from '@dereekb/util';

@Component({
  selector: 'dbx-schedule-selection-calendar-date-dialog-button',
  template: `
    <dbx-button [raised]="true" color="accent" [text]="buttonText" [disabled]="disabled" (buttonClick)="clickCustomize()"></dbx-button>
  `
})
export class DbxScheduleSelectionCalendarDateDialogButtonComponent {
  @Input()
  buttonText = 'Customize';

  @Input()
  disabled?: Maybe<boolean>;

  @Input()
  contentConfig?: Maybe<DbxScheduleSelectionCalendarDatePopupContentConfig>;

  constructor(readonly matDialog: MatDialog, readonly injector: Injector) {}

  clickCustomize() {
    DbxScheduleSelectionCalendarDateDialogComponent.openDialog(this.matDialog, { injector: this.injector, contentConfig: this.contentConfig });
  }
}
