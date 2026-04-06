import { describe, it, expect } from 'vitest';
import { startOfDay, setHours, setMinutes } from 'date-fns';
import { utcDayForDate } from '@dereekb/date';
import { DbxDateTimeFieldTimeMode, DBX_DATE_TIME_FIELD_DATE_NOT_IN_SCHEDULE_ERROR, DBX_DATE_TIME_FIELD_TIME_NOT_IN_RANGE_ERROR } from '../../../../formly/field/value/date/datetime.field.component';
import { type DateTimeCalcInput, dateTimeFieldCalc, buildCombinedDateTime, applyTimeOffset, mergePickerConfig, filterPresets, computeErrorMessage, computeDateKeyboardStep, computeTimeKeyboardStep, navigateDate, type KeyboardStepResult } from './datetime.calc';

// MARK: dateTimeFieldCalc
describe('dateTimeFieldCalc()', () => {
  it('should return an object implementing DateTimeFieldCalc', () => {
    const calc = dateTimeFieldCalc();
    expect(calc.buildCombinedDateTime).toBeDefined();
    expect(calc.applyTimeOffset).toBeDefined();
    expect(calc.mergePickerConfig).toBeDefined();
    expect(calc.filterPresets).toBeDefined();
    expect(calc.computeErrorMessage).toBeDefined();
  });
});

// MARK: buildCombinedDateTime
describe('buildCombinedDateTime()', () => {
  const baseDate = new Date(2024, 5, 15, 0, 0, 0); // June 15, 2024

  function makeInput(overrides: Partial<DateTimeCalcInput> = {}): DateTimeCalcInput {
    return {
      dateValue: baseDate,
      timeString: null,
      isFullDay: false,
      fullDayInUTC: false,
      isTimeOnly: false,
      timeMode: DbxDateTimeFieldTimeMode.REQUIRED,
      timeDate: null,
      isCleared: false,
      ...overrides
    };
  }

  it('should return undefined when isCleared is true', () => {
    const result = buildCombinedDateTime(makeInput({ isCleared: true }));
    expect(result).toBeUndefined();
  });

  it('should return undefined when isCleared is true even with date and time', () => {
    const result = buildCombinedDateTime(makeInput({ isCleared: true, timeString: '10:00AM' }));
    expect(result).toBeUndefined();
  });

  describe('fullDay mode', () => {
    it('should return startOfDay when fullDay and not UTC', () => {
      const result = buildCombinedDateTime(makeInput({ isFullDay: true }));
      expect(result).toEqual(startOfDay(baseDate));
    });

    it('should return utcDayForDate when fullDay and fullDayInUTC', () => {
      const result = buildCombinedDateTime(makeInput({ isFullDay: true, fullDayInUTC: true }));
      expect(result).toEqual(utcDayForDate(baseDate));
    });
  });

  describe('with time string', () => {
    it('should combine date and time string', () => {
      const result = buildCombinedDateTime(makeInput({ timeString: '10:30AM' }));
      expect(result).toBeDefined();
      expect(result!.getHours()).toBe(10);
      expect(result!.getMinutes()).toBe(30);
      expect(result!.getFullYear()).toBe(2024);
      expect(result!.getMonth()).toBe(5);
      expect(result!.getDate()).toBe(15);
    });

    it('should combine date and 24-hour time string', () => {
      const result = buildCombinedDateTime(makeInput({ timeString: '14:00' }));
      expect(result).toBeDefined();
      expect(result!.getHours()).toBe(14);
      expect(result!.getMinutes()).toBe(0);
    });
  });

  describe('time-only mode', () => {
    it('should use timeDate when no dateValue and isTimeOnly', () => {
      const timeDateValue = new Date(2024, 2, 10);
      const result = buildCombinedDateTime(
        makeInput({
          dateValue: null,
          isTimeOnly: true,
          timeDate: timeDateValue,
          timeString: '9:00AM'
        })
      );
      expect(result).toBeDefined();
      expect(result!.getMonth()).toBe(2); // March
      expect(result!.getDate()).toBe(10);
      expect(result!.getHours()).toBe(9);
    });

    it('should fall back to current date when isTimeOnly and no timeDate', () => {
      const result = buildCombinedDateTime(
        makeInput({
          dateValue: null,
          isTimeOnly: true,
          timeString: '9:00AM'
        })
      );
      expect(result).toBeDefined();
      expect(result!.getHours()).toBe(9);
    });
  });

  describe('no time string', () => {
    it('should return undefined when time is required and no time string', () => {
      const result = buildCombinedDateTime(
        makeInput({
          timeMode: DbxDateTimeFieldTimeMode.REQUIRED,
          timeString: null
        })
      );
      expect(result).toBeUndefined();
    });

    it('should return date as-is when time is optional and no time string', () => {
      const result = buildCombinedDateTime(
        makeInput({
          timeMode: DbxDateTimeFieldTimeMode.OPTIONAL,
          timeString: null
        })
      );
      expect(result).toEqual(baseDate);
    });

    it('should return date as-is when time is none and no time string', () => {
      const result = buildCombinedDateTime(
        makeInput({
          timeMode: DbxDateTimeFieldTimeMode.NONE,
          timeString: null
        })
      );
      expect(result).toEqual(baseDate);
    });
  });

  describe('no date', () => {
    it('should return undefined when no dateValue and not timeOnly', () => {
      const result = buildCombinedDateTime(makeInput({ dateValue: null }));
      expect(result).toBeUndefined();
    });
  });
});

// MARK: applyTimeOffset
describe('applyTimeOffset()', () => {
  const baseDate = setMinutes(setHours(new Date(2024, 5, 15), 10), 0); // 10:00AM

  it('should add minutes when offset is positive', () => {
    const result = applyTimeOffset(baseDate, 1, 5, undefined);
    expect(result.getHours()).toBe(10);
    expect(result.getMinutes()).toBe(5);
  });

  it('should subtract minutes when offset is negative', () => {
    const result = applyTimeOffset(baseDate, -1, 5, undefined);
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(55);
  });

  it('should multiply offset by minuteStep', () => {
    const result = applyTimeOffset(baseDate, 3, 15, undefined);
    expect(result.getHours()).toBe(10);
    expect(result.getMinutes()).toBe(45);
  });

  it('should return clamped date when offset is 0', () => {
    const result = applyTimeOffset(baseDate, 0, 5, undefined);
    expect(result.getHours()).toBe(10);
    expect(result.getMinutes()).toBe(0);
  });

  it('should clamp to min limit from config', () => {
    const minDate = setMinutes(setHours(new Date(2024, 5, 15), 10), 30);
    const result = applyTimeOffset(baseDate, 0, 5, { limits: { min: minDate } });
    // After clamping, should be at or after 10:30
    expect(result.getTime()).toBeGreaterThanOrEqual(minDate.getTime());
  });
});

// MARK: mergePickerConfig
describe('mergePickerConfig()', () => {
  it('should return config unchanged when no sync values', () => {
    const config = { limits: { isFuture: true } };
    const result = mergePickerConfig(config, null, null);
    expect(result).toBe(config);
  });

  it('should return config unchanged when both sync values are null', () => {
    const config = {};
    const result = mergePickerConfig(config, null, null);
    expect(result).toBe(config);
  });

  it('should add min from syncBeforeValue', () => {
    const syncDate = new Date(2024, 5, 10);
    const result = mergePickerConfig({}, syncDate, null);
    expect(result).toBeDefined();
    expect(result!.limits?.min).toEqual(syncDate);
  });

  it('should add max from syncAfterValue', () => {
    const syncDate = new Date(2024, 5, 20);
    const result = mergePickerConfig({}, null, syncDate);
    expect(result).toBeDefined();
    expect(result!.limits?.max).toEqual(syncDate);
  });

  it('should add both min and max from sync values', () => {
    const minDate = new Date(2024, 5, 10);
    const maxDate = new Date(2024, 5, 20);
    const result = mergePickerConfig({}, minDate, maxDate);
    expect(result).toBeDefined();
    expect(result!.limits?.min).toEqual(minDate);
    expect(result!.limits?.max).toEqual(maxDate);
  });

  it('should merge sync values with existing limits', () => {
    const existingMin = new Date(2024, 5, 5);
    const syncMin = new Date(2024, 5, 10); // later than existing
    const config = { limits: { min: existingMin } };
    const result = mergePickerConfig(config, syncMin, null);
    expect(result).toBeDefined();
    // findMinDate picks the earliest, so existing min should win
    expect(result!.limits?.min).toEqual(existingMin);
  });

  it('should return undefined-safe result when config is undefined', () => {
    const syncDate = new Date(2024, 5, 10);
    const result = mergePickerConfig(undefined, syncDate, null);
    expect(result).toBeDefined();
    expect(result!.limits?.min).toEqual(syncDate);
  });
});

// MARK: filterPresets
describe('filterPresets()', () => {
  function makePreset(timeString: string, label = 'test'): { label: () => string; value: () => { timeString: string } } {
    return {
      label: () => label,
      value: () => ({ timeString })
    };
  }

  const presets = [makePreset('8:00AM', 'Morning'), makePreset('12:00PM', 'Noon'), makePreset('5:00PM', 'Evening')];

  it('should return empty array when fullDay is true', () => {
    const result = filterPresets(presets, new Date(), true, false, undefined);
    expect(result).toEqual([]);
  });

  it('should return all presets when timeOnly is true', () => {
    const result = filterPresets(presets, undefined, false, true, undefined);
    expect(result).toEqual(presets);
  });

  it('should return empty array when no selectedDate and not timeOnly', () => {
    const result = filterPresets(presets, undefined, false, false, undefined);
    expect(result).toEqual([]);
  });

  it('should return all presets when selectedDate provided and no config limits', () => {
    const selectedDate = new Date(2024, 5, 15);
    const result = filterPresets(presets, selectedDate, false, false, undefined);
    expect(result.length).toBe(3);
  });
});

// MARK: computeErrorMessage
describe('computeErrorMessage()', () => {
  it('should return undefined for null errors', () => {
    expect(computeErrorMessage(null, false)).toBeUndefined();
  });

  it('should return undefined for empty errors', () => {
    expect(computeErrorMessage({}, false)).toBeUndefined();
  });

  it('should return required message when required error present and isRequired', () => {
    expect(computeErrorMessage({ required: true }, true)).toBe('Date is required');
  });

  it('should not return required message when not isRequired', () => {
    const result = computeErrorMessage({ required: true }, false);
    // Falls through to generic message since isRequired is false
    expect(result).toBe('The given date and time is invalid.');
  });

  it('should return schedule error message', () => {
    expect(computeErrorMessage({ [DBX_DATE_TIME_FIELD_DATE_NOT_IN_SCHEDULE_ERROR]: true }, false)).toBe('Date does not fall on an available dates in schedule.');
  });

  it('should return time range error message', () => {
    expect(computeErrorMessage({ [DBX_DATE_TIME_FIELD_TIME_NOT_IN_RANGE_ERROR]: true }, false)).toBe('Time is not valid for the given date.');
  });

  it('should return pattern error message', () => {
    expect(computeErrorMessage({ pattern: true }, false)).toBe('The input time is not recognizable.');
  });

  it('should return generic error for unknown error keys', () => {
    expect(computeErrorMessage({ unknownError: true }, false)).toBe('The given date and time is invalid.');
  });
});

// MARK: computeDateKeyboardStep
describe('computeDateKeyboardStep()', () => {
  function makeEvent(key: string, modifiers: Partial<{ ctrlKey: boolean; shiftKey: boolean }> = {}): KeyboardEvent {
    return { key, ctrlKey: false, shiftKey: false, altKey: false, ...modifiers } as KeyboardEvent;
  }

  it('should return null for non-arrow keys', () => {
    expect(computeDateKeyboardStep(makeEvent('Enter'))).toBeNull();
    expect(computeDateKeyboardStep(makeEvent('Tab'))).toBeNull();
    expect(computeDateKeyboardStep(makeEvent('a'))).toBeNull();
  });

  it('should return direction=1 for ArrowUp', () => {
    const result = computeDateKeyboardStep(makeEvent('ArrowUp'));
    expect(result).toEqual({ direction: 1, offset: 1 });
  });

  it('should return direction=-1 for ArrowDown', () => {
    const result = computeDateKeyboardStep(makeEvent('ArrowDown'));
    expect(result).toEqual({ direction: -1, offset: 1 });
  });

  it('should return offset=30 with Ctrl', () => {
    const result = computeDateKeyboardStep(makeEvent('ArrowUp', { ctrlKey: true }));
    expect(result).toEqual({ direction: 1, offset: 30 });
  });

  it('should return offset=7 with Shift', () => {
    const result = computeDateKeyboardStep(makeEvent('ArrowDown', { shiftKey: true }));
    expect(result).toEqual({ direction: -1, offset: 7 });
  });

  it('should return offset=365 with Ctrl+Shift', () => {
    const result = computeDateKeyboardStep(makeEvent('ArrowUp', { ctrlKey: true, shiftKey: true }));
    expect(result).toEqual({ direction: 1, offset: 365 });
  });
});

// MARK: computeTimeKeyboardStep
describe('computeTimeKeyboardStep()', () => {
  function makeEvent(key: string, modifiers: Partial<{ altKey: boolean; shiftKey: boolean }> = {}): KeyboardEvent {
    return { key, ctrlKey: false, shiftKey: false, altKey: false, ...modifiers } as KeyboardEvent;
  }

  it('should return null for non-arrow keys', () => {
    expect(computeTimeKeyboardStep(makeEvent('Enter'))).toBeNull();
  });

  it('should return direction=1, offset=1 for ArrowUp', () => {
    const result = computeTimeKeyboardStep(makeEvent('ArrowUp'));
    expect(result).toEqual({ direction: 1, offset: 1 });
  });

  it('should return direction=-1, offset=1 for ArrowDown', () => {
    const result = computeTimeKeyboardStep(makeEvent('ArrowDown'));
    expect(result).toEqual({ direction: -1, offset: 1 });
  });

  it('should return offset=60 with Alt', () => {
    const result = computeTimeKeyboardStep(makeEvent('ArrowUp', { altKey: true }));
    expect(result).toEqual({ direction: 1, offset: 60 });
  });

  it('should return offset=5 with Shift', () => {
    const result = computeTimeKeyboardStep(makeEvent('ArrowDown', { shiftKey: true }));
    expect(result).toEqual({ direction: -1, offset: 5 });
  });

  it('should return offset=300 with Alt+Shift', () => {
    const result = computeTimeKeyboardStep(makeEvent('ArrowUp', { altKey: true, shiftKey: true }));
    expect(result).toEqual({ direction: 1, offset: 300 });
  });
});

// MARK: navigateDate
describe('navigateDate()', () => {
  const baseDate = new Date(2024, 5, 15); // June 15, 2024

  it('should navigate forward by 1 day', () => {
    const result = navigateDate(baseDate, { direction: 1, offset: 1 }, undefined);
    expect(result).toBeDefined();
    expect(result!.getDate()).toBe(16);
  });

  it('should navigate backward by 1 day', () => {
    const result = navigateDate(baseDate, { direction: -1, offset: 1 }, undefined);
    expect(result).toBeDefined();
    expect(result!.getDate()).toBe(14);
  });

  it('should navigate forward by 7 days', () => {
    const result = navigateDate(baseDate, { direction: 1, offset: 7 }, undefined);
    expect(result).toBeDefined();
    expect(result!.getDate()).toBe(22);
  });

  it('should navigate backward by 30 days', () => {
    const result = navigateDate(baseDate, { direction: -1, offset: 30 }, undefined);
    expect(result).toBeDefined();
    expect(result!.getMonth()).toBe(4); // May
    expect(result!.getDate()).toBe(16);
  });
});
