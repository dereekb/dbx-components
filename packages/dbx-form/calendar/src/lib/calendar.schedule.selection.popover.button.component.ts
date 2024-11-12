import { DbxScheduleSelectionCalendarDatePopoverComponent } from './calendar.schedule.selection.popover.component';
import { Component, ElementRef, Injector, ViewChild, inject } from '@angular/core';
import { DbxPopoverService } from '@dereekb/dbx-web';
import { map, shareReplay } from 'rxjs';
import { DbxCalendarScheduleSelectionStore } from './calendar.schedule.selection.store';
import { formatToMonthDayString } from '@dereekb/date';

@Component({
  selector: 'dbx-schedule-selection-calendar-date-popover-button',
  template: `
    <dbx-button #buttonPopoverOrigin icon="date_range" [disabled]="disabled$ | async" [raised]="true" color="accent" [text]="buttonText$ | async" (buttonClick)="openPopover()"></dbx-button>
  `
})
export class DbxScheduleSelectionCalendarDatePopoverButtonComponent {
  readonly injector = inject(Injector);
  readonly popoverService = inject(DbxPopoverService);
  readonly dbxCalendarScheduleSelectionStore = inject(DbxCalendarScheduleSelectionStore);

  @ViewChild('buttonPopoverOrigin', { read: ElementRef })
  buttonPopoverOrigin!: ElementRef;

  readonly disabled$ = this.dbxCalendarScheduleSelectionStore.isViewReadonly$;

  readonly buttonText$ = this.dbxCalendarScheduleSelectionStore.currentDateRange$.pipe(
    map((x) => {
      if (x?.start && x.end) {
        const startString = formatToMonthDayString(x.start);
        const endString = formatToMonthDayString(x.end);
        return startString === endString ? startString : `${formatToMonthDayString(x.start)} - ${formatToMonthDayString(x.end)}`;
      } else {
        return 'Pick a Date Range';
      }
    }),
    shareReplay(1)
  );

  openPopover() {
    DbxScheduleSelectionCalendarDatePopoverComponent.openPopover(this.popoverService, { origin: this.buttonPopoverOrigin, injector: this.injector });
  }
}
