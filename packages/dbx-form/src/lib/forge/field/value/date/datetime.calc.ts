import { type Maybe, type ReadableTimeString } from '@dereekb/util';
import { dateFromLogicalDate, readableTimeStringToDate, utcDayForDate, DateTimeMinuteInstance, dateTimeMinuteDecisionFunction, findMinDate, findMaxDate } from '@dereekb/date';
import { startOfDay, addMinutes, addDays } from 'date-fns';
import { DbxDateTimeFieldTimeMode, type DbxDateTimePickerConfiguration, DBX_DATE_TIME_FIELD_DATE_NOT_IN_SCHEDULE_ERROR, DBX_DATE_TIME_FIELD_TIME_NOT_IN_RANGE_ERROR } from '../../../../formly/field/value/date/datetime.field.component';
import { type DateTimePreset } from '../../../../formly/field/value/date/datetime';

// MARK: Interfaces

/**
 * Input for computing a combined datetime from date/time field state.
 */
export interface DateTimeCalcInput {
  readonly dateValue: Maybe<Date>;
  readonly timeString: Maybe<ReadableTimeString>;
  readonly isFullDay: boolean;
  readonly fullDayInUTC: boolean;
  readonly isTimeOnly: boolean;
  readonly timeMode: DbxDateTimeFieldTimeMode;
  readonly timeDate: Maybe<Date>;
  readonly isCleared: boolean;
}

/**
 * Result of keyboard step computation.
 */
export interface KeyboardStepResult {
  readonly direction: number;
  readonly offset: number;
}

/**
 * Interface wrapping all datetime field calculation functions.
 */
export interface DateTimeFieldCalc {
  /**
   * Combines date + time inputs into a single Date value.
   *
   * This is the core logic that merges the separate date and time controls
   * into one unified datetime, handling fullDay, timeOnly, cleared states, and timeDate fallbacks.
   */
  buildCombinedDateTime(input: DateTimeCalcInput): Maybe<Date>;

  /**
   * Applies a keyboard offset (in steps) to a date, clamping to the given picker config limits.
   *
   * Each step is multiplied by minuteStep to get the actual minutes delta.
   * The result is clamped via DateTimeMinuteInstance.
   *
   * @param input - The time offset input containing date, step offset, minute step, and optional config
   */
  applyTimeOffset(input: ApplyTimeOffsetInput): Date;

  /**
   * Merges picker config limits with min/max values from synced fields.
   *
   * Sync "before" values contribute a minimum date (this field must be after that value).
   * Sync "after" values contribute a maximum date (this field must be before that value).
   */
  mergePickerConfig(config: Maybe<DbxDateTimePickerConfiguration>, syncBeforeValue: Date | null, syncAfterValue: Date | null): Maybe<DbxDateTimePickerConfiguration>;

  /**
   * Filters presets based on selected date, fullDay/timeOnly state, and config limits.
   *
   * - Returns empty array when fullDay is active.
   * - Returns all presets unfiltered when timeOnly (no date-based filtering).
   * - Otherwise evaluates each preset against the selected date and config limits.
   *
   * @param input - The filter presets input containing presets, selected date, mode flags, and optional config
   */
  filterPresets(input: FilterPresetsInput): DateTimePreset[];

  /**
   * Computes a human-readable error message from a form field's error record.
   */
  computeErrorMessage(errors: Maybe<Record<string, unknown>>, isRequired: boolean): string | undefined;
}

// MARK: Factory

/**
 * Creates a {@link DateTimeFieldCalc} instance with all datetime calculation functions.
 *
 * @returns A DateTimeFieldCalc instance bundling all pure datetime calculation functions
 */
export function dateTimeFieldCalc(): DateTimeFieldCalc {
  return {
    buildCombinedDateTime,
    applyTimeOffset,
    mergePickerConfig,
    filterPresets,
    computeErrorMessage
  };
}

// MARK: Pure Functions

/**
 * Combines date and time inputs into a single Date.
 *
 * Handles fullDay, timeOnly, cleared states, and timeDate fallbacks to produce
 * a unified datetime value from the separate date and time form controls.
 *
 * @param input - The datetime calculation input containing date, time, and mode information
 * @returns The combined Date value, or undefined if the input is cleared or incomplete
 */
export function buildCombinedDateTime(input: DateTimeCalcInput): Maybe<Date> {
  const { dateValue, timeString, isFullDay, fullDayInUTC, isTimeOnly, timeMode, timeDate, isCleared } = input;

  let result: Maybe<Date> = undefined;

  if (!isCleared) {
    let date = dateValue;

    if (!date || isTimeOnly) {
      date = timeDate ?? new Date();
    }

    if (date) {
      if (isFullDay) {
        result = fullDayInUTC ? utcDayForDate(date) : startOfDay(date);
      } else if (timeString) {
        result =
          readableTimeStringToDate(timeString, {
            date,
            useSystemTimezone: true
          }) ?? date;
      } else if (!isTimeOnly && timeMode !== DbxDateTimeFieldTimeMode.REQUIRED) {
        // If time is not required and no time string, return the date as-is
        result = date;
      }
    }
  }

  return result;
}

/**
 * Input for {@link applyTimeOffset}.
 */
export interface ApplyTimeOffsetInput {
  readonly date: Date;
  readonly stepsOffset: number;
  readonly minuteStep: number;
  readonly config?: Maybe<DbxDateTimePickerConfiguration>;
}

/**
 * Applies a keyboard time offset (in step increments) and clamps to picker config limits.
 *
 * @param input - The time offset input containing date, step offset, minute step, and optional config
 * @returns The offset date, clamped to the picker config limits
 */
export function applyTimeOffset(input: ApplyTimeOffsetInput): Date {
  const { date, stepsOffset, minuteStep, config } = input;
  const instance = new DateTimeMinuteInstance({
    date,
    ...config,
    roundDownToMinute: true
  });

  let result = instance.clamp(date);
  const minutes = stepsOffset * minuteStep;

  if (minutes !== 0) {
    result = addMinutes(result, minutes);
    result = instance.clamp(result);
  }

  return result;
}

/**
 * Merges picker config with sync constraint values (before/after from synced fields).
 *
 * Sync "before" values contribute a minimum date (this field must be after that value).
 * Sync "after" values contribute a maximum date (this field must be before that value).
 *
 * @param config - The base picker configuration to merge into
 * @param syncBeforeValue - Minimum date constraint from a synced "before" field, or null
 * @param syncAfterValue - Maximum date constraint from a synced "after" field, or null
 * @returns The merged picker configuration with updated limits, or the original config if no sync values
 */
export function mergePickerConfig(config: Maybe<DbxDateTimePickerConfiguration>, syncBeforeValue: Date | null, syncAfterValue: Date | null): Maybe<DbxDateTimePickerConfiguration> {
  let result: Maybe<DbxDateTimePickerConfiguration> = config;

  if (syncBeforeValue != null || syncAfterValue != null) {
    const { min: limitMin, max: limitMax } = config?.limits ?? {};
    const min = findMinDate([syncBeforeValue, dateFromLogicalDate(limitMin)]);
    const max = findMaxDate([syncAfterValue, dateFromLogicalDate(limitMax)]);

    result = {
      ...config,
      limits: {
        ...config?.limits,
        min,
        max
      }
    };
  }

  return result;
}

/**
 * Input for {@link filterPresets}.
 */
export interface FilterPresetsInput {
  readonly presets: DateTimePreset[];
  readonly selectedDate: Maybe<Date>;
  readonly isFullDay: boolean;
  readonly isTimeOnly: boolean;
  readonly config?: Maybe<DbxDateTimePickerConfiguration>;
}

/**
 * Filters presets based on the current field state and config limits.
 *
 * Returns an empty array when fullDay is active (no time presets apply).
 * Returns all presets unfiltered when timeOnly (no date-based filtering needed).
 * Otherwise evaluates each preset against the selected date and config limits.
 *
 * @param input - The filter presets input containing presets, selected date, mode flags, and optional config
 * @returns The filtered array of applicable presets
 */
export function filterPresets(input: FilterPresetsInput): DateTimePreset[] {
  const { presets, selectedDate, isFullDay, isTimeOnly, config } = input;
  let result: DateTimePreset[];

  if (isFullDay) {
    result = [];
  } else if (isTimeOnly) {
    result = presets;
  } else if (!selectedDate) {
    result = [];
  } else {
    const isAllowedDate = config ? (x: Date | null) => (x != null ? dateTimeMinuteDecisionFunction(config)(x) : true) : () => true;

    result = presets.filter((preset) => {
      const value = preset.value();
      let presetDate: Maybe<Date>;

      if (value.logicalDate) {
        presetDate = dateFromLogicalDate(value.logicalDate);
      } else if (value.timeString) {
        presetDate = readableTimeStringToDate(value.timeString, {
          date: selectedDate,
          useSystemTimezone: true
        });
      }

      return presetDate ? isAllowedDate(presetDate) : false;
    });
  }

  return result;
}

/**
 * Computes a human-readable error message from a field's error record.
 *
 * Checks for required, schedule, time range, and pattern errors in priority order.
 *
 * @param errors - The validation error record from the form field, or null/undefined
 * @param isRequired - Whether the field is required (affects the "required" error message)
 * @returns A human-readable error message string, or undefined if no errors exist
 */
export function computeErrorMessage(errors: Maybe<Record<string, unknown>>, isRequired: boolean): string | undefined {
  let result: string | undefined;

  if (errors && Object.keys(errors).length > 0) {
    if (isRequired && errors['required']) {
      result = 'Date is required';
    } else if (errors[DBX_DATE_TIME_FIELD_DATE_NOT_IN_SCHEDULE_ERROR]) {
      result = 'Date does not fall on an available dates in schedule.';
    } else if (errors[DBX_DATE_TIME_FIELD_TIME_NOT_IN_RANGE_ERROR]) {
      result = 'Time is not valid for the given date.';
    } else if (errors['pattern']) {
      result = 'The input time is not recognizable.';
    } else {
      result = 'The given date and time is invalid.';
    }
  }

  return result;
}

// MARK: Keyboard Step Functions

/**
 * Computes the date keyboard navigation step from a KeyboardEvent.
 *
 * - ArrowUp/Down: ±1 day
 * - Ctrl: ±30 days
 * - Shift: ±7 days
 * - Ctrl+Shift: ±365 days
 *
 * Returns null if the event is not a recognized arrow key.
 *
 * @param event - The keyboard event to evaluate
 * @returns A KeyboardStepResult with direction and offset, or null if the key is not an arrow key
 */
export function computeDateKeyboardStep(event: KeyboardEvent): KeyboardStepResult | null {
  let result: KeyboardStepResult | null = null;
  let direction: number | null = null;

  switch (event.key?.toLowerCase()) {
    case 'arrowup':
      direction = 1;
      break;
    case 'arrowdown':
      direction = -1;
      break;
  }

  if (direction != null) {
    let offset = 1;

    if (event.ctrlKey && event.shiftKey) {
      offset = 365;
    } else if (event.ctrlKey) {
      offset = 30;
    } else if (event.shiftKey) {
      offset = 7;
    }

    result = { direction, offset };
  }

  return result;
}

/**
 * Computes the time keyboard navigation step from a KeyboardEvent.
 *
 * - ArrowUp/Down: ±1 step
 * - Alt: ±60 steps (typically minutes)
 * - Shift: ±5 steps
 * - Alt+Shift: ±300 steps
 *
 * Returns null if the event is not a recognized arrow key.
 *
 * @param event - The keyboard event to evaluate
 * @returns A KeyboardStepResult with direction and offset, or null if the key is not an arrow key
 */
export function computeTimeKeyboardStep(event: KeyboardEvent): KeyboardStepResult | null {
  let result: KeyboardStepResult | null = null;
  let direction: number | null = null;

  switch (event.key?.toLowerCase()) {
    case 'arrowup':
      direction = 1;
      break;
    case 'arrowdown':
      direction = -1;
      break;
  }

  if (direction != null) {
    let offset = 1;

    if (event.altKey && event.shiftKey) {
      offset = 300;
    } else if (event.altKey) {
      offset = 60;
    } else if (event.shiftKey) {
      offset = 5;
    }

    result = { direction, offset };
  }

  return result;
}

// MARK: Date Navigation Helper

/**
 * Navigates to a new date by applying a keyboard step, validating against the schedule, and clamping to limits.
 *
 * @param currentDate - The current date to navigate from
 * @param step - The keyboard step result (direction + offset in days)
 * @param config - Optional picker config for schedule/limit validation
 * @returns The new date, or null if no valid date is available in the requested direction
 */
export function navigateDate(currentDate: Date, step: KeyboardStepResult, config: Maybe<DbxDateTimePickerConfiguration>): Maybe<Date> {
  const newDate = startOfDay(addDays(currentDate, step.offset * step.direction));
  const instance = new DateTimeMinuteInstance({
    date: newDate,
    ...config
  });

  let nextDate: Maybe<Date>;

  if (instance.isInSchedule(newDate)) {
    nextDate = newDate;
  } else {
    const direction = step.direction === 1 ? 'future' : 'past';
    nextDate = instance.findNextAvailableDayInSchedule(newDate, direction);
  }
  let result: Maybe<Date> = undefined;

  if (nextDate != null) {
    result = instance.clampToLimit(nextDate);
  }

  return result;
}
