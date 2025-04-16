import { ChangeDetectionStrategy, Component, Injector, inject, input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DbxScheduleSelectionCalendarDateDialogComponent, DbxScheduleSelectionCalendarDatePopupContentConfig } from './calendar.schedule.selection.dialog.component';
import { type Maybe } from '@dereekb/util';
import { DbxButtonComponent } from '@dereekb/dbx-web';

@Component({
  selector: 'dbx-schedule-selection-calendar-date-dialog-button',
  template: `
    <dbx-button [raised]="true" color="accent" [text]="buttonText()" [disabled]="disabled()" (buttonClick)="clickCustomize()"></dbx-button>
  `,
  imports: [DbxButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxScheduleSelectionCalendarDateDialogButtonComponent {
  readonly injector = inject(Injector);
  readonly matDialog = inject(MatDialog);

  readonly buttonText = input<string>('Customize');

  readonly disabled = input<Maybe<boolean>>();

  readonly contentConfig = input<Maybe<DbxScheduleSelectionCalendarDatePopupContentConfig>>();

  clickCustomize() {
    DbxScheduleSelectionCalendarDateDialogComponent.openDialog(this.matDialog, { injector: this.injector, contentConfig: this.contentConfig() });
  }
}
