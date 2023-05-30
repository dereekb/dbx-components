import { Component, EventEmitter, Output, OnDestroy, Input, OnInit } from '@angular/core';
import { CalendarEvent, CalendarMonthViewBeforeRenderEvent, CalendarMonthViewDay } from 'angular-calendar';
import { map, shareReplay, Subject, first, throttleTime, BehaviorSubject, distinctUntilChanged, Observable } from 'rxjs';
import { DbxCalendarEvent, DbxCalendarStore, prepareAndSortCalendarEvents } from '@dereekb/dbx-web/calendar';
import { DayOfWeek, Maybe } from '@dereekb/util';
import { DbxCalendarScheduleSelectionStore } from './calendar.schedule.selection.store';
import { CalendarScheduleSelectionDayState, CalendarScheduleSelectionMetadata } from './calendar.schedule.selection';
import { DbxInjectionComponentConfig, switchMapDbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { ObservableOrValueGetter } from '@dereekb/rxjs';
import { DbxScheduleSelectionCalendarDatePopoverButtonComponent } from './calendar.schedule.selection.popover.button.component';

export interface DbxScheduleSelectionCalendarComponentConfig {
  /**
   * Whether or not to show the clear selection button. Defaults to `true`.
   */
  readonly showClearSelectionButton?: boolean;
  /**
   * Configuration for displaying a custom selection button. When null/undefined/true is passed, will show the default DbxScheduleSelectionCalendarDatePopoverButtonComponent.
   */
  readonly buttonInjectionConfig?: Maybe<ObservableOrValueGetter<Maybe<DbxInjectionComponentConfig<any> | boolean>>>;
}

@Component({
  selector: 'dbx-schedule-selection-calendar',
  templateUrl: './calendar.schedule.selection.component.html',
  providers: [DbxCalendarStore]
})
export class DbxScheduleSelectionCalendarComponent<T> implements OnInit, OnDestroy {
  private _config = new BehaviorSubject<DbxScheduleSelectionCalendarComponentConfig>({});

  readonly showClearSelectionButton$ = this._config.pipe(
    map((config) => config.showClearSelectionButton ?? true),
    distinctUntilChanged()
  );

  readonly datePopoverButtonInjectionConfig$: Observable<Maybe<DbxInjectionComponentConfig<any>>> = this._config.pipe(
    map((x) => x.buttonInjectionConfig),
    switchMapDbxInjectionComponentConfig(DbxScheduleSelectionCalendarDatePopoverButtonComponent),
    shareReplay(1)
  );

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

  ngOnInit(): void {
    this.calendarStore.setNavigationRangeLimit(this.dbxCalendarScheduleSelectionStore.minMaxDateRange$); // set navigation limit to the min/max allowed dates.
    this.calendarStore.setShowPageButtons(true);
  }

  ngOnDestroy(): void {
    this.clickEvent.complete();
    this._config.complete();
  }

  @Input()
  get config() {
    return this._config.value;
  }

  set config(config: DbxScheduleSelectionCalendarComponentConfig) {
    this._config.next(config);
  }

  dayClicked({ date }: { date: Date }): void {
    this.dbxCalendarScheduleSelectionStore.toggleSelectedDates(date);
  }

  eventClicked(action: string, event: CalendarEvent<T>): void {
    this.clickEvent.emit({ action, event });
  }

  beforeMonthViewRender(renderEvent: CalendarMonthViewBeforeRenderEvent): void {
    const { body }: { body: CalendarMonthViewDay<CalendarScheduleSelectionMetadata>[] } = renderEvent;
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
}
