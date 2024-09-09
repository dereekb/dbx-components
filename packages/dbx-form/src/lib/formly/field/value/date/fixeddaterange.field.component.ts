import { type Maybe, type DecisionFunction, type Milliseconds, type TimezoneString, type DateMonth, type DayOfMonth, type YearNumber, isMonthDaySlashDate, MS_IN_MINUTE } from '@dereekb/util';
import { guessCurrentTimezone, DateTimezoneUtcNormalInstance, dateTimezoneUtcNormal, DateRangeInput, DateRange, isSameDateDayRange, DateRangeWithDateOrStringValue, DateTimeMinuteConfig, dateRange, isDateInDateRange, clampDateRangeToDateRange, isSameDateRange, isSameDateDay, limitDateTimeInstance, dateTimeMinuteWholeDayDecisionFunction } from '@dereekb/date';
import { switchMap, shareReplay, map, startWith, distinctUntilChanged, debounceTime, throttleTime, BehaviorSubject, Observable, Subject, of, combineLatestWith, filter, combineLatest, scan, first, timer } from 'rxjs';
import { Component, ElementRef, Injectable, OnDestroy, OnInit, ViewChild, forwardRef } from '@angular/core';
import { AbstractControl, FormControl, FormGroup } from '@angular/forms';
import { FieldType } from '@ngx-formly/material';
import { FieldTypeConfig, FormlyFieldProps } from '@ngx-formly/core';
import { MatDateRangeSelectionStrategy, MAT_DATE_RANGE_SELECTION_STRATEGY, DateRange as DatePickerDateRange, MatCalendar } from '@angular/material/datepicker';
import { asObservableFromGetter, filterMaybe, ObservableOrValueGetter, skipFirstMaybe, SubscriptionObject, switchMapMaybeDefault } from '@dereekb/rxjs';
import { DbxDateTimeValueMode, dbxDateRangeIsSameDateRangeFieldValue, dbxDateTimeInputValueParseFactory, dbxDateTimeOutputValueFactory } from './date.value';
import { DateTimePresetConfiguration } from './datetime';
import { DbxDateTimeFieldMenuPresetsService } from './datetime.field.service';
import { DateAdapter } from '@angular/material/core';
import { isBefore } from 'date-fns';

export type DbxFixedDateRangeDateRangeInput = Omit<DateRangeInput, 'date'>;

export type DbxFixedDateRangePickerConfiguration = Omit<DateTimeMinuteConfig, 'date'>;

export type DbxFixedDateRangeSelectionMode = 'single' | 'normal' | 'arbitrary' | 'arbitrary_quick';
export type DbxFixedDateRangePicking = 'start' | 'end';

export interface DbxFixedDateRangeFieldProps extends FormlyFieldProps {
  /**
   * Date range input to build the date range.
   */
  dateRangeInput: ObservableOrValueGetter<DbxFixedDateRangeDateRangeInput>;

  /**
   * Selection mode to use when picking dates on the calendar.
   */
  selectionMode?: Maybe<ObservableOrValueGetter<DbxFixedDateRangeSelectionMode>>;

  /**
   * Value mode for the dates in the output DateRange.
   *
   * Defaults to DATE
   */
  valueMode?: DbxDateTimeValueMode;

  /**
   * Whether or not to pass the date value as a UTC date, or a date in the current timezone.
   */
  fullDayInUTC?: boolean;

  /**
   * Custom picker configuration
   */
  pickerConfig?: ObservableOrValueGetter<DbxFixedDateRangePickerConfiguration>;

  /**
   * (Optional) The input timezone to default to.
   *
   * Ignored if fullDayInUTC is true.
   */
  timezone?: Maybe<ObservableOrValueGetter<Maybe<TimezoneString>>>;

  /**
   * Whether or not to display the timezone. True by default.
   */
  showTimezone?: boolean;

  /**
   * Custom presets to show in the dropdown.
   */
  presets?: ObservableOrValueGetter<DateTimePresetConfiguration[]>;

  /**
   * Whether or not to show the range input. Defaults to true.
   */
  showRangeInput?: boolean;
}

function dbxFixedDateRangeInputValueFactory(mode: DbxDateTimeValueMode, timezoneInstance: Maybe<DateTimezoneUtcNormalInstance>): (input: Maybe<DateRangeWithDateOrStringValue>) => Maybe<DateRange> {
  const dateInputTransformer = dbxDateTimeInputValueParseFactory(mode, timezoneInstance);

  return (y) => {
    let result: Maybe<DateRange>;

    if (y) {
      result = {
        start: dateInputTransformer(y.start) as Date,
        end: dateInputTransformer(y.end) as Date
      };
    }

    return result;
  };
}

function dbxFixedDateRangeOutputValueFactory(mode: DbxDateTimeValueMode, timezoneInstance: Maybe<DateTimezoneUtcNormalInstance>): (date: Maybe<DateRange>) => Maybe<DateRangeWithDateOrStringValue> {
  const dateOutputTransformer = dbxDateTimeOutputValueFactory(mode, timezoneInstance);

  return (y) => {
    let result: Maybe<DateRange>;

    if (y) {
      result = {
        start: dateOutputTransformer(y.start) as Date,
        end: dateOutputTransformer(y.end) as Date
      };
    }

    return result;
  };
}

const TIME_OUTPUT_THROTTLE_TIME: Milliseconds = 10;

export type FixedDateRangeScanType = 'start' | 'end' | 'startRepeat';

export interface FixedDateRangeScan {
  /**
   * Picked the start or end of the range on the last pick.
   */
  lastPickType?: Maybe<FixedDateRangeScanType>;
  /**
   * The latest date passed, if applicable.
   */
  lastDateRange?: Maybe<Partial<DateRange>>;
  /**
   * The generated boundary range.
   */
  boundary?: DateRange;
  /**
   * New Date Range
   */
  range?: DateRange;
}

type SelectedDateEventType = 'calendar' | 'input';

interface SelectedDateEvent {
  type: SelectedDateEventType;
  range?: Maybe<Partial<DateRange>>;
}

@Component({
  templateUrl: 'fixeddaterange.field.component.html',
  providers: [
    {
      provide: MAT_DATE_RANGE_SELECTION_STRATEGY,
      useClass: forwardRef(() => DbxFixedDateRangeFieldSelectionStrategy)
    }
  ]
})
export class DbxFixedDateRangeFieldComponent extends FieldType<FieldTypeConfig<DbxFixedDateRangeFieldProps>> implements OnInit, OnDestroy {
  private _sub = new SubscriptionObject();

  private _inputRangeFormSub = new SubscriptionObject();
  private _inputRangeFormValueSub = new SubscriptionObject();

  private _dateRangeInputSub = new SubscriptionObject();
  private _currentSelectionModeSub = new SubscriptionObject();
  private _latestBoundarySub = new SubscriptionObject();
  private _disableEndSub = new SubscriptionObject();
  private _activeDateSub = new SubscriptionObject();

  private _currentDateRangeInput: Maybe<DbxFixedDateRangeDateRangeInput> = {};
  private _currentSelectionMode: DbxFixedDateRangeSelectionMode = 'single';
  private _latestBoundary: Maybe<DateRange> = null;

  private _config = new BehaviorSubject<Maybe<Observable<DbxFixedDateRangePickerConfiguration>>>(undefined);
  private _selectionMode = new BehaviorSubject<Maybe<Observable<DbxFixedDateRangeSelectionMode>>>(undefined);
  private _dateRangeInput = new BehaviorSubject<Maybe<Observable<DbxFixedDateRangeDateRangeInput>>>(undefined);

  private _timezone = new BehaviorSubject<Maybe<Observable<Maybe<TimezoneString>>>>(undefined);
  private _presets = new BehaviorSubject<Observable<DateTimePresetConfiguration[]>>(of([]));

  private _selectionEvent = new Subject<SelectedDateEvent>();
  readonly selectedDateRange$: Observable<Maybe<Partial<DateRange>>> = this._selectionEvent.pipe(map((x) => x.range));

  private _formControlObs = new BehaviorSubject<Maybe<AbstractControl<Maybe<DateRange>>>>(undefined);
  readonly formControl$ = this._formControlObs.pipe(filterMaybe());

  @ViewChild(MatCalendar)
  calendar!: MatCalendar<Date>;

  @ViewChild('startDateInput', { read: ElementRef })
  startDateInputElement!: ElementRef;

  @ViewChild('endDateInput', { read: ElementRef })
  endDateInputElement!: ElementRef;

  get currentDateRangeInput() {
    return this._currentDateRangeInput;
  }

  get currentSelectionMode() {
    return this._currentSelectionMode;
  }

  get latestBoundary() {
    return this._latestBoundary;
  }

  readonly config$: Observable<DbxFixedDateRangePickerConfiguration> = this._config.pipe(
    filterMaybe(),
    switchMap((x) => x),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly limitDateTimeInstance$ = this.config$.pipe(map(limitDateTimeInstance), shareReplay(1));

  readonly selectionMode$: Observable<DbxFixedDateRangeSelectionMode> = this._selectionMode.pipe(
    switchMapMaybeDefault<DbxFixedDateRangeSelectionMode>('single'),
    map((x) => x ?? 'single'),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly dateRangeInput$ = this._dateRangeInput.pipe(switchMapMaybeDefault(), shareReplay(1));

  readonly timezone$: Observable<Maybe<TimezoneString>> = this._timezone.pipe(switchMapMaybeDefault(), distinctUntilChanged()).pipe(
    map((defaultTimezone) => {
      return defaultTimezone ?? guessCurrentTimezone();
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly timezoneInstance$: Observable<Maybe<DateTimezoneUtcNormalInstance>> = this.timezone$.pipe(
    map((timezone) => (timezone ? dateTimezoneUtcNormal({ timezone }) : undefined)),
    shareReplay(1)
  );

  readonly valueInSystemTimezone$: Observable<Maybe<DateRange>> = this.formControl$.pipe(
    map((control) => control.valueChanges.pipe(startWith<Maybe<DateRangeWithDateOrStringValue>>(control.value), shareReplay(1))),
    combineLatestWith(this.timezoneInstance$),
    switchMap(([x, timezoneInstance]) => {
      return x.pipe(map(dbxFixedDateRangeInputValueFactory(this.valueMode, timezoneInstance)));
    }),
    throttleTime(20, undefined, { leading: false, trailing: true }), // throttle incoming values and timezone changes
    distinctUntilChanged<Maybe<DateRange>>(isSameDateDayRange),
    shareReplay(1)
  );

  dateRangeSelectionForMode(mode: DbxFixedDateRangeSelectionMode) {
    const result: Observable<Maybe<DateRange>> = combineLatest([this.dateRangeInput$, this.limitDateTimeInstance$]).pipe(
      switchMap(([dateRangeInput, limitInstance]) => {
        const hasDateRangeConfiguration = Boolean(dateRangeInput);
        const minMaxClamp = (dateRange: DateRange) => limitInstance.clampDateRange(dateRange);

        if (mode === 'single') {
          // only use the start date.
          return this.selectedDateRange$.pipe(
            distinctUntilChanged(isSameDateDayRange),
            map((inputDateRange) => {
              const date = inputDateRange?.start;
              return date ? (minMaxClamp(dateRange({ ...dateRangeInput, date } as DateRangeInput)) as DateRange) : null;
            })
          );
        } else {
          // take the first date, then wait unless the date is outside of the range.
          return this.selectedDateRange$.pipe(
            scan((acc: FixedDateRangeScan, nextDateRange: Maybe<Partial<DateRange>>) => {
              let result: FixedDateRangeScan;
              let pickType: Maybe<FixedDateRangeScanType> = 'start';

              if (nextDateRange && nextDateRange.start != null) {
                const { start: startOrNextDate, end } = nextDateRange;
                const potentialBoundary = dateRange({ ...dateRangeInput, date: startOrNextDate } as DateRangeInput);

                // only comes through when passed by the text inputs
                if (startOrNextDate && end) {
                  const range = clampDateRangeToDateRange(nextDateRange, potentialBoundary) as DateRange;
                  result = {
                    lastDateRange: nextDateRange,
                    boundary: range,
                    range
                  };

                  // for normal mode we want to protect against "start" being input, then the output being passed,
                  // and then the next click being treated as another "start" instead of an "end".
                  if (mode === 'normal' && acc.lastPickType === 'start' && isSameDateDay(startOrNextDate, end)) {
                    if (isSameDateDay(startOrNextDate, acc.lastDateRange?.start)) {
                      pickType = 'startRepeat';
                    }
                  }
                } else {
                  let range: Maybe<DateRange> = undefined;
                  let boundary: Maybe<DateRange> = potentialBoundary;

                  if (mode === 'normal') {
                    if (!hasDateRangeConfiguration) {
                      // if there is no configured range/boundary, then just set the pick type based on the last type
                      boundary = undefined;
                      pickType = acc.lastPickType === 'start' ? 'end' : 'start';
                    } else if (acc.lastPickType === 'startRepeat') {
                      pickType = 'end';
                    } else {
                      // if the pick is outside the boundary, then consider it a start pick type.
                      pickType = acc.lastPickType === 'start' && acc.boundary && isDateInDateRange(startOrNextDate, acc.boundary) ? 'end' : 'start';
                    }

                    // react based on how this
                    switch (pickType) {
                      case 'end':
                        const lastStart = acc.lastDateRange?.start as Date;

                        let boundaryToCheck: DateRange;
                        const selectionIsBeforePreviousSelection = !lastStart || isBefore(startOrNextDate, lastStart);

                        let nextStart: Date;
                        let nextEnd: Date;

                        if (selectionIsBeforePreviousSelection) {
                          nextStart = startOrNextDate;
                          nextEnd = lastStart;
                          boundaryToCheck = potentialBoundary;
                        } else {
                          nextStart = lastStart;
                          nextEnd = startOrNextDate;
                          boundaryToCheck = dateRange({ ...dateRangeInput, date: nextStart } as DateRangeInput);
                        }

                        // Recalculate the boundary using the next start date. If it is outside the selectable range, then it becomes a "start" pick type.
                        if (isBefore(boundaryToCheck.end, nextEnd)) {
                          // TODO: Allow changing the behavior to fill the entire range instead of just resetting it entirely

                          nextStart = startOrNextDate;
                          nextEnd = startOrNextDate;
                          pickType = 'start';
                          boundary = boundaryToCheck;
                        } else {
                          boundary = range;
                        }

                        // if we're picking the end then set the range.
                        range = {
                          start: nextStart,
                          end: nextEnd
                        };
                        break;
                      case 'start':
                        // retain the boundary as potential boundary, and set our new range from the single date.
                        range = {
                          start: startOrNextDate as Date,
                          end: startOrNextDate as Date
                        };
                        break;
                    }
                  } else if (acc.boundary && isDateInDateRange(startOrNextDate, acc.boundary)) {
                    // if in the date range, uses the pick as the last date.
                    range = {
                      start: acc.boundary.start,
                      end: startOrNextDate
                    };

                    if (mode === 'arbitrary_quick') {
                      // modify boundary to match range
                      if (isSameDateRange(acc.range, range) && isSameDateDay(range.end, startOrNextDate)) {
                        // if we clicked on the end range, then expand the boundary again to the full range.
                        range = dateRange({ ...dateRangeInput, date: range.start } as DateRangeInput);
                        boundary = range;
                      } else {
                        boundary = range;
                      }
                    } else {
                      // retain same boundary
                      boundary = acc.boundary;
                    }
                  } else if (mode === 'arbitrary_quick') {
                    range = potentialBoundary;
                  }

                  result = {
                    lastDateRange: nextDateRange,
                    boundary,
                    range
                  };
                }
              } else {
                result = {
                  lastDateRange: nextDateRange
                };
              }

              if (result) {
                result = {
                  lastPickType: pickType,
                  lastDateRange: result.lastDateRange,
                  boundary: result.boundary ? (minMaxClamp(result.boundary) as DateRange) : undefined,
                  range: result.range ? (minMaxClamp(result.range) as DateRange) : undefined
                };
              }

              return result;
            }, {}),
            filter((x) => !x.lastDateRange || x.range != null), // pass through null/date clearings or ranges
            map((x) => x.range ?? null) // return the range
          );
        }
      })
    );

    return result;
  }

  readonly fullBoundary$: Observable<Maybe<DateRange>> = this.dateRangeSelectionForMode('single').pipe(shareReplay(1));
  readonly latestBoundary$: Observable<Maybe<DateRange>> = this.selectionMode$.pipe(
    switchMap((mode) => {
      if (mode === 'arbitrary_quick') {
        // in arbitrary_quick mode, the latest value is the boundary, since we always set the value immediately.
        return this.valueInSystemTimezone$;
      } else {
        return this.fullBoundary$;
      }
    })
  );

  /**
   * Focuses on the date any time the selection event from the picker occured, otherwise use the system value
   */
  readonly calendarFocusDate$: Observable<Date> = this._selectionEvent.pipe(startWith(null)).pipe(
    switchMap((selectionEvent) => {
      if (selectionEvent && selectionEvent.type === 'calendar' && selectionEvent.range?.start) {
        return of(selectionEvent.range.start);
      } else {
        return this.fullBoundary$.pipe(
          first(),
          map((fullBoundary) => {
            return fullBoundary?.start ?? selectionEvent?.range?.start;
          })
        );
      }
    }),
    filterMaybe(),
    shareReplay(1)
  );

  readonly dateRangeSelection$: Observable<Maybe<DateRange>> = this.selectionMode$.pipe(switchMap((mode) => this.dateRangeSelectionForMode(mode)));

  readonly calendarSelection$: Observable<DatePickerDateRange<Date> | null> = this.valueInSystemTimezone$.pipe(
    map((x) => (x ? new DatePickerDateRange<Date>(x.start, x.end) : null)),
    shareReplay(1)
  );

  readonly endDisabled$ = this.selectionMode$.pipe(
    map((x) => x === 'single'),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly inputRangeForm = new FormGroup({
    start: new FormControl<Maybe<Date>>(null),
    end: new FormControl<Maybe<Date>>(null)
  });

  get fixedDateRangeField(): DbxFixedDateRangeFieldProps {
    return this.field.props;
  }

  get selectionMode() {
    return this.field.props.selectionMode;
  }

  get valueMode(): DbxDateTimeValueMode {
    return this.field.props.valueMode ?? DbxDateTimeValueMode.DATE;
  }

  get description(): Maybe<string> {
    return this.field.props.description;
  }

  get timezone() {
    return this.field.props.timezone;
  }

  get showTimezone() {
    return this.field.props.showTimezone ?? true;
  }

  get presets() {
    return this.field.props.presets;
  }

  get showRangeInput() {
    return this.field.props.showRangeInput ?? true;
  }

  readonly minMaxRange$ = this.limitDateTimeInstance$.pipe(
    combineLatestWith(timer(MS_IN_MINUTE)), // refresh every minute
    map(([x]) => x.dateRange()),
    distinctUntilChanged(isSameDateDayRange),
    shareReplay(1)
  );

  readonly min$ = this.minMaxRange$.pipe(
    map((x) => x?.start ?? null),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly max$ = this.minMaxRange$.pipe(
    map((x) => x?.end ?? null),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly pickerFilter$: Observable<DecisionFunction<Date | null>> = this.config$.pipe(
    distinctUntilChanged(),
    map((x) => {
      if (x) {
        const filter = dateTimeMinuteWholeDayDecisionFunction(x, false);
        return (x: Date | null) => (x != null ? filter(x) : true);
      } else {
        return () => true;
      }
    }),
    shareReplay(1)
  );

  readonly defaultPickerFilter: DecisionFunction<Date | null> = () => true;

  constructor(private readonly dbxDateTimeFieldConfigService: DbxDateTimeFieldMenuPresetsService) {
    super();
  }

  ngOnInit(): void {
    this._formControlObs.next(this.formControl);

    const dateRangeSelection = this.dateRangeSelection$.pipe(shareReplay(1));

    const setInputFormValue = (value: Maybe<DateRange>) => {
      if (!isSameDateDayRange(value, this.inputRangeForm.value as Partial<DateRange>)) {
        this.inputRangeForm.setValue({
          start: value?.start ?? null,
          end: value?.end ?? null
        });
      }
    };

    this._sub.subscription = this.valueInSystemTimezone$
      .pipe(
        combineLatestWith(this.timezoneInstance$.pipe(map((timezoneInstance) => dbxFixedDateRangeOutputValueFactory(this.valueMode, timezoneInstance)))),
        throttleTime(TIME_OUTPUT_THROTTLE_TIME, undefined, { leading: false, trailing: true }),
        switchMap(([currentValue, valueFactory]) => {
          return dateRangeSelection.pipe(
            skipFirstMaybe(),
            distinctUntilChanged<Maybe<DateRange>>(isSameDateDayRange),
            map((x) => [x, currentValue, valueFactory] as [typeof x, typeof currentValue, typeof valueFactory])
          );
        })
      )
      .subscribe(([rawValue, currentValue, valueFactory]) => {
        const value = rawValue ? valueFactory(rawValue) : null;
        const isSameRange = dbxDateRangeIsSameDateRangeFieldValue(value, currentValue);

        if (!isSameRange) {
          this.formControl.setValue(value);
          this.formControl.markAsDirty();
          this.formControl.markAsTouched();
        } else if (rawValue != null) {
          // update the input text again
          setInputFormValue(rawValue);
        }
      });

    if (this.selectionMode) {
      this._selectionMode.next(asObservableFromGetter(this.selectionMode));
    }

    this._currentSelectionModeSub.subscription = this.selectionMode$.subscribe((x) => (this._currentSelectionMode = x));
    this._dateRangeInputSub.subscription = this.dateRangeInput$.subscribe((x) => (this._currentDateRangeInput = x));

    this._inputRangeFormSub.subscription = this.valueInSystemTimezone$.subscribe((x: Maybe<DateRange>) => {
      setInputFormValue(x);
    });

    if (this.showRangeInput) {
      this._inputRangeFormValueSub.subscription = this.valueInSystemTimezone$
        .pipe(
          throttleTime(100), // throttle to prevent the value from changing too fast
          switchMap(() => {
            return this.inputRangeForm.valueChanges.pipe(
              debounceTime(500),
              filter(() => {
                const startString = this.startDateInputElement.nativeElement?.value;
                let valid = isMonthDaySlashDate(startString);

                if (valid && this._currentSelectionMode !== 'single') {
                  const endString = this.endDateInputElement.nativeElement?.value;
                  valid = isMonthDaySlashDate(endString);
                }

                return valid; // must be a valid text input
              }),
              map((x) => x as Maybe<Partial<DateRange>>)
            );
          }),
          distinctUntilChanged(isSameDateRange)
        )
        .subscribe((x: Maybe<Partial<DateRange>>) => {
          if (this._currentSelectionMode === 'single') {
            this.setDateRange(x?.start ? { start: x.start } : null, 'input');
          } else {
            let rangeToSet: Maybe<Partial<DateRange>> = x;

            if (this._currentSelectionMode === 'arbitrary_quick' && this._latestBoundary && x?.start && x?.end) {
              if (!isDateInDateRange(x.start, this._latestBoundary)) {
                // if the end date it outside of the current range (i.e. a range was typed in only to the start date) then set the end to the boundary end
                const boundary = dateRange({ ...this._currentDateRangeInput, date: x.start } as DateRangeInput);
                rangeToSet = { start: x.start, end: boundary.end };
              }
            }

            this.setDateRange(rangeToSet, 'input');
          }
        });
    }

    this._latestBoundarySub.subscription = this.latestBoundary$.subscribe((x) => (this._latestBoundary = x));
    this._dateRangeInput.next(asObservableFromGetter(this.fixedDateRangeField.dateRangeInput));

    this._disableEndSub.subscription = this.endDisabled$.subscribe((disabled) => {
      const end = this.inputRangeForm.get('end');

      if (end) {
        if (disabled) {
          end.disable();
        } else {
          end.enable();
        }
      }
    });

    const inputPickerConfig = this.fixedDateRangeField.pickerConfig;
    this._config.next(inputPickerConfig ? asObservableFromGetter(inputPickerConfig) : undefined);

    // Set default timezone if provided.
    if (this.timezone && !this.fixedDateRangeField.fullDayInUTC) {
      this._timezone.next(asObservableFromGetter(this.timezone));
    }

    // Watch for disabled changes so we can propogate them properly.
    this.formControl.registerOnDisabledChange((disabled) => {
      if (disabled) {
        this.inputRangeForm.disable();
      } else {
        this.inputRangeForm.enable();

        this.endDisabled$.pipe(first()).subscribe((disabled) => {
          const end = this.inputRangeForm.get('end');

          if (end) {
            if (disabled) {
              end.disable();
            } else {
              end.enable();
            }
          }
        });
      }
    });

    if (this.presets != null) {
      this._presets.next(asObservableFromGetter(this.presets));
    } else {
      this._presets.next(this.dbxDateTimeFieldConfigService.configurations$);
    }

    this._activeDateSub.subscription = this.calendarFocusDate$.subscribe((x) => {
      this.calendar.activeDate = x;
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._sub.destroy();
    this._inputRangeFormSub.destroy();
    this._inputRangeFormValueSub.destroy();
    this._dateRangeInputSub.destroy();
    this._currentSelectionModeSub.destroy();
    this._latestBoundarySub.destroy();
    this._disableEndSub.destroy();
    this._activeDateSub.destroy();
    this._config.complete();
    this._selectionMode.complete();
    this._dateRangeInput.complete();
    this._timezone.complete();
    this._presets.complete();
    this._selectionEvent.complete();
    this._formControlObs.complete();
  }

  selectedChange(date: Maybe<Date>): void {
    this.setDateRange(date ? { start: date } : null, 'calendar');
  }

  setDateRange(range: Maybe<Partial<DateRange>>, type: SelectedDateEventType) {
    this._selectionEvent.next({ type, range });
  }

  _createDateRange(date: Maybe<Date>): Maybe<DateRange> {
    return date ? dateRange({ ...this._currentDateRangeInput, date } as DateRangeInput) : undefined;
  }
}

@Injectable()
export class DbxFixedDateRangeFieldSelectionStrategy<D> implements MatDateRangeSelectionStrategy<D> {
  constructor(private _dateAdapter: DateAdapter<D>, readonly dbxFixedDateRangeFieldComponent: DbxFixedDateRangeFieldComponent) {}

  selectionFinished(date: D | null, currentRange: DatePickerDateRange<D>, event: Event): DatePickerDateRange<D> {
    // unused
    return currentRange;
  }

  createPreview(activeDate: D | null, currentRange: DatePickerDateRange<D>, event: Event): DatePickerDateRange<D> {
    const { currentSelectionMode } = this.dbxFixedDateRangeFieldComponent;
    if (activeDate != null && currentSelectionMode !== 'single') {
      const latestBoundary = this.dbxFixedDateRangeFieldComponent.latestBoundary;
      const date = this.dateFromAdapterDate(activeDate);

      if (latestBoundary && (currentSelectionMode === 'normal' || isDateInDateRange(date, latestBoundary))) {
        const exampleDateRange = this._createDateRange(latestBoundary);
        return exampleDateRange;
      }
    }

    return this._createDateRangeWithDate(activeDate);
  }

  private _createDateRangeWithDate(input: D | null): DatePickerDateRange<D> {
    let dateRange: Maybe<DateRange>;

    if (input) {
      const date = this.dateFromAdapterDate(input);
      dateRange = this.dbxFixedDateRangeFieldComponent._createDateRange(date);
    }

    return this._createDateRange(dateRange);
  }

  private _createDateRange(input: Maybe<DateRange>): DatePickerDateRange<D> {
    if (input) {
      return new DatePickerDateRange<D>(this.adapterDateFromDate(input.start), this.adapterDateFromDate(input.end));
    } else {
      return new DatePickerDateRange<D>(null, null);
    }
  }

  dateFromAdapterDate(input: D) {
    const day: DayOfMonth = this._dateAdapter.getDate(input);
    const monthIndex: DateMonth = this._dateAdapter.getMonth(input);
    const year: YearNumber = this._dateAdapter.getYear(input);
    return new Date(year, monthIndex, day);
  }

  adapterDateFromDate(date: Date): D {
    const day: DayOfMonth = date.getDate();
    const monthIndex: DateMonth = date.getMonth();
    const year: YearNumber = date.getFullYear();

    return this._dateAdapter.createDate(year, monthIndex, day);
  }
}
