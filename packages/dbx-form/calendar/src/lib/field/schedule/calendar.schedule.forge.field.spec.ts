import { describe, it, expect } from 'vitest';
import { addDays, startOfDay } from 'date-fns';
import { type DateCellScheduleDateFilterConfig, DateCellScheduleDayCodesInput, DateCellScheduleEncodedWeek, dateCellTiming, type DateRange } from '@dereekb/date';
import { BehaviorSubject } from 'rxjs';
import { type Maybe, type TimezoneString } from '@dereekb/util';
import { type CalendarScheduleSelectionState, initialCalendarScheduleSelectionState, updateStateWithChangedDates, updateStateWithChangedRange, updateStateWithComputeSelectionResultRelativeToFilter, updateStateWithDateCellScheduleRangeValue, updateStateWithFilter, updateStateWithInitialSelectionState, updateStateWithMinMaxDateRange, updateStateWithTimezoneValue } from '../../calendar.schedule.selection.store';
import { dbxForgeDateScheduleRangeField, FORGE_CALENDAR_DATE_SCHEDULE_RANGE_FIELD_TYPE } from './calendar.schedule.forge.field';

describe('dbxForgeDateScheduleRangeField()', () => {
  it('should create a schedule range field with correct type', () => {
    const field = dbxForgeDateScheduleRangeField();
    expect(field.type).toBe(FORGE_CALENDAR_DATE_SCHEDULE_RANGE_FIELD_TYPE);
    expect(field.type).toBe('dbx-forge-calendar-date-schedule-range');
  });

  it('should default key to schedule', () => {
    const field = dbxForgeDateScheduleRangeField();
    expect(field.key).toBe('schedule');
  });

  it('should default label to Schedule', () => {
    const field = dbxForgeDateScheduleRangeField();
    expect(field.label).toBe('Schedule');
  });

  it('should use custom key when specified', () => {
    const field = dbxForgeDateScheduleRangeField({ key: 'dateRange' });
    expect(field.key).toBe('dateRange');
  });

  it('should use custom label when specified', () => {
    const field = dbxForgeDateScheduleRangeField({ label: 'Date Schedule' });
    expect(field.label).toBe('Date Schedule');
  });

  it('should set required when specified', () => {
    const field = dbxForgeDateScheduleRangeField({ required: true });
    expect(field.required).toBe(true);
  });

  it('should not include required when not specified', () => {
    const field = dbxForgeDateScheduleRangeField();
    expect(field.required).toBeUndefined();
  });

  it('should set readonly when specified', () => {
    const field = dbxForgeDateScheduleRangeField({ readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should not include readonly when not specified', () => {
    const field = dbxForgeDateScheduleRangeField();
    expect(field.readonly).toBeUndefined();
  });

  describe('scenario', () => {
    describe('Date Schedule with Timing Filter and Min Date Range', () => {
      // Reproduces the exact demo config from calendar.component.ts.
      // Known issue: the store produces a valid selection value, but the component's
      // store→field sync fires before the ng-forge field input is available (NG0950),
      // so the form never receives the initial value.
      const today = startOfDay(new Date());
      const daysInFilter = 60;
      const minDateOffset = 4;

      const timezone$ = new BehaviorSubject<Maybe<TimezoneString>>(undefined);

      const filterConfig: DateCellScheduleDateFilterConfig = {
        ...dateCellTiming({ startsAt: today, duration: 60 }, daysInFilter, 'UTC'),
        w: '89' as DateCellScheduleEncodedWeek,
        ex: [] as number[]
      };

      const field = dbxForgeDateScheduleRangeField({
        outputTimezone: timezone$,
        key: 'dateScheduleWithTimingFilterAndMinDateRange',
        label: 'Date Schedule with Timing Filter and Min Date Range',
        required: false,
        description: 'Date schedule with a filter and an explicit min date to be 4 days from now',
        filter: filterConfig,
        minMaxDateRange: { start: addDays(today, minDateOffset) },
        computeSelectionResultRelativeToFilter: true,
        initialSelectionState: 'all'
      });

      it('should create a field with the correct type and key', () => {
        expect(field.type).toBe(FORGE_CALENDAR_DATE_SCHEDULE_RANGE_FIELD_TYPE);
        expect(field.key).toBe('dateScheduleWithTimingFilterAndMinDateRange');
      });

      it('should pass filter, minMaxDateRange, and initialSelectionState through props', () => {
        expect(field.props?.filter).toBe(filterConfig);
        expect(field.props?.minMaxDateRange).toEqual({ start: addDays(today, minDateOffset) });
        expect(field.props?.computeSelectionResultRelativeToFilter).toBe(true);
        expect(field.props?.initialSelectionState).toBe('all');
      });

      describe('store', () => {
        function createConfiguredState() {
          let state = initialCalendarScheduleSelectionState();
          state = updateStateWithMinMaxDateRange(state, field.props!.minMaxDateRange as Partial<DateRange>);
          state = updateStateWithComputeSelectionResultRelativeToFilter(state, field.props!.computeSelectionResultRelativeToFilter!);
          state = updateStateWithFilter(state, field.props!.filter as DateCellScheduleDateFilterConfig);
          state = updateStateWithInitialSelectionState(state, field.props!.initialSelectionState!);
          return state;
        }

        it('should produce a currentSelectionValue after initialSelectionState "all" is applied', () => {
          const state = createConfiguredState();
          expect(state.currentSelectionValue).toBeDefined();
          expect(state.currentSelectionValue?.dateScheduleRange).toBeDefined();
        });

        it('should not reset the start date when selecting a range within the minMaxDateRange', () => {
          let state = createConfiguredState();

          const rangeStart = addDays(today, minDateOffset);
          const rangeEnd = addDays(today, minDateOffset + 2);
          state = updateStateWithChangedRange(state, { inputStart: rangeStart, inputEnd: rangeEnd });

          expect(state.inputStart).toEqual(startOfDay(rangeStart));
          expect(state.inputEnd).toEqual(startOfDay(rangeEnd));
          expect(state.currentSelectionValue).toBeDefined();
          expect(state.currentSelectionValue?.dateScheduleRange).toBeDefined();
        });

        it('should retain the selected range after changing it to a different valid range', () => {
          let state = createConfiguredState();

          const rangeStart = addDays(today, minDateOffset);
          const rangeEnd = addDays(today, minDateOffset + 2);
          state = updateStateWithChangedRange(state, { inputStart: rangeStart, inputEnd: rangeEnd });

          const newRangeEnd = addDays(today, minDateOffset + 4);
          state = updateStateWithChangedRange(state, { inputStart: rangeStart, inputEnd: newRangeEnd });

          expect(state.inputStart).toEqual(startOfDay(rangeStart));
          expect(state.inputEnd).toEqual(startOfDay(newRangeEnd));
          expect(state.currentSelectionValue?.dateScheduleRange).toBeDefined();
        });
      });
    });
  });

  describe('store initialization order', () => {
    // Tests that mirror the exact order of state updates in the forge component's effect.
    // The forge component applies updates in this order:
    // 1. filter
    // 2. minMaxDateRange
    // 3. outputTimezone
    // 4. initialSelectionState
    // 5. computeSelectionResultRelativeToFilter
    //
    // Note: initialCalendarScheduleSelectionState() already has computeSelectionResultRelativeToFilter: true.

    const today = startOfDay(new Date());
    const daysInFilter = 14;
    const minDateOffset = 4;

    const filterConfig: DateCellScheduleDateFilterConfig = {
      ...dateCellTiming({ startsAt: today, duration: 60 }, daysInFilter, 'UTC'),
      w: '89' as DateCellScheduleEncodedWeek,
      ex: [] as number[]
    };

    const minMaxDateRange: Partial<DateRange> = { start: addDays(today, minDateOffset) };

    describe('forge component effect order (filter → minMaxDateRange → timezone → initialSelectionState → computeSelectionResultRelativeToFilter)', () => {
      function createStateWithForgeOrder(): CalendarScheduleSelectionState {
        let state = initialCalendarScheduleSelectionState();
        // Step 1: filter
        state = updateStateWithFilter(state, filterConfig);
        // Step 2: minMaxDateRange
        state = updateStateWithMinMaxDateRange(state, minMaxDateRange);
        // Step 3: outputTimezone (undefined initially)
        state = updateStateWithTimezoneValue(state, undefined);
        // Step 4: initialSelectionState
        state = updateStateWithInitialSelectionState(state, 'all');
        // Step 5: computeSelectionResultRelativeToFilter (already true in initial state, so this is a no-op)
        state = updateStateWithComputeSelectionResultRelativeToFilter(state, true);
        return state;
      }

      it('should produce a non-null currentSelectionValue', () => {
        const state = createStateWithForgeOrder();
        expect(state.currentSelectionValue).toBeDefined();
        expect(state.currentSelectionValue?.dateScheduleRange).toBeDefined();
      });

      it('should clamp the output start to minMaxDateRange.start (not filter.start) when minMaxDateRange is set', () => {
        const state = createStateWithForgeOrder();
        const range = state.currentSelectionValue?.dateScheduleRange;
        expect(range).toBeDefined();

        // With computeSelectionResultRelativeToFilter: true AND minMaxDateRange.start > filter.start,
        // the output start should be clamped to the actual selection start (which respects minMaxDateRange),
        // NOT the filter's start date.
        expect(range!.start).toBeDefined();

        // The output start must be strictly after today (the filter's start is today,
        // so the clamped start should be at least minDateOffset days later).
        expect(range!.start.getTime()).toBeGreaterThan(today.getTime());

        // The output start should NOT be the same as the state.start (which is the filter's start date).
        // It should be offset forward by the minMaxDateRange constraint.
        expect(range!.start.getTime()).not.toBe(state.start.getTime());
      });

      it('should NOT include pre-minMaxDateRange days in the exclusion array', () => {
        const state = createStateWithForgeOrder();
        const range = state.currentSelectionValue?.dateScheduleRange;
        expect(range).toBeDefined();

        // Since the start is clamped to minMaxDateRange.start, there should be no
        // filter offset exclusions for days before minMaxDateRange.start.
        // Days 0,1,2,3 should NOT be in the exclusions.
        for (let i = 0; i < minDateOffset; i++) {
          expect(range!.ex).not.toContain(i);
        }
      });

      it('should not produce null when filter and minMaxDateRange are both set before initialSelectionState', () => {
        const state = createStateWithForgeOrder();
        // The key assertion: the value should NOT be null when the effect order is correct
        expect(state.currentSelectionValue).not.toBeNull();
        expect(state.currentSelectionValue).toBeDefined();
      });
    });

    describe('intermediate states during forge effect', () => {
      it('should have null currentSelectionValue after filter is set but before initialSelectionState', () => {
        let state = initialCalendarScheduleSelectionState();
        state = updateStateWithFilter(state, filterConfig);
        state = updateStateWithMinMaxDateRange(state, minMaxDateRange);

        // No initialSelectionState applied yet → no selection → value should be null/undefined
        expect(state.currentSelectionValue).toBeFalsy();
      });

      it('should have a non-null value only after initialSelectionState is applied', () => {
        let state = initialCalendarScheduleSelectionState();
        state = updateStateWithFilter(state, filterConfig);
        state = updateStateWithMinMaxDateRange(state, minMaxDateRange);
        state = updateStateWithTimezoneValue(state, undefined);

        // Verify still null before initialSelectionState
        expect(state.currentSelectionValue).toBeFalsy();

        // Now apply initialSelectionState
        state = updateStateWithInitialSelectionState(state, 'all');
        expect(state.currentSelectionValue).toBeDefined();
      });
    });

    describe('initialSelectionState applied BEFORE filter (out of order)', () => {
      it('should produce null value when initialSelectionState is applied without a filter or minMaxDateRange end', () => {
        let state = initialCalendarScheduleSelectionState();

        // Only set minMaxDateRange (which only has a start, no end)
        state = updateStateWithMinMaxDateRange(state, minMaxDateRange);

        // Apply initialSelectionState without filter
        state = updateStateWithInitialSelectionState(state, 'all');

        // Without a filter to provide the end date, 'all' selection cannot determine the range
        // because calendarScheduleMaxDate returns undefined (no filter.end and no minMaxDateRange.end)
        expect(state.currentSelectionValue).toBeFalsy();
      });

      it('should recover correct value when filter is applied after initialSelectionState', () => {
        let state = initialCalendarScheduleSelectionState();

        // Apply minMaxDateRange first
        state = updateStateWithMinMaxDateRange(state, minMaxDateRange);

        // Apply initialSelectionState out of order (before filter)
        state = updateStateWithInitialSelectionState(state, 'all');
        expect(state.currentSelectionValue).toBeFalsy();

        // Now apply filter - updateStateWithFilter re-applies initialSelectionState internally
        state = updateStateWithFilter(state, filterConfig);

        // After filter is applied, the stored initialSelectionState should be re-applied
        // and produce a valid selection
        expect(state.currentSelectionValue).toBeDefined();
        expect(state.currentSelectionValue?.dateScheduleRange).toBeDefined();
      });
    });

    describe('timezone change after initialization', () => {
      it('should retain a valid selection value after timezone is changed to America/New_York', () => {
        let state = initialCalendarScheduleSelectionState();
        state = updateStateWithFilter(state, filterConfig);
        state = updateStateWithMinMaxDateRange(state, minMaxDateRange);
        state = updateStateWithInitialSelectionState(state, 'all');
        state = updateStateWithComputeSelectionResultRelativeToFilter(state, true);

        // Verify value exists before timezone change
        expect(state.currentSelectionValue).toBeDefined();

        // Change timezone
        state = updateStateWithTimezoneValue(state, 'America/New_York');

        // Value should still be defined after timezone change
        expect(state.currentSelectionValue).toBeDefined();
        expect(state.currentSelectionValue?.dateScheduleRange).toBeDefined();
      });

      it('should have America/New_York as the output timezone after timezone change', () => {
        let state = initialCalendarScheduleSelectionState();
        state = updateStateWithFilter(state, filterConfig);
        state = updateStateWithMinMaxDateRange(state, minMaxDateRange);
        state = updateStateWithInitialSelectionState(state, 'all');
        state = updateStateWithTimezoneValue(state, 'America/New_York');

        expect(state.outputTimezone).toBe('America/New_York');
      });
    });

    describe('computeSelectionResultRelativeToFilter interaction with minMaxDateRange', () => {
      it('should clamp the output start to minMaxDateRange.start when computeSelectionResultRelativeToFilter is true', () => {
        let state = initialCalendarScheduleSelectionState();
        state = updateStateWithFilter(state, filterConfig);
        state = updateStateWithMinMaxDateRange(state, minMaxDateRange);
        state = updateStateWithInitialSelectionState(state, 'all');
        // computeSelectionResultRelativeToFilter is already true from initial state

        const value = state.currentSelectionValue;
        expect(value).toBeDefined();

        // The output start should be clamped to the actual selection start (after minMaxDateRange.start),
        // NOT the filter's start date.
        const range = value!.dateScheduleRange;
        expect(range.start).toBeDefined();

        // The output start must be after the state.start (which is the filter's start).
        expect(range.start.getTime()).toBeGreaterThan(state.start.getTime());

        // No pre-minMaxDateRange exclusions should be present
        for (let i = 0; i < minDateOffset; i++) {
          expect(range.ex).not.toContain(i);
        }
      });

      it('should use the actual selection start when computeSelectionResultRelativeToFilter is false', () => {
        let state = initialCalendarScheduleSelectionState();
        // Set computeSelectionResultRelativeToFilter to false FIRST (overriding the default true)
        state = updateStateWithComputeSelectionResultRelativeToFilter(state, false);
        state = updateStateWithFilter(state, filterConfig);
        state = updateStateWithMinMaxDateRange(state, minMaxDateRange);
        state = updateStateWithInitialSelectionState(state, 'all');

        const value = state.currentSelectionValue;
        expect(value).toBeDefined();

        // Without computeSelectionResultRelativeToFilter, the start should be the actual selection start
        // (i.e., minMaxDateRange.start or the first enabled day), not the filter's start
        const range = value!.dateScheduleRange;
        expect(range.start).toBeDefined();

        // The exclusion array should NOT contain the pre-minMaxDateRange days since start is already at the selection start
        expect(range.ex).not.toContain(0);
      });
    });

    describe('minMaxDateRange exceeds filter range', () => {
      it('should produce null when minMaxDateRange.start is after the filter end', () => {
        const farFutureMinMax: Partial<DateRange> = { start: addDays(today, daysInFilter + 10) };

        let state = initialCalendarScheduleSelectionState();
        state = updateStateWithFilter(state, filterConfig);
        state = updateStateWithMinMaxDateRange(state, farFutureMinMax);
        state = updateStateWithInitialSelectionState(state, 'all');

        // When minMaxDateRange.start is beyond the filter's range, there are no valid days
        // The value should be null
        expect(state.currentSelectionValue).toBeFalsy();
      });
    });

    describe('round-trip through updateStateWithDateCellScheduleRangeValue', () => {
      it('should not corrupt inputStart when the output value is fed back to the store', () => {
        // Set up a complete state
        let state = initialCalendarScheduleSelectionState();
        state = updateStateWithFilter(state, filterConfig);
        state = updateStateWithMinMaxDateRange(state, minMaxDateRange);
        state = updateStateWithInitialSelectionState(state, 'all');

        const originalValue = state.currentSelectionValue;
        expect(originalValue).toBeDefined();

        // Simulate the field→store round-trip: feed the output dateScheduleRange back as input
        const roundTrippedState = updateStateWithDateCellScheduleRangeValue(state, originalValue!.dateScheduleRange);

        // inputStart should still respect minMaxDateRange (not be before it)
        if (roundTrippedState.inputStart) {
          expect(roundTrippedState.inputStart.getTime()).toBeGreaterThan(state.start.getTime());
        }

        // The selection value after round-trip should be equivalent
        expect(roundTrippedState.currentSelectionValue).toBeDefined();
        expect(roundTrippedState.currentSelectionValue?.dateScheduleRange.ex).toEqual(originalValue!.dateScheduleRange.ex);
      });

      it('should preserve a toggled middle day after round-trip', () => {
        let state = initialCalendarScheduleSelectionState();
        state = updateStateWithFilter(state, filterConfig);
        state = updateStateWithMinMaxDateRange(state, minMaxDateRange);
        state = updateStateWithInitialSelectionState(state, 'all');

        // Toggle a middle day (e.g., minDateOffset + 2 days from today) to exclude it
        const middleDay = addDays(today, minDateOffset + 2);
        state = updateStateWithChangedDates(state, { toggle: middleDay });

        const valueBeforeRoundTrip = state.currentSelectionValue;
        expect(valueBeforeRoundTrip).toBeDefined();

        // The middle day should be excluded
        expect(valueBeforeRoundTrip!.dateScheduleRange.ex?.length).toBeGreaterThan(0);

        // Round-trip the value back through the store
        const afterRoundTrip = updateStateWithDateCellScheduleRangeValue(state, valueBeforeRoundTrip!.dateScheduleRange);
        const valueAfterRoundTrip = afterRoundTrip.currentSelectionValue;
        expect(valueAfterRoundTrip).toBeDefined();

        // The exclusion should be preserved — the toggled day must NOT "fill back up"
        expect(valueAfterRoundTrip!.dateScheduleRange.ex).toEqual(valueBeforeRoundTrip!.dateScheduleRange.ex);
      });

      it('should produce consistent values across multiple round-trips', () => {
        let state = initialCalendarScheduleSelectionState();
        state = updateStateWithFilter(state, filterConfig);
        state = updateStateWithMinMaxDateRange(state, minMaxDateRange);
        state = updateStateWithInitialSelectionState(state, 'all');

        const firstValue = state.currentSelectionValue?.dateScheduleRange;
        expect(firstValue).toBeDefined();

        // First round-trip
        state = updateStateWithDateCellScheduleRangeValue(state, firstValue!);
        const secondValue = state.currentSelectionValue?.dateScheduleRange;
        expect(secondValue).toBeDefined();

        // Second round-trip
        state = updateStateWithDateCellScheduleRangeValue(state, secondValue!);
        const thirdValue = state.currentSelectionValue?.dateScheduleRange;
        expect(thirdValue).toBeDefined();

        // Values should stabilize after round-trips (no drift)
        expect(secondValue!.start.getTime()).toBe(thirdValue!.start.getTime());
        expect(secondValue!.end.getTime()).toBe(thirdValue!.end.getTime());
        expect(secondValue!.ex).toEqual(thirdValue!.ex);
      });
    });
  });

  describe('props', () => {
    it('should pass hideCustomize in props', () => {
      const field = dbxForgeDateScheduleRangeField({ hideCustomize: true });
      expect(field.props?.hideCustomize).toBe(true);
    });

    it('should pass allowTextInput in props', () => {
      const field = dbxForgeDateScheduleRangeField({ allowTextInput: true });
      expect(field.props?.allowTextInput).toBe(true);
    });

    it('should pass description in props', () => {
      const field = dbxForgeDateScheduleRangeField({ description: 'Pick a schedule' });
      expect(field.props?.description).toBe('Pick a schedule');
    });

    it('should pass appearance in props', () => {
      const field = dbxForgeDateScheduleRangeField({ appearance: 'outline' });
      expect(field.props?.appearance).toBe('outline');
    });

    it('should pass allowCustomizeWithoutDateRange in props', () => {
      const field = dbxForgeDateScheduleRangeField({ allowCustomizeWithoutDateRange: true });
      expect(field.props?.allowCustomizeWithoutDateRange).toBe(true);
    });

    it('should pass label in props', () => {
      const field = dbxForgeDateScheduleRangeField({ label: 'Custom Label' });
      expect(field.props?.label).toBe('Custom Label');
    });

    it('should include default label in props when no extra config is provided', () => {
      const field = dbxForgeDateScheduleRangeField();
      expect(field.props).toBeDefined();
      expect(field.props?.label).toBe('Schedule');
    });
  });
});
