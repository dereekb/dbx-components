import { Component, OnDestroy, OnInit, inject, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CalendarEvent, CalendarMonthViewBeforeRenderEvent, CalendarMonthViewDay, CalendarModule } from 'angular-calendar';
import { map, shareReplay, Subject, first, throttleTime, distinctUntilChanged, Observable, combineLatest, switchMap, of, combineLatestWith } from 'rxjs';
import { DbxCalendarEvent, DbxCalendarStore, prepareAndSortCalendarEvents, DbxCalendarBaseComponent } from '@dereekb/dbx-web/calendar';
import { DayOfWeek, Maybe, reduceBooleansWithAnd } from '@dereekb/util';
import { CalendarScheduleSelectionState, DbxCalendarScheduleSelectionStore } from './calendar.schedule.selection.store';
import { CalendarScheduleSelectionDayState, CalendarScheduleSelectionMetadata } from './calendar.schedule.selection';
import { DbxInjectionComponentConfig, switchMapDbxInjectionComponentConfig, DbxInjectionComponent } from '@dereekb/dbx-core';
import { ObservableOrValue, ObservableOrValueGetter, SubscriptionObject, asObservable, asObservableFromGetter } from '@dereekb/rxjs';
import { DbxScheduleSelectionCalendarDatePopoverButtonComponent } from './calendar.schedule.selection.popover.button.component';
import { DateRangeType, dateRange, isSameDate } from '@dereekb/date';
import { endOfWeek } from 'date-fns';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import { DbxScheduleSelectionCalendarCellComponent } from './calendar.schedule.selection.cell.component';
import { DbxScheduleSelectionCalendarSelectionToggleButtonComponent } from './calendar.schedule.selection.toggle.button.component';
import { DbxButtonSpacerDirective } from '@dereekb/dbx-web';

export interface DbxScheduleSelectionCalendarComponentConfig {
  /**
   * Whether or not the selection calendar is readonly. Defaults to 'false'.
   */
  readonly readonly?: Maybe<ObservableOrValueGetter<Maybe<boolean>>>;
  /**
   * Whether or not to show the configured buttons when readonly is true. Defaults to false.
   */
  readonly showButtonsOnReadonly?: boolean;
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
  imports: [NgClass, CalendarModule, DbxCalendarBaseComponent, DbxInjectionComponent, DbxButtonSpacerDirective, DbxScheduleSelectionCalendarCellComponent, DbxScheduleSelectionCalendarSelectionToggleButtonComponent],
  providers: [DbxCalendarStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxScheduleSelectionCalendarComponent<T> implements OnInit, OnDestroy {
  readonly calendarStore = inject(DbxCalendarStore<T>);
  readonly dbxCalendarScheduleSelectionStore = inject(DbxCalendarScheduleSelectionStore);

  readonly clickEvent = output<DbxCalendarEvent<T>>();

  readonly config = input<Maybe<DbxScheduleSelectionCalendarComponentConfig>>();
  readonly readonly = input<Maybe<boolean>>(false);

  private readonly _centerRangeSub = new SubscriptionObject();

  readonly config$: Observable<Maybe<DbxScheduleSelectionCalendarComponentConfig>> = toObservable(this.config).pipe(distinctUntilChanged(), shareReplay(1));

  readonly readonly$: Observable<boolean> = this.config$.pipe(
    switchMap((x) => (x?.readonly != null ? asObservableFromGetter(x.readonly) : of(undefined))),
    combineLatestWith(toObservable(this.readonly)),
    map(([configReadonly, inputReadonly]) => {
      return configReadonly || inputReadonly || false;
    }),
    shareReplay(1)
  );

  readonly showButtonsOnReadonly$: Observable<boolean> = this.config$.pipe(
    map((x) => x?.showButtonsOnReadonly ?? false),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly showButtons$ = this.showButtonsOnReadonly$.pipe(
    switchMap((x) => {
      if (x) {
        return of(true);
      } else {
        return this.readonly$.pipe(map((x) => !x));
      }
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly showClearSelectionButton$ = this.config$.pipe(
    map((config) => config?.showClearSelectionButton ?? true),
    combineLatestWith(this.showButtons$),
    map((x) => reduceBooleansWithAnd(x)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly datePopoverButtonInjectionConfig$: Observable<Maybe<DbxInjectionComponentConfig<any>>> = this.config$.pipe(
    map((x) => x?.buttonInjectionConfig),
    switchMapDbxInjectionComponentConfig(DbxScheduleSelectionCalendarDatePopoverButtonComponent),
    combineLatestWith(this.showButtons$),
    map(([config, showButton]) => (showButton ? config : undefined)),
    shareReplay(1)
  );

  // refresh any time the selected day function updates
  readonly state$ = this.dbxCalendarScheduleSelectionStore.state$;

  readonly beforeMonthViewRender$ = this.config$.pipe(
    switchMap((x) => {
      let factory: Observable<DbxScheduleSelectionCalendarBeforeMonthViewRenderFunctionFactory>;

      if (x?.beforeMonthViewRenderFunctionFactory) {
        factory = asObservable(x.beforeMonthViewRenderFunctionFactory);
      } else {
        factory = asObservable(x?.customizeDay).pipe(map((x) => dbxScheduleSelectionCalendarBeforeMonthViewRenderFactory(x)));
      }

      return factory.pipe(map((x) => x(this.state$)));
    }),
    shareReplay(1)
  );

  readonly refresh$ = combineLatest([this.state$, this.beforeMonthViewRender$]).pipe(
    throttleTime(20, undefined, { leading: true, trailing: true }),
    map(() => undefined)
  ) as Subject<undefined>;

  readonly events$ = this.calendarStore.visibleEvents$.pipe(map(prepareAndSortCalendarEvents), shareReplay(1));
  readonly viewDate$ = this.calendarStore.date$;

  readonly beforeMonthViewRenderSignal = toSignal(this.beforeMonthViewRender$);
  readonly readonlySignal = toSignal(this.readonly$, { initialValue: false });
  readonly showClearSelectionButtonSignal = toSignal(this.showClearSelectionButton$);
  readonly datePopoverButtonInjectionConfigSignal = toSignal(this.datePopoverButtonInjectionConfig$);

  readonly eventsSignal = toSignal(this.events$, { initialValue: [] });
  readonly viewDateSignal = toSignal(this.viewDate$, { initialValue: new Date() });

  ngOnInit(): void {
    this.dbxCalendarScheduleSelectionStore.setViewReadonlyState(this.readonly$); // sync the readonly state

    this.calendarStore.setNavigationRangeLimit(this.dbxCalendarScheduleSelectionStore.minMaxDateRange$); // set navigation limit to the min/max allowed dates.
    this.calendarStore.setShowPageButtons(true);

    // when a new filter is set, if the first two pages of selectable indexes fit within the calendar month, focus on that calendar month.
    this._centerRangeSub.subscription = this.dbxCalendarScheduleSelectionStore.currentDateRange$
      .pipe(
        first(),
        switchMap((x) => {
          const result: Observable<[typeof x, boolean]> = x
            ? of([x, true])
            : this.dbxCalendarScheduleSelectionStore.minMaxDateRange$.pipe(
                first(),
                map((y) => [y, false] as [typeof x, boolean])
              );
          return result;
        })
      )
      .subscribe(([x, isFromSelectedDateRange]) => {
        if (x?.start) {
          let tapDay: Maybe<Date>;
          const startMonth = dateRange({ date: x.start, type: DateRangeType.CALENDAR_MONTH });
          const monthToFocus = endOfWeek(startMonth.start);

          if (x.end != null) {
            const endMonth = dateRange({ date: x.end, type: DateRangeType.CALENDAR_MONTH });

            if (isSameDate(startMonth.start, endMonth.start)) {
              tapDay = monthToFocus;
            }
          }

          if (!tapDay && isFromSelectedDateRange) {
            tapDay = monthToFocus;
          }

          if (tapDay) {
            this.calendarStore.tapDay(tapDay);
          }
        }
      });
  }

  ngOnDestroy(): void {
    this._centerRangeSub.destroy();
  }

  dayClicked({ date }: { date: Date }): void {
    if (!this.readonlySignal()) {
      this.dbxCalendarScheduleSelectionStore.toggleSelectedDates(date);
    }
  }

  eventClicked(action: string, event: CalendarEvent<T>): void {
    this.clickEvent.emit({ action, event });
  }

  beforeMonthViewRender(renderEvent: CalendarMonthViewBeforeRenderEvent): void {
    this.beforeMonthViewRenderSignal()?.(renderEvent);
  }
}
