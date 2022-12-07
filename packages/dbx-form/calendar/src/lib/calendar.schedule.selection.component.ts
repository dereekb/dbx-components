import { tapLog } from '@dereekb/rxjs';
import { Component, EventEmitter, Output, OnDestroy } from '@angular/core';
import { isSameMonth } from 'date-fns';
import { CalendarEvent, CalendarMonthViewDay } from 'angular-calendar';
import { map, shareReplay, BehaviorSubject, Subject, first, throttleTime } from 'rxjs';
import { MatButtonToggleChange } from '@angular/material/button-toggle';
import { DateOrDateBlockIndex, formatToTimeAndDurationString } from '@dereekb/date';
import { DbxCalendarEvent, DbxCalendarStore, prepareAndSortCalendarEvents } from '@dereekb/dbx-web/calendar';
import { DayOfWeek, DecisionFunction } from '@dereekb/util';
import { DbxCalendarScheduleSelectionStore } from './calendar.schedule.selection.store';
import { CalendarScheduleSelectionDayState, CalendarScheduleSelectionMetadata } from './calendar.schedule.selection';

@Component({
  selector: 'dbx-schedule-selection-calendar',
  templateUrl: './calendar.schedule.selection.component.html',
  providers: [DbxCalendarStore]
})
export class DbxScheduleSelectionCalendarComponent<T> implements OnDestroy {
  @Output()
  clickEvent = new EventEmitter<DbxCalendarEvent<T>>();

  // refresh any time the selected day function updates
  readonly state$ = this.dbxCalendarScheduleSelectionStore.state$;
  readonly refresh$ = this.state$.pipe(
    throttleTime(100),
    map(() => undefined)
  ) as Subject<undefined>;

  readonly events$ = this.calendarStore.visibleEvents$.pipe(map(prepareAndSortCalendarEvents), shareReplay(1));
  readonly viewDate$ = this.calendarStore.date$;

  constructor(readonly calendarStore: DbxCalendarStore<T>, readonly dbxCalendarScheduleSelectionStore: DbxCalendarScheduleSelectionStore) {}

  dayClicked({ date }: { date: Date }): void {
    this.dbxCalendarScheduleSelectionStore.toggleSelectedDates(date);
  }

  eventClicked(action: string, event: CalendarEvent<T>): void {
    this.clickEvent.emit({ action, event });
  }

  beforeMonthViewRender({ body }: { body: CalendarMonthViewDay<CalendarScheduleSelectionMetadata>[] }): void {
    this.state$.pipe(first()).subscribe(({ isEnabledDay, indexFactory, isEnabledFilterDay, allowedDaysOfWeek }) => {
      body.forEach((viewDay) => {
        const { date } = viewDay;
        const i = indexFactory(date);
        const day = date.getDay();

        let state: CalendarScheduleSelectionDayState;

        if (!isEnabledFilterDay(i)) {
          viewDay.cssClass = 'cal-day-not-applicable';
          state = CalendarScheduleSelectionDayState.NOT_APPLICABLE;
        } else if (!allowedDaysOfWeek.has(day as DayOfWeek)) {
          viewDay.cssClass = 'cal-day-disabled';
          state = CalendarScheduleSelectionDayState.DISABLED;
        } else if (isEnabledDay(i)) {
          viewDay.cssClass = 'cal-day-selected';
          state = CalendarScheduleSelectionDayState.SELECTED;
        } else {
          viewDay.cssClass = 'cal-day-not-selected';
          state = CalendarScheduleSelectionDayState.NOT_SELECTED;
        }

        viewDay.meta = {
          state,
          i
        };
      });
    });
  }

  ngOnDestroy(): void {
    this.clickEvent.complete();
  }
}
