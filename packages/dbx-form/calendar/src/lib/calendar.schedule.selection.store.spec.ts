import { lastValue } from '@dereekb/util';
import { addDays, addHours } from 'date-fns';
import { DateScheduleDayCode, systemNormalDateToBaseDate } from '@dereekb/date';
import { computeCalendarScheduleSelectionDateBlockRange, initialCalendarScheduleSelectionState, updateStateWithChangedDates, updateStateWithChangedRange, updateStateWithChangedScheduleDays } from './calendar.schedule.selection.store';

describe('computeScheduleSelectionValue()', () => {
  const start = systemNormalDateToBaseDate(new Date('2022-01-02T00:00:00Z')); // Sunday

  it('should calculate a 3 day selection.', () => {
    const state = initialCalendarScheduleSelectionState();
  });

  describe('schedule days disabled', () => {});
});

describe('isEnabledDayInCalendarScheduleSelectionState()', () => {
  describe('function', () => {
    describe('scenarios', () => {
      describe('12/5/2021-12/31/2023', () => {
        const inputStart = new Date('2021-12-06T06:00:00.000Z');
        const inputEnd = new Date('2023-12-29T06:00:00.000Z');

        let state = initialCalendarScheduleSelectionState();
        state = updateStateWithChangedRange(state, { inputStart, inputEnd });
        state = updateStateWithChangedScheduleDays(state, [DateScheduleDayCode.WEEKDAY]);

        it('Monday March 13 2023 should be enabled', () => {
          const date = addHours(new Date('2023-03-12T06:00:00.000Z'), 24);
          expect(state.isEnabledDay(date)).toBe(true);
        });

        describe('Saturday and Sunday disabled', () => {
          it('Monday March 13 2023 should be enabled', () => {
            const date = new Date('2023-03-13T05:00:00.000Z');
            expect(state.isEnabledDay(date)).toBe(true);
          });
        });
      });
    });
  });
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
