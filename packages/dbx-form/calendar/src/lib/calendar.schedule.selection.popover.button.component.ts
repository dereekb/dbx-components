import { DbxScheduleSelectionCalendarDatePopoverComponent } from './calendar.schedule.selection.popover.component';
import { Component, ElementRef, Injector, ViewChild } from '@angular/core';
import { DbxPopoverService } from '@dereekb/dbx-web';
import { map, shareReplay } from 'rxjs';
import { DbxCalendarScheduleSelectionStore } from './calendar.schedule.selection.store';
import { formatToMonthDayString } from '@dereekb/date';

@Component({
  selector: 'dbx-schedule-selection-calendar-date-popover-button',
  template: `
    <dbx-button #buttonPopoverOrigin icon="date_range" [raised]="true" color="accent" [text]="buttonText$ | async" (buttonClick)="openPopover()"></dbx-button>
  `
})
export class DbxScheduleSelectionCalendarDatePopoverButtonComponent {
  @ViewChild('buttonPopoverOrigin', { read: ElementRef })
  buttonPopoverOrigin!: ElementRef;

  readonly buttonText$ = this.dbxCalendarScheduleSelectionStore.currentDateRange$.pipe(
    map((x) => {
      if (x?.start && x.end) {
        return `${formatToMonthDayString(x.start)} - ${formatToMonthDayString(x.end)}`;
      } else {
        return 'Pick a Date Range';
      }
    }),
    shareReplay(1)
  );

  constructor(readonly popoverService: DbxPopoverService, readonly dbxCalendarScheduleSelectionStore: DbxCalendarScheduleSelectionStore, readonly injector: Injector) {}

  openPopover() {
    DbxScheduleSelectionCalendarDatePopoverComponent.openPopover(this.popoverService, { origin: this.buttonPopoverOrigin, injector: this.injector });
  }
}
