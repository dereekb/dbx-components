import { Component, EventEmitter, Output } from '@angular/core';
import { isSameMonth } from 'date-fns';
import { CalendarEvent } from 'angular-calendar';
import { map, shareReplay, withLatestFrom } from 'rxjs';
import { MatButtonToggleChange } from '@angular/material/button-toggle';
import { formatToTimeAndDurationString } from '@dereekb/date';
import { DbxCalendarEvent, DbxCalendarStore, prepareAndSortCalendarEvents } from '@dereekb/dbx-web/calendar';

@Component({
  selector: 'dbx-schedule-selection-calendar',
  templateUrl: './calendar.schedule.selection.component.html',
  providers: [DbxCalendarStore]
})
export class DbxScheduleSelectionCalendarComponent<T> {
  @Output()
  clickEvent = new EventEmitter<DbxCalendarEvent<T>>();

  readonly events$ = this.calendarStore.visibleEvents$.pipe(map(prepareAndSortCalendarEvents), shareReplay(1));

  readonly viewDate$ = this.calendarStore.date$;

  constructor(readonly calendarStore: DbxCalendarStore<T>) {}

  dayClicked({ date }: { date: Date }): void {}

  eventClicked(action: string, event: CalendarEvent<T>): void {
    this.clickEvent.emit({ action, event });
  }
}
