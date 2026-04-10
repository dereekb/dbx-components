import { type Maybe, type DecisionFunction, type Milliseconds, type TimezoneString, type DateMonth, type DayOfMonth, type YearNumber, isMonthDaySlashDate, MS_IN_MINUTE } from '@dereekb/util';
import { guessCurrentTimezone, type DateTimezoneUtcNormalInstance, dateTimezoneUtcNormal, type DateRangeInput, type DateRange, isSameDateDayRange, type DateRangeWithDateOrStringValue, dateRange, isDateInDateRange, clampDateRangeToDateRange, isSameDateRange, isSameDateDay, limitDateTimeInstance, dateTimeMinuteWholeDayDecisionFunction } from '@dereekb/date';
import { switchMap, shareReplay, map, startWith, distinctUntilChanged, debounceTime, throttleTime, BehaviorSubject, type Observable, Subject, of, combineLatestWith, filter, combineLatest, scan, first, timer } from 'rxjs';
import { ChangeDetectionStrategy, Component, ElementRef, Injectable, type InputSignal, type Signal, DestroyRef, inject, signal, viewChild, computed, input, forwardRef, effect, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { type MatDateRangeSelectionStrategy, MAT_DATE_RANGE_SELECTION_STRATEGY, DateRange as DatePickerDateRange, MatCalendar, MatDatepickerModule } from '@angular/material/datepicker';
import { asObservableFromGetter, filterMaybe, type ObservableOrValueGetter, skipAllInitialMaybe, SubscriptionObject, switchMapMaybeDefault } from '@dereekb/rxjs';
import { DbxDateTimeValueMode, dbxDateRangeIsSameDateRangeFieldValue, dbxDateTimeInputValueParseFactory, dbxDateTimeOutputValueFactory } from '../../../../formly/field/value/date/date.value';
import { type DateTimePresetConfiguration } from '../../../../formly/field/value/date/datetime';
import { type DbxFixedDateRangeDateRangeInput, type DbxFixedDateRangePickerConfiguration, type DbxFixedDateRangeSelectionMode, type FixedDateRangeScan, type FixedDateRangeScanType } from '../../../../formly/field/value/date/fixeddaterange.field.component';
import { DateAdapter } from '@angular/material/core';
import { isBefore } from 'date-fns';
import { MatError, MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import { type DynamicText, type ValidationMessages, DEFAULT_PROPS, DEFAULT_VALIDATION_MESSAGES } from '@ng-forge/dynamic-forms';
import { resolveValueFieldContext, buildValueFieldInputs } from '@ng-forge/dynamic-forms/integration';
import type { FieldTree } from '@angular/forms/signals';
import { forgeFieldDisabled } from '../../field.disabled';

// MARK: Helper Functions
function fixedDateRangeInputValueFactory(mode: DbxDateTimeValueMode, timezoneInstance: Maybe<DateTimezoneUtcNormalInstance>): (input: Maybe<DateRangeWithDateOrStringValue>) => Maybe<DateRange> {
  const dateInputTransformer = dbxDateTimeInputValueParseFactory(mode, timezoneInstance);

  return (y) => {
    if (y) {
      return {
        start: dateInputTransformer(y.start) as Date,
        end: dateInputTransformer(y.end) as Date
      };
    }

    return undefined;
  };
}

function fixedDateRangeOutputValueFactory(mode: DbxDateTimeValueMode, timezoneInstance: Maybe<DateTimezoneUtcNormalInstance>): (date: Maybe<DateRange>) => Maybe<DateRangeWithDateOrStringValue> {
  const dateOutputTransformer = dbxDateTimeOutputValueFactory(mode, timezoneInstance);

  return (y) => {
    if (y) {
      return {
        start: dateOutputTransformer(y.start) as Date,
        end: dateOutputTransformer(y.end) as Date
      };
    }

    return undefined;
  };
}

const TIME_OUTPUT_THROTTLE_TIME: Milliseconds = 10;

// MARK: Internal Types
type SelectedDateEventType = 'calendar' | 'input';

interface SelectedDateEvent {
  readonly type: SelectedDateEventType;
  readonly range?: Maybe<Partial<DateRange>>;
}

// MARK: Value Interface
/**
 * Value shape for the fixed date range field.
 *
 * Uses the same `DateRange` shape as `@dereekb/date` — an object with `start` and `end` dates.
 * The actual stored value format depends on the configured `valueMode`.
 */
export interface DbxForgeFixedDateRangeValue {
  readonly start?: Maybe<Date>;
  readonly end?: Maybe<Date>;
}

// MARK: Props Interface
/**
 * Custom props for the forge fixed date range field.
 *
 * Full parity with formly `DbxFixedDateRangeFieldProps`.
 */
export interface DbxForgeFixedDateRangeFieldComponentProps {
  /**
   * Date range input to build the date range from a single picked date.
   * Required for 'single' mode and boundary-based selection modes.
   */
  readonly dateRangeInput?: ObservableOrValueGetter<DbxFixedDateRangeDateRangeInput>;
  /**
   * Selection mode to use when picking dates on the calendar.
   *
   * - `'single'` — Picks one date, range computed from dateRangeInput config.
   * - `'normal'` — Standard start/end range picking with two clicks.
   * - `'arbitrary'` — Free-form range selection within a boundary.
   * - `'arbitrary_quick'` — Like arbitrary, but immediately sets the value on first click.
   *
   * Defaults to `'single'`.
   */
  readonly selectionMode?: Maybe<ObservableOrValueGetter<DbxFixedDateRangeSelectionMode>>;
  /**
   * Value mode for the dates in the output DateRange.
   * Defaults to DATE.
   */
  readonly valueMode?: DbxDateTimeValueMode;
  /**
   * Whether to pass the date value as a UTC date, or a date in the current timezone.
   */
  readonly fullDayInUTC?: boolean;
  /**
   * Custom picker configuration (limits, schedule).
   */
  readonly pickerConfig?: ObservableOrValueGetter<DbxFixedDateRangePickerConfiguration>;
  /**
   * The input timezone to default to. Ignored if fullDayInUTC is true.
   */
  readonly timezone?: Maybe<ObservableOrValueGetter<Maybe<TimezoneString>>>;
  /**
   * Whether to display the timezone. Defaults to true.
   */
  readonly showTimezone?: boolean;
  /**
   * Custom presets.
   */
  readonly presets?: ObservableOrValueGetter<DateTimePresetConfiguration[]>;
  /**
   * Whether to show the range input text fields. Defaults to true.
   */
  readonly showRangeInput?: boolean;
  /**
   * Material form field appearance.
   */
  readonly appearance?: 'fill' | 'outline';
  /**
   * Hint text displayed below the field.
   */
  readonly hint?: DynamicText;
}

// MARK: Component
/**
 * Forge custom field component for selecting a fixed date range using an inline calendar.
 *
 * Full parity with formly `DbxFixedDateRangeFieldComponent`: supports multiple selection modes
 * (single, normal, arbitrary, arbitrary_quick), timezone conversion, date range input configuration,
 * picker config (limits, schedule), and optional text inputs for start/end dates.
 *
 * Uses a custom `MatDateRangeSelectionStrategy` for preview highlighting on the calendar.
 *
 * Registered as ng-forge type 'fixeddaterange'.
 */
@Component({
  selector: 'dbx-forge-fixeddaterange-field',
  standalone: true,
  imports: [MatDatepickerModule, MatFormFieldModule, ReactiveFormsModule, MatInputModule, MatError, NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fixeddaterange.field.component.html',
  providers: [
    {
      provide: MAT_DATE_RANGE_SELECTION_STRATEGY,
      useClass: forwardRef(() => DbxForgeFixedDateRangeFieldSelectionStrategy)
    }
  ]
})
export class DbxForgeFixedDateRangeFieldComponent {
  private readonly destroyRef = inject(DestroyRef);

  // MARK: ng-forge ValueFieldComponent inputs
  readonly field: InputSignal<FieldTree<unknown>> = input.required<FieldTree<unknown>>();
  readonly key: InputSignal<string> = input.required<string>();
  readonly label: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly placeholder: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly className: InputSignal<string> = input('');
  readonly tabIndex: InputSignal<number | undefined> = input<number | undefined>();
  readonly props: InputSignal<DbxForgeFixedDateRangeFieldComponentProps | undefined> = input<DbxForgeFixedDateRangeFieldComponentProps | undefined>();
  readonly meta: InputSignal<Record<string, unknown> | undefined> = input<Record<string, unknown> | undefined>();
  readonly validationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();

  // MARK: View children
  readonly calendar = viewChild.required<MatCalendar<Date>>(MatCalendar);
  readonly startDateInputElement = viewChild<string, ElementRef>('startDateInput', { read: ElementRef });
  readonly endDateInputElement = viewChild<string, ElementRef>('endDateInput', { read: ElementRef });

  // MARK: Internal signals
  readonly currentDateRangeInputSignal = signal<Maybe<DbxFixedDateRangeDateRangeInput>>(undefined);
  readonly currentSelectionModeSignal = signal<DbxFixedDateRangeSelectionMode>('single');

  // MARK: Subscription management
  private readonly _sub = new SubscriptionObject();
  private readonly _inputRangeFormSub = new SubscriptionObject();
  private readonly _inputRangeFormValueSub = new SubscriptionObject();
  private readonly _dateRangeInputSub = new SubscriptionObject();
  private readonly _currentSelectionModeSub = new SubscriptionObject();
  private readonly _disableEndSub = new SubscriptionObject();
  private readonly _activeDateSub = new SubscriptionObject();

  // MARK: BehaviorSubjects
  private readonly _config = new BehaviorSubject<Maybe<Observable<DbxFixedDateRangePickerConfiguration>>>(undefined);
  private readonly _selectionMode = new BehaviorSubject<Maybe<Observable<DbxFixedDateRangeSelectionMode>>>(undefined);
  private readonly _dateRangeInput = new BehaviorSubject<Maybe<Observable<DbxFixedDateRangeDateRangeInput>>>(undefined);
  private readonly _timezone = new BehaviorSubject<Maybe<Observable<Maybe<TimezoneString>>>>(undefined);

  // MARK: Event subject
  private readonly _selectionEvent = new Subject<SelectedDateEvent>();
  readonly selectedDateRange$: Observable<Maybe<Partial<DateRange>>> = this._selectionEvent.pipe(map((x) => x.range));

  // MARK: Form group for text inputs
  readonly inputRangeForm = new FormGroup({
    start: new FormControl<Maybe<Date>>(null),
    end: new FormControl<Maybe<Date>>(null)
  });

  // MARK: Computed signals from props
  readonly isRequired = computed(() => {
    try {
      const state = this.field()?.() as any;
      return (state?.required?.() as boolean) ?? false;
    } catch {
      return false;
    }
  });

  readonly isDisabled = forgeFieldDisabled();

  readonly valueMode = computed(() => this.props()?.valueMode ?? DbxDateTimeValueMode.DATE);
  readonly showRangeInput = computed(() => this.props()?.showRangeInput ?? true);
  readonly showTimezone = computed(() => this.props()?.showTimezone ?? true);

  readonly hasRequiredError = computed(() => {
    try {
      const state = this.field()?.() as any;
      const touched = state?.touched?.() as boolean;
      if (!touched) return false;
      const invalid = state?.invalid?.() as boolean;
      if (!invalid) return false;
      const errors = state?.errors?.() as Array<{ type?: string }> | undefined;
      return errors?.some((e) => e.type === 'required') ?? false;
    } catch {
      return false;
    }
  });

  // MARK: Field value reading
  readonly fieldValue = computed(() => {
    try {
      const state = this.field()?.() as any;
      return state?.value?.() as unknown;
    } catch {
      return undefined;
    }
  });

  readonly fieldValue$ = toObservable(this.fieldValue);

  // MARK: Observable pipelines
  readonly config$: Observable<DbxFixedDateRangePickerConfiguration> = this._config.pipe(
    map((x) => x ?? of({} as DbxFixedDateRangePickerConfiguration)),
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

  readonly timezone$: Observable<Maybe<TimezoneString>> = this._timezone.pipe(
    switchMapMaybeDefault(),
    distinctUntilChanged(),
    map((defaultTimezone) => defaultTimezone ?? guessCurrentTimezone()),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly timezoneInstance$: Observable<Maybe<DateTimezoneUtcNormalInstance>> = this.timezone$.pipe(
    map((timezone) => (timezone ? dateTimezoneUtcNormal({ timezone }) : undefined)),
    shareReplay(1)
  );

  readonly valueInSystemTimezone$: Observable<Maybe<DateRange>> = this.fieldValue$.pipe(
    combineLatestWith(this.timezoneInstance$),
    map(([raw, timezoneInstance]) => {
      if (raw == null) return undefined;
      const inputFactory = fixedDateRangeInputValueFactory(this.valueMode(), timezoneInstance);
      return inputFactory(raw as Maybe<DateRangeWithDateOrStringValue>);
    }),
    throttleTime(20, undefined, { leading: false, trailing: true }),
    distinctUntilChanged<Maybe<DateRange>>(isSameDateDayRange),
    shareReplay(1)
  );

  readonly minMaxRange$ = this.limitDateTimeInstance$.pipe(
    combineLatestWith(timer(MS_IN_MINUTE)),
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
      if (x && Object.keys(x).length > 0) {
        const dateFilter = dateTimeMinuteWholeDayDecisionFunction(x, false);
        return (d: Date | null) => (d != null ? dateFilter(d) : true);
      }
      return () => true;
    }),
    shareReplay(1)
  );

  readonly defaultPickerFilter: DecisionFunction<Date | null> = () => true;

  // MARK: Date range selection

  dateRangeSelectionForMode(mode: DbxFixedDateRangeSelectionMode) {
    const result: Observable<Maybe<DateRange>> = combineLatest([this.dateRangeInput$, this.limitDateTimeInstance$]).pipe(
      switchMap(([dateRangeInput, limitInstance]) => {
        const hasDateRangeConfiguration = Boolean(dateRangeInput);
        const minMaxClamp = (range: DateRange) => limitInstance.clampDateRange(range);

        if (mode === 'single') {
          return this.selectedDateRange$.pipe(
            distinctUntilChanged(isSameDateDayRange),
            map((inputDateRange) => {
              const date = inputDateRange?.start;
              return date ? (minMaxClamp(dateRange({ ...dateRangeInput, date } as DateRangeInput)) as DateRange) : null;
            })
          );
        } else {
          return this.selectedDateRange$.pipe(
            // eslint-disable-next-line sonarjs/cognitive-complexity
            scan((acc: FixedDateRangeScan, nextDateRange: Maybe<Partial<DateRange>>) => {
              let result: FixedDateRangeScan;
              let pickType: Maybe<FixedDateRangeScanType> = 'start';

              if (nextDateRange?.start != null) {
                const { start: startOrNextDate, end } = nextDateRange;
                const potentialBoundary = dateRange({ ...dateRangeInput, date: startOrNextDate } as DateRangeInput);

                if (startOrNextDate && end) {
                  const range = clampDateRangeToDateRange(nextDateRange, potentialBoundary) as DateRange;
                  result = {
                    lastDateRange: nextDateRange,
                    boundary: range,
                    range
                  };

                  if (mode === 'normal' && acc.lastPickType === 'start' && isSameDateDay(startOrNextDate, end) && isSameDateDay(startOrNextDate, acc.lastDateRange?.start)) {
                    pickType = 'startRepeat';
                  }
                } else {
                  let range: Maybe<DateRange> = undefined;
                  let boundary: Maybe<DateRange> = potentialBoundary;

                  if (mode === 'normal') {
                    if (!hasDateRangeConfiguration) {
                      boundary = undefined;
                      pickType = acc.lastPickType === 'start' ? 'end' : 'start';
                    } else if (acc.lastPickType === 'startRepeat') {
                      pickType = 'end';
                    } else {
                      pickType = acc.lastPickType === 'start' && acc.boundary && isDateInDateRange(startOrNextDate, acc.boundary) ? 'end' : 'start';
                    }

                    switch (pickType) {
                      case 'end': {
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

                        if (isBefore(boundaryToCheck.end, nextEnd)) {
                          nextStart = startOrNextDate;
                          nextEnd = startOrNextDate;
                          pickType = 'start';
                          boundary = boundaryToCheck;
                        } else {
                          boundary = range;
                        }

                        range = {
                          start: nextStart,
                          end: nextEnd
                        };
                        break;
                      }
                      case 'start':
                        range = {
                          start: startOrNextDate as Date,
                          end: startOrNextDate as Date
                        };
                        break;
                    }
                  } else if (acc.boundary && isDateInDateRange(startOrNextDate, acc.boundary)) {
                    range = {
                      start: acc.boundary.start,
                      end: startOrNextDate
                    };

                    if (mode === 'arbitrary_quick') {
                      if (isSameDateRange(acc.range, range) && isSameDateDay(range.end, startOrNextDate)) {
                        range = dateRange({ ...dateRangeInput, date: range.start } as DateRangeInput);
                        boundary = range;
                      } else {
                        boundary = range;
                      }
                    } else {
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
            filter((x) => !x.lastDateRange || x.range != null),
            map((x) => x.range ?? null)
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
        return this.valueInSystemTimezone$;
      } else {
        return this.fullBoundary$;
      }
    })
  );

  readonly calendarFocusDate$: Observable<Date> = this._selectionEvent.pipe(startWith(null)).pipe(
    switchMap((selectionEvent) => {
      if (selectionEvent?.type === 'calendar' && selectionEvent.range?.start) {
        return of(selectionEvent.range.start);
      } else {
        return this.fullBoundary$.pipe(
          first(),
          map((fullBoundary) => fullBoundary?.start ?? selectionEvent?.range?.start)
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

  // MARK: Template signals
  readonly minDateSignal = toSignal(this.min$, { initialValue: null });
  readonly maxDateSignal = toSignal(this.max$, { initialValue: null });
  readonly endDisabledSignal = toSignal(this.endDisabled$);
  readonly latestBoundarySignal = toSignal(this.latestBoundary$);
  readonly calendarSelectionSignal = toSignal(this.calendarSelection$, { initialValue: null });
  readonly pickerFilterSignal = toSignal(this.pickerFilter$, { initialValue: this.defaultPickerFilter });

  constructor() {
    // MARK: Effect — subscribe to async props
    effect(() => {
      const p = this.props();

      untracked(() => {
        // Picker config (provide default so pipeline can proceed without config)
        this._config.next(p?.pickerConfig ? asObservableFromGetter(p.pickerConfig) : of({} as DbxFixedDateRangePickerConfiguration));

        // Date range input
        if (p?.dateRangeInput) {
          this._dateRangeInput.next(asObservableFromGetter(p.dateRangeInput));
        }

        // Selection mode
        if (p?.selectionMode) {
          this._selectionMode.next(asObservableFromGetter(p.selectionMode));
        }

        // Timezone
        if (p?.timezone && !p?.fullDayInUTC) {
          this._timezone.next(asObservableFromGetter(p.timezone));
        }
      });
    });

    // MARK: Subscriptions — observable pipeline wiring
    const dateRangeSelection = this.dateRangeSelection$.pipe(shareReplay(1));

    const setInputFormValue = (value: Maybe<DateRange>) => {
      if (!isSameDateDayRange(value, this.inputRangeForm.value as Partial<DateRange>)) {
        this.inputRangeForm.setValue({
          start: value?.start ?? null,
          end: value?.end ?? null
        });
      }
    };

    // Main output subscription: dateRangeSelection → output value → field tree
    this._sub.subscription = this.valueInSystemTimezone$
      .pipe(
        combineLatestWith(this.timezoneInstance$.pipe(map((timezoneInstance) => fixedDateRangeOutputValueFactory(this.valueMode(), timezoneInstance)))),
        throttleTime(TIME_OUTPUT_THROTTLE_TIME, undefined, { leading: false, trailing: true }),
        switchMap(([currentValue, valueFactory]) => {
          return dateRangeSelection.pipe(
            skipAllInitialMaybe(),
            distinctUntilChanged<Maybe<DateRange>>(isSameDateDayRange),
            map((x) => [x, currentValue, valueFactory] as [typeof x, typeof currentValue, typeof valueFactory])
          );
        })
      )
      .subscribe(([rawValue, currentValue, valueFactory]) => {
        const value = rawValue ? valueFactory(rawValue) : null;
        const isSameRange = dbxDateRangeIsSameDateRangeFieldValue(value, currentValue);

        if (!isSameRange) {
          this._setFieldValue(value);
        } else if (rawValue != null) {
          setInputFormValue(rawValue);
        }
      });

    // Sync selection mode to signal
    this._currentSelectionModeSub.subscription = this.selectionMode$.subscribe((x) => this.currentSelectionModeSignal.set(x));

    // Sync dateRangeInput to signal
    this._dateRangeInputSub.subscription = this.dateRangeInput$.subscribe((x) => this.currentDateRangeInputSignal.set(x));

    // Sync inbound value to text input form
    this._inputRangeFormSub.subscription = this.valueInSystemTimezone$.subscribe((x: Maybe<DateRange>) => {
      setInputFormValue(x);
    });

    // End-disabled subscription
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

    // Calendar focus management
    this._activeDateSub.subscription = this.calendarFocusDate$.subscribe((x) => {
      const cal = this.calendar();
      if (cal) {
        cal.activeDate = x;
      }
    });

    // MARK: Effect — disabled state propagation
    effect(() => {
      const disabled = this.isDisabled();
      untracked(() => {
        if (disabled) {
          this.inputRangeForm.disable();
        } else {
          this.inputRangeForm.enable();

          // Re-apply end-disabled state after re-enabling
          this.endDisabled$.pipe(first()).subscribe((endDisabled) => {
            const end = this.inputRangeForm.get('end');
            if (end && endDisabled) {
              end.disable();
            }
          });
        }
      });
    });

    // MARK: Text input subscription (outbound: text inputs → selection)
    effect(() => {
      const showRange = this.showRangeInput();

      untracked(() => {
        this._inputRangeFormValueSub.destroy();

        if (showRange) {
          this._inputRangeFormValueSub.subscription = this.valueInSystemTimezone$
            .pipe(
              throttleTime(100),
              switchMap(() => {
                return this.inputRangeForm.valueChanges.pipe(
                  debounceTime(500),
                  filter(() => {
                    const startString = this.startDateInputElement()?.nativeElement?.value;
                    let valid = isMonthDaySlashDate(startString);

                    if (valid && this.currentSelectionModeSignal() !== 'single') {
                      const endString = this.endDateInputElement()?.nativeElement?.value;
                      valid = isMonthDaySlashDate(endString);
                    }

                    return valid;
                  }),
                  map((x) => x as Maybe<Partial<DateRange>>)
                );
              }),
              distinctUntilChanged(isSameDateRange)
            )
            .subscribe((x: Maybe<Partial<DateRange>>) => {
              const currentSelectionMode = this.currentSelectionModeSignal();

              if (currentSelectionMode === 'single') {
                this.setDateRange(x?.start ? { start: x.start } : null, 'input');
              } else {
                let rangeToSet: Maybe<Partial<DateRange>> = x;

                const latestBoundary = this.latestBoundarySignal();

                if (currentSelectionMode === 'arbitrary_quick' && latestBoundary && x?.start && x?.end && !isDateInDateRange(x.start, latestBoundary)) {
                  const boundary = dateRange({ ...this.currentDateRangeInputSignal(), date: x.start } as DateRangeInput);
                  rangeToSet = { start: x.start, end: boundary.end };
                }

                this.setDateRange(rangeToSet, 'input');
              }
            });
        }
      });
    });

    // MARK: Cleanup
    this.destroyRef.onDestroy(() => {
      this._sub.destroy();
      this._inputRangeFormSub.destroy();
      this._inputRangeFormValueSub.destroy();
      this._dateRangeInputSub.destroy();
      this._currentSelectionModeSub.destroy();
      this._disableEndSub.destroy();
      this._activeDateSub.destroy();
      this._config.complete();
      this._selectionMode.complete();
      this._dateRangeInput.complete();
      this._timezone.complete();
      this._selectionEvent.complete();
    });
  }

  // MARK: Public methods
  selectedChange(date: Maybe<Date>): void {
    this.setDateRange(date ? { start: date } : null, 'calendar');
  }

  setDateRange(range: Maybe<Partial<DateRange>>, type: SelectedDateEventType) {
    this._selectionEvent.next({ type, range });
  }

  _createDateRange(date: Maybe<Date>): Maybe<DateRange> {
    return date ? dateRange({ ...this.currentDateRangeInputSignal(), date } as DateRangeInput) : undefined;
  }

  // MARK: Private helpers
  private _setFieldValue(value: Maybe<DateRangeWithDateOrStringValue>): void {
    try {
      const fieldTree = this.field();
      const fieldState = fieldTree() as any;
      fieldState.value.set(value);
      fieldState.markAsTouched();
      fieldState.markAsDirty();
    } catch {
      // Field may not be ready
    }
  }
}

// MARK: Selection Strategy
/**
 * Custom Material date range selection strategy for the forge fixed date range field.
 *
 * Provides preview highlighting on the calendar based on the current selection mode
 * and boundary constraints.
 */
@Injectable()
export class DbxForgeFixedDateRangeFieldSelectionStrategy<D> implements MatDateRangeSelectionStrategy<D> {
  private readonly _dateAdapter = inject(DateAdapter<D>);
  readonly component = inject(DbxForgeFixedDateRangeFieldComponent);

  selectionFinished(date: D | null, currentRange: DatePickerDateRange<D>, _event: Event): DatePickerDateRange<D> {
    return currentRange;
  }

  createPreview(activeDate: D | null, _currentRange: DatePickerDateRange<D>, _event: Event): DatePickerDateRange<D> {
    const { currentSelectionModeSignal, latestBoundarySignal } = this.component;
    const currentSelectionMode = currentSelectionModeSignal();

    if (activeDate != null && currentSelectionMode !== 'single') {
      const latestBoundary = latestBoundarySignal();
      const date = this.dateFromAdapterDate(activeDate);

      if (latestBoundary && (currentSelectionMode === 'normal' || isDateInDateRange(date, latestBoundary))) {
        return this._createDateRange(latestBoundary);
      }
    }

    return this._createDateRangeWithDate(activeDate);
  }

  private _createDateRangeWithDate(input: D | null): DatePickerDateRange<D> {
    let range: Maybe<DateRange>;

    if (input) {
      const date = this.dateFromAdapterDate(input);
      range = this.component._createDateRange(date);
    }

    return this._createDateRange(range);
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

// MARK: Mapper
/**
 * Custom mapper for the fixeddaterange field type.
 *
 * Uses the standard valueFieldMapper pattern from ng-forge/integration.
 *
 * @param fieldDef - Field definition configuration
 * @param fieldDef.key - Form model key for the field
 * @returns Signal containing a Record of input names to values for ngComponentOutlet
 */
export function fixedDateRangeFieldMapper(fieldDef: { key: string }): Signal<Record<string, unknown>> {
  const ctx = resolveValueFieldContext();
  const defaultProps = inject(DEFAULT_PROPS);
  const defaultValidationMessages = inject(DEFAULT_VALIDATION_MESSAGES);

  return computed(() => {
    return buildValueFieldInputs(fieldDef as any, ctx, defaultProps?.(), defaultValidationMessages?.());
  });
}
