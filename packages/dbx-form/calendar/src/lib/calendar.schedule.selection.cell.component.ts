import { Component, Input, ChangeDetectionStrategy, inject } from '@angular/core';
import { CalendarMonthViewDay } from 'angular-calendar';
import { first } from 'rxjs';
import { DbxCalendarScheduleSelectionStore } from './calendar.schedule.selection.store';
import { CalendarScheduleSelectionCellContent, CalendarScheduleSelectionMetadata } from './calendar.schedule.selection';

@Component({
  selector: 'dbx-schedule-selection-calendar-cell',
  template: `
    <mat-icon *ngIf="icon">{{ icon }}</mat-icon>
    <span>{{ text }}</span>
  `,
  host: {
    class: 'dbx-schedule-selection-calendar-cell'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxScheduleSelectionCalendarCellComponent {
  readonly dbxCalendarScheduleSelectionStore = inject(DbxCalendarScheduleSelectionStore);

  content: CalendarScheduleSelectionCellContent = {};

  get icon() {
    return this.content.icon;
  }

  get text() {
    return this.content.text;
  }

  @Input()
  set day(day: CalendarMonthViewDay<CalendarScheduleSelectionMetadata>) {
    this.dbxCalendarScheduleSelectionStore.cellContentFactory$.pipe(first()).subscribe((fn) => {
      this.content = fn(day);
    });
  }
}
