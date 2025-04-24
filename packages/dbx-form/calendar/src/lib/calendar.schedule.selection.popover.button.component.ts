import { DbxScheduleSelectionCalendarDatePopoverComponent } from './calendar.schedule.selection.popover.component';
import { ChangeDetectionStrategy, Component, ElementRef, Injector, inject, viewChild } from '@angular/core';
import { DbxPopoverService, DbxButtonComponent } from '@dereekb/dbx-web';
import { map, shareReplay } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxCalendarScheduleSelectionStore } from './calendar.schedule.selection.store';
import { formatToMonthDayString } from '@dereekb/date';

@Component({
  selector: 'dbx-schedule-selection-calendar-date-popover-button',
  template: `
    <dbx-button #buttonPopoverOrigin icon="date_range" [disabled]="disabledSignal()" [raised]="true" color="accent" [text]="buttonTextSignal()" (buttonClick)="openPopover()"></dbx-button>
  `,
  imports: [DbxButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxScheduleSelectionCalendarDatePopoverButtonComponent {
  readonly injector = inject(Injector);
  readonly popoverService = inject(DbxPopoverService);
  readonly dbxCalendarScheduleSelectionStore = inject(DbxCalendarScheduleSelectionStore);

  readonly buttonPopoverOrigin = viewChild.required<string, ElementRef<HTMLButtonElement>>('buttonPopoverOrigin', { read: ElementRef });

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

  readonly disabledSignal = toSignal(this.disabled$, { initialValue: false });
  readonly buttonTextSignal = toSignal(this.buttonText$, { initialValue: 'Pick a Date Range' });

  openPopover() {
    const buttonElement = this.buttonPopoverOrigin();
    if (buttonElement) {
      DbxScheduleSelectionCalendarDatePopoverComponent.openPopover(this.popoverService, { origin: buttonElement, injector: this.injector });
    }
  }
}
