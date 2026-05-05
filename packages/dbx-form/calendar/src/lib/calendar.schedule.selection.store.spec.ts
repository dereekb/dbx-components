import { lastValue, range } from '@dereekb/util';
import { addDays, addHours } from 'date-fns';
import { DateCellScheduleDayCode, type DateCellScheduleDateFilterConfig, type DateCellScheduleEncodedWeek, expandDateCellScheduleRange } from '@dereekb/date';
import { type CalendarScheduleSelectionState, computeCalendarScheduleSelectionDateCellRange, initialCalendarScheduleSelectionState, updateStateWithChangedDates, updateStateWithChangedRange, updateStateWithChangedScheduleDays, updateStateWithFilter, updateStateWithMinMaxDateRange, updateStateWithDateCellScheduleRangeValue } from './calendar.schedule.selection.store';

/*
describe('computeScheduleSelectionValue()', () => {
  const start = systemNormalDateToBaseDate(new Date('2022-01-02T00:00:00Z')); // Sunday

  it('should calculate a 3 day selection.', () => {
    const state = initialCalendarScheduleSelectionState();
  });

  describe('schedule days disabled', () => {});
});
*/

describe('isEnabledDayInCalendarScheduleSelectionState()', () => {
  describe('function', () => {
    describe('scenarios', () => {
      // 2 year span of weekdays
      describe('12/5/2021-12/31/2023', () => {
        const inputStart = new Date('2021-12-06T06:00:00.000Z');
        const inputEnd = new Date('2023-12-29T06:00:00.000Z');

        let state = initialCalendarScheduleSelectionState();
        state = updateStateWithChangedRange(state, { inputStart, inputEnd });
        state = updateStateWithChangedScheduleDays(state, [DateCellScheduleDayCode.WEEKDAY]);

        it('Sunday March 12 2023 should not be enabled', () => {
          const date = new Date('2023-03-12T07:00:00.000Z');
          expect(state.isEnabledDay(date)).toBe(false);
        });

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

describe('computeCalendarScheduleSelectionDateCellRange()', () => {
  it('should calculate a 4 day selection from the inputStart and inputEnd.', () => {
    let state = initialCalendarScheduleSelectionState();

    const days = 4;
    const inputStart = state.start;
    const inputEnd = addDays(inputStart, days - 1);

    state = updateStateWithChangedRange(state, { inputStart, inputEnd });

    const result = computeCalendarScheduleSelectionDateCellRange(state);

    expect(result?.i).toBe(0);
    expect(result?.to).toBe(days - 1);
  });

  it('should calculate a 4 day selection from selected days.', () => {
    let state = initialCalendarScheduleSelectionState();

    const add = [0, 1, 2, 3];
    state = updateStateWithChangedDates(state, {
      add
    });

    const result = computeCalendarScheduleSelectionDateCellRange(state);

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

      const result = computeCalendarScheduleSelectionDateCellRange(state);
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

      const result = computeCalendarScheduleSelectionDateCellRange(state);
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

      const result = computeCalendarScheduleSelectionDateCellRange(state);

      expect(result?.i).toBe(0);
      expect(result?.to).toBe(1);
    });
  });
});

describe('setFilter + setMinMaxDateRange selection bug reproduction', () => {
  // Reproduces a bug reported in the wild:
  //   - Job runs 4/16/2026 → 5/28/2026 weekdays only (filter)
  //   - minMaxDateRange.start = 5/1/2026 (15 calendar days after filter.start)
  //   - User selects a single weekday (5/5/2026)
  //   - Expected: dateScheduleRange expands to exactly 1 day
  //   - Actual: expansion includes the selected day plus ~15 phantom prefix days
  //
  // Filter shape from the affected app's console (timezone: America/Chicago):
  //   { start: 4/16 00:00 CDT, startsAt: 4/16 08:30 CDT, end: 5/28 16:30 CDT, w: '8', d: [], ex: [] }
  describe('weekday filter 4/16-5/28 with minMaxDateRange.start=5/1', () => {
    const timezone = 'America/Chicago';
    // 4/16/2026 00:00 America/Chicago == 2026-04-16T05:00:00Z (CDT, -05:00)
    const filterStart = new Date('2026-04-16T05:00:00.000Z');
    const filterStartsAt = new Date('2026-04-16T13:30:00.000Z'); // 08:30 CDT
    const filterEnd = new Date('2026-05-28T21:30:00.000Z'); // 16:30 CDT
    const minStart = new Date('2026-05-01T05:00:00.000Z'); // 5/1 00:00 CDT
    const minEnd = new Date('2026-05-29T04:59:59.999Z'); // 5/28 end of day CDT

    // 5/5/2026 (a Tuesday) in CDT
    const selectedDayUtc = new Date('2026-05-05T05:00:00.000Z');

    const filter: DateCellScheduleDateFilterConfig = {
      start: filterStart,
      startsAt: filterStartsAt,
      end: filterEnd,
      timezone,
      w: '8' as DateCellScheduleEncodedWeek,
      d: [],
      ex: []
    };

    function buildState() {
      let state = initialCalendarScheduleSelectionState();
      state = updateStateWithFilter(state, filter);
      state = updateStateWithMinMaxDateRange(state, { start: minStart, end: minEnd });
      state = updateStateWithChangedScheduleDays(state, [DateCellScheduleDayCode.WEEKDAY]);
      state = updateStateWithChangedRange(state, { inputStart: selectedDayUtc, inputEnd: selectedDayUtc });
      return state;
    }

    it('should produce a currentSelectionValue', () => {
      const state = buildState();
      expect(state.currentSelectionValue).toBeDefined();
    });

    it('should expand to exactly one selected day (5/5/2026)', () => {
      const state = buildState();
      const value = state.currentSelectionValue;
      expect(value).toBeDefined();

      const expansion = expandDateCellScheduleRange({ dateCellScheduleRange: value!.dateScheduleRange });
      expect(expansion.length).toBe(1);
    });

    it('should output a dateScheduleRange anchored at filter.start (legacy contract)', () => {
      const state = buildState();
      const dsr = state.currentSelectionValue!.dateScheduleRange;
      // After the legacy-restored fix, dateScheduleRange.start always equals filter.start.
      // Pre-minMaxDateRange days appear as prefix exclusions in ex (not as a shifted start).
      expect(dsr.start.toISOString()).toBe(filterStart.toISOString());
    });

    it('round-trip: re-applying the computed dateScheduleRange should yield the same expansion', () => {
      const state = buildState();
      const dsr = state.currentSelectionValue!.dateScheduleRange;
      const firstExpansion = expandDateCellScheduleRange({ dateCellScheduleRange: dsr });

      // simulate consumer round-trip via the same expansion call from a fresh consumer perspective
      const reExpansion = expandDateCellScheduleRange({ dateCellScheduleRange: dsr });
      expect(reExpansion.length).toBe(firstExpansion.length);
    });
  });

  // Reproduces the user-reported bug from the field. The console showed:
  //   currentSelectionValue.dateScheduleRange =
  //     { start: 5/4 (Mon CDT), end: 5/28, w: '89', ex: [5,6,12,13,19,20], d: [], timezone: 'America/Chicago' }
  // Removing setMinMaxDateRange produces the working output:
  //     { start: 4/16 (Thu CDT), end: 5/28, w: '89', ex: [0,2,3,9,10,16,17,23,24,30,31,37,38], d: [], timezone: 'America/Chicago' }
  describe('select all with filter + minMaxDateRange', () => {
    const timezone = 'America/Chicago';
    const filterStart = new Date('2026-04-16T05:00:00.000Z');
    const filterStartsAt = new Date('2026-04-16T13:30:00.000Z');
    const filterEnd = new Date('2026-05-28T21:30:00.000Z');
    const minStart = new Date('2026-05-01T05:00:00.000Z');
    const minEnd = new Date('2026-05-29T04:59:59.999Z');

    const filter: DateCellScheduleDateFilterConfig = {
      start: filterStart,
      startsAt: filterStartsAt,
      end: filterEnd,
      timezone,
      w: '8' as DateCellScheduleEncodedWeek,
      d: [],
      ex: []
    };

    function buildStateWithFilterAndMinMax() {
      let state = initialCalendarScheduleSelectionState();
      state = updateStateWithFilter(state, filter);
      state = updateStateWithMinMaxDateRange(state, { start: minStart, end: minEnd });
      // simulate the user clicking "select all"
      state = updateStateWithChangedDates(state, { selectAll: 'all' });
      return state;
    }

    function buildStateWithoutFilter() {
      let state = initialCalendarScheduleSelectionState();
      state = updateStateWithFilter(state, filter);
      // No setMinMaxDateRange call (the "removing setMinMaxDateRange makes it work" case)
      state = updateStateWithChangedDates(state, { selectAll: 'all' });
      return state;
    }

    it('anchors output start at filter.start with prefix exclusions [0..14] plus weekends within the minMax window', () => {
      const state = buildStateWithFilterAndMinMax();
      const dsr = state.currentSelectionValue!.dateScheduleRange;

      // Output is filter-anchored: start = filter.start (4/16 CDT).
      expect(dsr.start.toISOString()).toBe(filterStart.toISOString());

      // Pre-minMaxDateRange days (4/16..4/30 → indexes 0..14) must appear in ex.
      const ex = [...(dsr.ex ?? [])].sort((a, b) => a - b);
      for (let i = 0; i < 15; i += 1) {
        expect(ex).toContain(i);
      }
      // Weekend indexes (Sat/Sun) within the input window must also appear in ex:
      //   5/2 Sat = 16, 5/3 Sun = 17, 5/9 Sat = 23, 5/10 Sun = 24,
      //   5/16 Sat = 30, 5/17 Sun = 31, 5/23 Sat = 37, 5/24 Sun = 38.
      for (const i of [16, 17, 23, 24, 30, 31, 37, 38]) {
        expect(ex).toContain(i);
      }
    });

    it('control: without minMaxDateRange, output starts at filter.start (4/16)', () => {
      const state = buildStateWithoutFilter();
      const dsr = state.currentSelectionValue!.dateScheduleRange;
      expect(dsr.start.toISOString()).toBe('2026-04-16T05:00:00.000Z');
    });

    it('round-trip via updateStateWithDateCellScheduleRangeValue should be stable', () => {
      const state = buildStateWithFilterAndMinMax();
      const dsr = state.currentSelectionValue!.dateScheduleRange;

      const reapplied = updateStateWithDateCellScheduleRangeValue(state, dsr);
      const dsr2 = reapplied.currentSelectionValue!.dateScheduleRange;

      expect(dsr2.start.toISOString()).toBe(dsr.start.toISOString());
      expect(dsr2.end.toISOString()).toBe(dsr.end.toISOString());
      expect(dsr2.ex).toEqual(dsr.ex);
    });

    // Matches the user's actual scenario: the picker sets inputRange to a specific subrange
    // (5/4 Mon → 5/28) within minMaxDateRange. After this, the user toggles a weekday and
    // observes phantom toggles on other days.
    function buildStateMatchingUserScenario() {
      let state = initialCalendarScheduleSelectionState();
      state = updateStateWithFilter(state, filter);
      state = updateStateWithMinMaxDateRange(state, { start: minStart, end: minEnd });
      // The picker selects 5/4 Mon → 5/28 (the displayed range).
      state = updateStateWithChangedRange(state, {
        inputStart: new Date('2026-05-04T05:00:00.000Z'),
        inputEnd: new Date('2026-05-28T05:00:00.000Z')
      });
      return state;
    }

    it('produces a filter-anchored output for the picker scenario (start=4/16, prefix [0..17] + weekends within input range)', () => {
      const state = buildStateMatchingUserScenario();
      const dsr = state.currentSelectionValue!.dateScheduleRange;

      // start is filter-anchored (4/16 CDT), end is the picker's inputEnd (5/28).
      expect(dsr.start.toISOString()).toBe(filterStart.toISOString());
      expect(dsr.end.toISOString()).toBe('2026-05-28T05:00:00.000Z');
      expect(dsr.w).toBe('89');

      // Pre-input prefix [0..17] (4/16..5/3) plus weekend indexes within the input
      // range 5/4..5/28: [23, 24, 30, 31, 37, 38].
      const expected = [...range(0, 18), 23, 24, 30, 31, 37, 38];
      expect([...(dsr.ex ?? [])].sort((a, b) => a - b)).toEqual(expected);
    });

    it('toggling state-index 36 marks state-index 36 in toggledIndexes', () => {
      let state = buildStateMatchingUserScenario();

      // Toggle by passing the state-index (36) directly — same as the calendar UI
      // passes when the user clicks the cell at position 36 from filter.start.
      state = updateStateWithChangedDates(state, { toggle: [36] });

      // state.toggledIndexes is filter-anchored, so it contains 36 directly.
      expect(state.toggledIndexes.has(36)).toBe(true);
    });

    it('toggling a Date for 5/22 marks output-ex with state-index 36 (filter-anchored)', () => {
      let state = buildStateMatchingUserScenario();
      const baselineEx = [...state.currentSelectionValue!.dateScheduleRange.ex!].sort((a, b) => a - b);

      // Toggle 5/22/2026 Fri (a weekday — should toggle this single day off)
      const toggleDate = new Date('2026-05-22T05:00:00.000Z');
      state = updateStateWithChangedDates(state, { toggle: [toggleDate] });

      const dsr = state.currentSelectionValue!.dateScheduleRange;

      // Output is filter-anchored (start = 4/16). 5/22 - 4/16 = 36 calendar days
      // → state-index 36. Expected ex = baseline + [36], sorted.
      const expectedAfterToggle = [...baselineEx, 36].sort((a, b) => a - b);
      expect([...(dsr.ex ?? [])].sort((a, b) => a - b)).toEqual(expectedAfterToggle);
    });
  });
});

function getSelectedIndexesFromState(state: CalendarScheduleSelectionState): Set<number> {
  const value = state.currentSelectionValue;
  if (!value) return new Set();
  return new Set(expandDateCellScheduleRange({ dateCellScheduleRange: value.dateScheduleRange }).map((x) => x.i));
}

function expectStateAnchoredIndexes(state: CalendarScheduleSelectionState, indexes: Set<number>) {
  for (const i of indexes) {
    const date = addDays(state.start, i);
    expect(state.indexFactory(date)).toBe(i);
    expect(state.isEnabledFilterDay(date)).toBe(true);
  }
}

describe('selector coordinate contract (state-anchored indexes)', () => {
  // The contract: every emitted index from the expansion of currentSelectionValue.dateScheduleRange
  // is anchored at state.start (== filter.start when a filter is set, today otherwise) and matches
  // state.indexFactory(date).

  function expectRoundTripStable(state: CalendarScheduleSelectionState) {
    const value = state.currentSelectionValue;
    expect(value).toBeDefined();
    const ex = [...(value!.dateScheduleRange.ex ?? [])].sort((a, b) => a - b);
    const indexesBefore = getSelectedIndexesFromState(state);

    const after = updateStateWithDateCellScheduleRangeValue(state, value!.dateScheduleRange);
    const afterValue = after.currentSelectionValue;
    expect(afterValue).toBeDefined();
    expect([...(afterValue!.dateScheduleRange.ex ?? [])].sort((a, b) => a - b)).toEqual(ex);

    const minMaxStart = state.minMaxDateRange?.start;
    if (minMaxStart) {
      expect(after.inputStart).toBeDefined();
      expect(after.inputStart!.getTime()).toBe(minMaxStart.getTime());
    } else {
      expect(after.inputStart!.getTime()).toBe(value!.dateScheduleRange.start.getTime());
    }

    const indexesAfter = getSelectedIndexesFromState(after);
    expect([...indexesAfter].sort((a, b) => a - b)).toEqual([...indexesBefore].sort((a, b) => a - b));
  }

  describe('case 1: no filter, input range anchored at state.start', () => {
    // Without a filter, the output is anchored at rangeStart (the first selected
    // day). To exercise the state-anchored contract, set inputStart = state.start
    // so rangeStart === state.start.
    it('emitted indexes match state.indexFactory(date) when inputStart = state.start', () => {
      let state = initialCalendarScheduleSelectionState();
      const today = state.start;
      state = updateStateWithChangedRange(state, { inputStart: today, inputEnd: addDays(today, 9) });

      const indexes = getSelectedIndexesFromState(state);
      expect(indexes.size).toBeGreaterThan(0);
      // state.indexFactory(today + 5) === 5
      expect(indexes.has(state.indexFactory(addDays(today, 5)))).toBe(true);
      expect(indexes.has(5)).toBe(true);
      expectStateAnchoredIndexes(state, indexes);
    });

    it('round-trip stability', () => {
      let state = initialCalendarScheduleSelectionState();
      const today = state.start;
      state = updateStateWithChangedRange(state, { inputStart: today, inputEnd: addDays(today, 9) });
      expectRoundTripStable(state);
    });
  });

  describe('weekday filter scenarios (4/16 → 5/28 America/Chicago)', () => {
    const timezone = 'America/Chicago';
    const filterStart = new Date('2026-04-16T05:00:00.000Z');
    const filterStartsAt = new Date('2026-04-16T13:30:00.000Z');
    const filterEnd = new Date('2026-05-28T21:30:00.000Z');

    const filter: DateCellScheduleDateFilterConfig = {
      start: filterStart,
      startsAt: filterStartsAt,
      end: filterEnd,
      timezone,
      w: '8' as DateCellScheduleEncodedWeek,
      d: [],
      ex: []
    };

    function buildBaseState() {
      let state = initialCalendarScheduleSelectionState();
      state = updateStateWithFilter(state, filter);
      return state;
    }

    function buildSelectAllState(minMax?: { readonly start: Date; readonly end: Date }) {
      let state = buildBaseState();
      if (minMax) {
        state = updateStateWithMinMaxDateRange(state, minMax);
      }
      state = updateStateWithChangedDates(state, { selectAll: 'all' });
      return state;
    }

    describe('case 2: filter only, no minMaxDateRange', () => {
      it('every emitted index is state-anchored (state.indexFactory(addDays(state.start, i)) === i)', () => {
        const state = buildSelectAllState();
        const indexes = getSelectedIndexesFromState(state);
        expect(indexes.size).toBeGreaterThan(0);
        expectStateAnchoredIndexes(state, indexes);
      });

      it('round-trip stability', () => {
        const state = buildSelectAllState();
        expectRoundTripStable(state);
      });
    });

    describe('case 3: filter + minMaxDateRange.start = filter.start + 15 (5/1 Fri)', () => {
      const minStart = new Date('2026-05-01T05:00:00.000Z');
      const minEnd = new Date('2026-05-29T04:59:59.999Z');
      const buildState = () => buildSelectAllState({ start: minStart, end: minEnd });

      it('output is filter-anchored at 4/16 with prefix [0..14] excluded', () => {
        const state = buildState();
        const dsr = state.currentSelectionValue!.dateScheduleRange;
        expect(dsr.start.toISOString()).toBe(filterStart.toISOString());
        const ex = [...(dsr.ex ?? [])].sort((a, b) => a - b);
        for (let i = 0; i < 15; i += 1) {
          expect(ex).toContain(i);
        }
        // weekend exclusions within [15, 43): 16, 17, 23, 24, 30, 31, 37, 38
        for (const i of [16, 17, 23, 24, 30, 31, 37, 38]) {
          expect(ex).toContain(i);
        }
      });

      it('toggling state-index 36 (5/22 Fri) excludes 36 only — selectionValueSelectedIndexes$ matches', () => {
        let state = buildState();
        state = updateStateWithChangedDates(state, { toggle: [36] });

        expect(state.toggledIndexes.has(36)).toBe(true);

        const dsr = state.currentSelectionValue!.dateScheduleRange;
        expect(dsr.ex).toContain(36);

        const indexes = getSelectedIndexesFromState(state);
        expect(indexes.has(36)).toBe(false);

        // Allowed weekdays in [15, 43): 15, 18, 19, 20, 21, 22, 25, 26, 27, 28, 29, 32, 33, 34, 35, 39, 40, 41, 42
        for (const i of [15, 18, 19, 20, 21, 22, 25, 26, 27, 28, 29, 32, 33, 34, 35, 39, 40, 41, 42]) {
          expect(indexes.has(i)).toBe(true);
        }

        expectStateAnchoredIndexes(state, indexes);
      });

      it('round-trip stability', () => {
        const state = buildState();
        expectRoundTripStable(state);
      });
    });

    describe('case 4: filter + minMaxDateRange.start = filter.start + 18 (5/4 Mon)', () => {
      const minStart = new Date('2026-05-04T05:00:00.000Z');
      const minEnd = new Date('2026-05-29T04:59:59.999Z');
      const buildState = () => buildSelectAllState({ start: minStart, end: minEnd });

      it('toggling state-index 36 → selectionValueSelectedIndexes$ stays state-anchored', () => {
        let state = buildState();
        state = updateStateWithChangedDates(state, { toggle: [36] });

        expect(state.toggledIndexes.has(36)).toBe(true);
        const dsr = state.currentSelectionValue!.dateScheduleRange;
        expect(dsr.start.toISOString()).toBe(filterStart.toISOString());
        expect(dsr.ex).toContain(36);

        const indexes = getSelectedIndexesFromState(state);
        expect(indexes.has(36)).toBe(false);
        expectStateAnchoredIndexes(state, indexes);
      });

      it('round-trip stability', () => {
        const state = buildState();
        expectRoundTripStable(state);
      });
    });

    describe('case 5: filter + minMaxDateRange + setSelectedIndexes (mirrors applicationDateCellIndexes$)', () => {
      const minStart = new Date('2026-05-01T05:00:00.000Z');
      const minEnd = new Date('2026-05-29T04:59:59.999Z');

      // Every weekday in the filter range, filter-anchored
      const allWeekdayIndexes = [0, 1, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 18, 19, 20, 21, 22, 25, 26, 27, 28, 29, 32, 33, 34, 35, 36, 39, 40, 41, 42];

      function buildState() {
        let state = buildBaseState();
        state = updateStateWithMinMaxDateRange(state, { start: minStart, end: minEnd });
        // setSelectedIndexes ≡ updateStateWithChangedDates(set, invertSetBehavior: true)
        state = updateStateWithChangedDates(state, { set: allWeekdayIndexes, invertSetBehavior: true });
        return state;
      }

      it('emits only weekday indexes at or after minMaxDateRange.start (≥ 15) — pre-min weekdays are excluded', () => {
        const state = buildState();
        const indexes = getSelectedIndexesFromState(state);

        // Allowed weekdays at or after 5/1 (idx 15): 15, 18, 19, 20, 21, 22, 25, 26, 27, 28, 29, 32, 33, 34, 35, 36, 39, 40, 41, 42
        const expectedAllowed = [15, 18, 19, 20, 21, 22, 25, 26, 27, 28, 29, 32, 33, 34, 35, 36, 39, 40, 41, 42];
        for (const i of expectedAllowed) {
          expect(indexes.has(i)).toBe(true);
        }

        // Pre-min weekdays must NOT appear in selectionValueSelectedIndexes
        for (const i of [0, 1, 4, 5, 6, 7, 8, 11, 12, 13, 14]) {
          expect(indexes.has(i)).toBe(false);
        }

        expectStateAnchoredIndexes(state, indexes);
      });

      it('round-trip stability', () => {
        const state = buildState();
        expectRoundTripStable(state);
      });
    });
  });
});
