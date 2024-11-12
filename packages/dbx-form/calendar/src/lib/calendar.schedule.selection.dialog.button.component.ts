import { Component, Injector, Input, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DbxScheduleSelectionCalendarDateDialogComponent, DbxScheduleSelectionCalendarDatePopupContentConfig } from './calendar.schedule.selection.dialog.component';
import { Maybe } from '@dereekb/util';

@Component({
  selector: 'dbx-schedule-selection-calendar-date-dialog-button',
  template: `
    <dbx-button [raised]="true" color="accent" [text]="buttonText" [disabled]="disabled" (buttonClick)="clickCustomize()"></dbx-button>
  `
})
export class DbxScheduleSelectionCalendarDateDialogButtonComponent {
  readonly injector = inject(Injector);
  readonly matDialog = inject(MatDialog);

  @Input()
  buttonText = 'Customize';

  @Input()
  disabled?: Maybe<boolean>;

  @Input()
  contentConfig?: Maybe<DbxScheduleSelectionCalendarDatePopupContentConfig>;

  clickCustomize() {
    DbxScheduleSelectionCalendarDateDialogComponent.openDialog(this.matDialog, { injector: this.injector, contentConfig: this.contentConfig });
  }
}
