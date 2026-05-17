import { describe, expect, it } from 'vitest';
import { type CalendarState, CalendarDisplayType, updateCalendarStateWithNavigationRangeLimit } from './calendar.store';

describe('updateCalendarStateWithNavigationRangeLimit()', () => {
  const baseDate = new Date('2024-06-15T12:00:00Z');

  function createState(date: Date = baseDate): CalendarState {
    return {
      date,
      displayType: CalendarDisplayType.MONTH
    };
  }

  it('should clamp the date when it falls outside the navigation range limit', () => {
    const state = createState(new Date('2024-12-01T00:00:00Z'));
    const navigationRangeLimit = {
      start: new Date('2024-01-01T00:00:00Z'),
      end: new Date('2024-06-30T23:59:59Z')
    };

    const result = updateCalendarStateWithNavigationRangeLimit(state, navigationRangeLimit);

    expect(result.navigationRangeLimit).toBe(navigationRangeLimit);
    expect(result.date.getTime()).toBeLessThanOrEqual(navigationRangeLimit.end.getTime());
    expect(result.date.getTime()).toBeGreaterThanOrEqual(navigationRangeLimit.start.getTime());
  });

  it('should preserve the existing date when it falls within the navigation range limit', () => {
    const state = createState(new Date('2024-06-15T12:00:00Z'));
    const navigationRangeLimit = {
      start: new Date('2024-01-01T00:00:00Z'),
      end: new Date('2024-12-31T23:59:59Z')
    };

    const result = updateCalendarStateWithNavigationRangeLimit(state, navigationRangeLimit);

    expect(result.navigationRangeLimit).toBe(navigationRangeLimit);
    expect(result.date).toEqual(state.date);
  });

  it('should pass through navigationRangeLimit when it is undefined', () => {
    const state = createState();

    const result = updateCalendarStateWithNavigationRangeLimit(state, undefined);

    expect(result.navigationRangeLimit).toBeUndefined();
    expect(result.date).toEqual(state.date);
  });
});
