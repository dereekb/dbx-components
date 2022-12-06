import { lastValue } from '@dereekb/util';
import { addDays } from 'date-fns';
import { systemNormalDateToBaseDate } from '@dereekb/date';
import { computeCalendarScheduleSelectionDateBlockRange, initialCalendarScheduleSelectionState, updateStateWithChangedDates, updateStateWithChangedRange } from './calendar.schedule.selection.store';

describe('computeScheduleSelectionValue()', () => {
  const start = systemNormalDateToBaseDate(new Date('2022-01-02T00:00:00Z')); // Sunday

  it('should calculate a 3 day selection.', () => {
    let state = initialCalendarScheduleSelectionState();
  });

  describe('schedule days disabled', () => {});
});

describe('computeCalendarScheduleSelectionDateBlockRange()', () => {
  it('should calculate a 4 day selection from the inputStart and inputEnd.', () => {
    let state = initialCalendarScheduleSelectionState();

    const days = 4;
    const inputStart = state.start;
    const inputEnd = addDays(inputStart, days - 1);

    state = updateStateWithChangedRange(state, { inputStart, inputEnd });

    const result = computeCalendarScheduleSelectionDateBlockRange(state);

    expect(result?.i).toBe(0);
    expect(result?.to).toBe(days - 1);
  });

  it('should calculate a 4 day selection from selected days.', () => {
    let state = initialCalendarScheduleSelectionState();

    const add = [0, 1, 2, 3];
    state = updateStateWithChangedDates(state, {
      add
    });

    const result = computeCalendarScheduleSelectionDateBlockRange(state);

    expect(result?.i).toBe(0);
    expect(result?.to).toBe(lastValue(add));
  });

  describe('with range and excluded days', () => {
    it('should calculate the selection if all days are excluded from the range.', () => {
      let state = initialCalendarScheduleSelectionState();

      const days = 4;
      const inputStart = state.start;
      const inputEnd = addDays(inputStart, days - 1);

      state = updateStateWithChangedRange(state, { inputStart, inputEnd });

      const add = [0, 1, 2, 3]; // exclude the 3rd and 4th days
      state = updateStateWithChangedDates(state, {
        add
      });

      const result = computeCalendarScheduleSelectionDateBlockRange(state);
      expect(result).toBeUndefined();
    });

    it('should calculate the selection if all days are excluded from the range but one is outside the selection.', () => {
      let state = initialCalendarScheduleSelectionState();

      const days = 3;
      const inputStart = state.start;
      const inputEnd = addDays(inputStart, days - 1);

      state = updateStateWithChangedRange(state, { inputStart, inputEnd });

      const onlyEnabledIndex = 3;
      const add = [0, 1, 2, onlyEnabledIndex]; // exclude the 3rd and 4th days
      state = updateStateWithChangedDates(state, {
        add
      });

      const result = computeCalendarScheduleSelectionDateBlockRange(state);
      expect(result).toBeDefined();
      expect(result?.i).toBe(onlyEnabledIndex);
      expect(result?.to).toBe(onlyEnabledIndex);
    });

    it('should calculate the selection from the inputStart and inputEnd and excluded days.', () => {
      let state = initialCalendarScheduleSelectionState();

      const days = 4;
      const inputStart = state.start;
      const inputEnd = addDays(inputStart, days - 1);

      state = updateStateWithChangedRange(state, { inputStart, inputEnd });

      const add = [2, 3]; // exclude the 3rd and 4th days
      state = updateStateWithChangedDates(state, {
        add
      });

      const result = computeCalendarScheduleSelectionDateBlockRange(state);

      expect(result?.i).toBe(0);
      expect(result?.to).toBe(1);
    });
  });
});
