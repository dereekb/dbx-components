import { Component, EventEmitter, Output, OnDestroy, Input, OnInit } from '@angular/core';
import { CalendarEvent, CalendarMonthViewBeforeRenderEvent, CalendarMonthViewDay } from 'angular-calendar';
import { map, shareReplay, Subject, first, throttleTime, BehaviorSubject, distinctUntilChanged, Observable, combineLatest, switchMap } from 'rxjs';
import { DbxCalendarEvent, DbxCalendarStore, prepareAndSortCalendarEvents } from '@dereekb/dbx-web/calendar';
import { DayOfWeek, Maybe } from '@dereekb/util';
import { CalendarScheduleSelectionState, DbxCalendarScheduleSelectionStore } from './calendar.schedule.selection.store';
import { CalendarScheduleSelectionDayState, CalendarScheduleSelectionMetadata } from './calendar.schedule.selection';
import { DbxInjectionComponentConfig, switchMapDbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { ObservableOrValue, ObservableOrValueGetter, SubscriptionObject, asObservable, asObservableFromGetter } from '@dereekb/rxjs';
import { DbxScheduleSelectionCalendarDatePopoverButtonComponent } from './calendar.schedule.selection.popover.button.component';
import { DateRangeType, dateRange, isSameDate } from '@dereekb/date';
import { endOfWeek } from 'date-fns';

export interface DbxScheduleSelectionCalendarComponentConfig {
  /**
   * Whether or not to show the clear selection button. Defaults to `true`.
   */
  readonly showClearSelectionButton?: boolean;
  /**
   * Configuration for displaying a custom selection button. When null/undefined/true is passed, will show the default DbxScheduleSelectionCalendarDatePopoverButtonComponent.
   */
  readonly buttonInjectionConfig?: Maybe<ObservableOrValueGetter<Maybe<DbxInjectionComponentConfig<any> | boolean>>>;
  /**
   * Customize day function. When a new function is piped through the calendar is refreshed.
   */
  readonly customizeDay?: Maybe<ObservableOrValue<Maybe<DbxScheduleSelectionCalendarBeforeMonthViewRenderModifyDayFunction>>>;
  /**
   * Optional full control over the beforeMonthViewRender
   */
  readonly beforeMonthViewRenderFunctionFactory?: Maybe<ObservableOrValue<DbxScheduleSelectionCalendarBeforeMonthViewRenderFunctionFactory>>;
}

export type DbxScheduleSelectionCalendarBeforeMonthViewRenderModifyDayFunction = (viewDay: CalendarMonthViewDay<CalendarScheduleSelectionMetadata>, state: CalendarScheduleSelectionState) => void;

export type DbxScheduleSelectionCalendarBeforeMonthViewRenderFunction = (renderEvent: CalendarMonthViewBeforeRenderEvent) => void;

export type DbxScheduleSelectionCalendarBeforeMonthViewRenderFunctionFactory = (state: Observable<CalendarScheduleSelectionState>) => DbxScheduleSelectionCalendarBeforeMonthViewRenderFunction;

export function dbxScheduleSelectionCalendarBeforeMonthViewRenderFactory(inputModifyFn?: Maybe<DbxScheduleSelectionCalendarBeforeMonthViewRenderModifyDayFunction>): DbxScheduleSelectionCalendarBeforeMonthViewRenderFunctionFactory {
  const modifyFn = inputModifyFn || (() => {});

  return (state$: Observable<CalendarScheduleSelectionState>) => {
    return (renderEvent: CalendarMonthViewBeforeRenderEvent) => {
      const { body }: { body: CalendarMonthViewDay<CalendarScheduleSelectionMetadata>[] } = renderEvent;

      // use latest/current state
      state$.pipe(first()).subscribe((calendarScheduleState: CalendarScheduleSelectionState) => {
        const { isEnabledDay, indexFactory, isEnabledFilterDay, allowedDaysOfWeek } = calendarScheduleState;
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

          const meta = {
            state,
            i
          };

          viewDay.meta = meta;

          modifyFn(viewDay, calendarScheduleState);
        });
      });
    };
  };
}

@Component({
  selector: 'dbx-schedule-selection-calendar',
  templateUrl: './calendar.schedule.selection.component.html',
  providers: [DbxCalendarStore]
})
export class DbxScheduleSelectionCalendarComponent<T> implements OnInit, OnDestroy {
  private _config = new BehaviorSubject<DbxScheduleSelectionCalendarComponentConfig>({});
  private _centerRangeSub = new SubscriptionObject();

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

  readonly beforeMonthViewRender$ = this._config.pipe(
    switchMap((x) => {
      let factory: Observable<DbxScheduleSelectionCalendarBeforeMonthViewRenderFunctionFactory>;

      if (x.beforeMonthViewRenderFunctionFactory) {
        factory = asObservable(x.beforeMonthViewRenderFunctionFactory);
      } else {
        factory = asObservable(x.customizeDay).pipe(map((x) => dbxScheduleSelectionCalendarBeforeMonthViewRenderFactory(x)));
      }

      return factory.pipe(map((x) => x(this.state$)));
    }),
    shareReplay(1)
  );

  readonly refresh$ = combineLatest([this.state$, this.beforeMonthViewRender$]).pipe(
    throttleTime(100),
    map(() => undefined)
  ) as Subject<undefined>;

  readonly events$ = this.calendarStore.visibleEvents$.pipe(map(prepareAndSortCalendarEvents), shareReplay(1));
  readonly viewDate$ = this.calendarStore.date$;

  constructor(readonly calendarStore: DbxCalendarStore<T>, readonly dbxCalendarScheduleSelectionStore: DbxCalendarScheduleSelectionStore) {}

  ngOnInit(): void {
    this.calendarStore.setNavigationRangeLimit(this.dbxCalendarScheduleSelectionStore.minMaxDateRange$); // set navigation limit to the min/max allowed dates.
    this.calendarStore.setShowPageButtons(true);

    // when a new filter is set, if the first two pages of selectable indexes fit within the calendar month, focus on that calendar month.
    this._centerRangeSub.subscription = this.dbxCalendarScheduleSelectionStore.minMaxDateRange$.subscribe((x) => {
      if (x?.start && x.end) {
        const startMonth = dateRange({ date: x.start, type: DateRangeType.CALENDAR_MONTH });
        const endMonth = dateRange({ date: x.end, type: DateRangeType.CALENDAR_MONTH });

        if (isSameDate(startMonth.start, endMonth.start)) {
          const monthToFocus = endOfWeek(startMonth.start);
          this.calendarStore.tapDay(monthToFocus);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.clickEvent.complete();
    this._config.complete();
    this._centerRangeSub.destroy();
  }

  @Input()
  get config() {
    return this._config.value;
  }

  set config(config: Maybe<DbxScheduleSelectionCalendarComponentConfig>) {
    this._config.next(config ?? {});
  }

  dayClicked({ date }: { date: Date }): void {
    this.dbxCalendarScheduleSelectionStore.toggleSelectedDates(date);
  }

  eventClicked(action: string, event: CalendarEvent<T>): void {
    this.clickEvent.emit({ action, event });
  }

  beforeMonthViewRender(renderEvent: CalendarMonthViewBeforeRenderEvent): void {
    this.beforeMonthViewRender$.pipe(first()).subscribe((x) => {
      x(renderEvent);
    });
  }
}
