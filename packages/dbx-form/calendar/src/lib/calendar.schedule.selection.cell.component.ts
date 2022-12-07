import { tapLog } from '@dereekb/rxjs';
import { Component, EventEmitter, Output, OnDestroy, Input, ChangeDetectionStrategy } from '@angular/core';
import { isSameMonth } from 'date-fns';
import { CalendarEvent, CalendarMonthViewDay } from 'angular-calendar';
import { map, shareReplay, BehaviorSubject, Subject, first, throttleTime } from 'rxjs';
import { MatButtonToggleChange } from '@angular/material/button-toggle';
import { DateOrDateBlockIndex, formatToTimeAndDurationString } from '@dereekb/date';
import { DbxCalendarEvent, DbxCalendarStore, prepareAndSortCalendarEvents } from '@dereekb/dbx-web/calendar';
import { DayOfWeek, DecisionFunction } from '@dereekb/util';
import { DbxCalendarScheduleSelectionStore } from './calendar.schedule.selection.store';
import { CalendarScheduleSelectionCellContent, CalendarScheduleSelectionDayState, CalendarScheduleSelectionMetadata } from './calendar.schedule.selection';

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
  content: CalendarScheduleSelectionCellContent = {};

  get icon() {
    return this.content.icon;
  }

  get text() {
    return this.content.text;
  }

  constructor(readonly dbxCalendarScheduleSelectionStore: DbxCalendarScheduleSelectionStore) {}

  @Input()
  set day(day: CalendarMonthViewDay<CalendarScheduleSelectionMetadata>) {
    this.dbxCalendarScheduleSelectionStore.cellContentFactory$.pipe(first()).subscribe((fn) => {
      this.content = fn(day);
    });
  }
}
