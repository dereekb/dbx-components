import type { ExpectationResult, Matchers, MatcherState } from '@vitest/expect';
import { isBefore, isAfter, isSameSecond, isSameMinute, isSameHour, isSameDay, isSameWeek, isSameMonth, isSameQuarter, isSameYear, getDay } from 'date-fns';

// Vitest implemenation of matchers from jest-date

export type DateMatcherTypeWithExpected<T extends (this: MatcherState, input: Date, expected: Date) => ExpectationResult> = T extends (this: MatcherState, input: any, expected: infer B) => ExpectationResult ? (expected: B) => ExpectationResult : never;
export type DateMatcherTypeWithoutExpected<T extends (this: MatcherState, input: Date) => ExpectationResult> = T extends (this: MatcherState, input: any) => ExpectationResult ? () => ExpectationResult : never;

/**
 * This defines our matchers as they can be used in actual tests, see
 * https://vitest.dev/guide/extending-matchers.html#extending-matchers
 * for reference
 */
interface AllDateMatchers {
  toBeBefore: DateMatcherTypeWithExpected<typeof toBeBefore>;
  toBeAfter: DateMatcherTypeWithExpected<typeof toBeAfter>;
  toBeSameSecondAs: DateMatcherTypeWithExpected<typeof toBeSameSecondAs>;
  toBeSameMinuteAs: DateMatcherTypeWithExpected<typeof toBeSameMinuteAs>;
  toBeSameHourAs: DateMatcherTypeWithExpected<typeof toBeSameHourAs>;
  toBeSameDayAs: DateMatcherTypeWithExpected<typeof toBeSameDayAs>;
  toBeSameWeekAs: DateMatcherTypeWithExpected<typeof toBeSameWeekAs>;
  toBeSameMonthAs: DateMatcherTypeWithExpected<typeof toBeSameMonthAs>;
  toBeSameQuarterAs: DateMatcherTypeWithExpected<typeof toBeSameQuarterAs>;
  toBeSameYearAs: DateMatcherTypeWithExpected<typeof toBeSameYearAs>;
  toBeMonday: DateMatcherTypeWithoutExpected<typeof toBeMonday>;
  toBeTuesday: DateMatcherTypeWithoutExpected<typeof toBeTuesday>;
  toBeWednesday: DateMatcherTypeWithoutExpected<typeof toBeWednesday>;
  toBeThursday: DateMatcherTypeWithoutExpected<typeof toBeThursday>;
  toBeFriday: DateMatcherTypeWithoutExpected<typeof toBeFriday>;
  toBeSaturday: DateMatcherTypeWithoutExpected<typeof toBeSaturday>;
  toBeSunday: DateMatcherTypeWithoutExpected<typeof toBeSunday>;
}

/**
 * Check if a date is before another date.
 */
function toBeBefore(this: MatcherState, received: Date, expected: Date): ExpectationResult {
  const { isNot } = this;
  const pass = isBefore(received, expected);

  return {
    pass,
    message: () => `Expected ${received.toISOString()} ${isNot ? 'not ' : ''}to be before ${expected.toISOString()}`,
    actual: received,
    expected
  };
}

/**
 * Check if a date is after another date.
 */
function toBeAfter(this: MatcherState, received: Date, expected: Date): ExpectationResult {
  const { isNot } = this;
  const pass = isAfter(received, expected);

  return {
    pass,
    message: () => `Expected ${received.toISOString()} ${isNot ? 'not ' : ''}to be after ${expected.toISOString()}`,
    actual: received,
    expected
  };
}

/**
 * Check if a date is in the same second as another date.
 */
function toBeSameSecondAs(this: MatcherState, received: Date, expected: Date): ExpectationResult {
  const { isNot } = this;
  const pass = isSameSecond(received, expected);

  return {
    pass,
    message: () => `Expected ${received.toISOString()} ${isNot ? 'not ' : ''}to be in the same second as ${expected.toISOString()}`,
    actual: received,
    expected
  };
}

/**
 * Check if a date is in the same minute as another date.
 */
function toBeSameMinuteAs(this: MatcherState, received: Date, expected: Date): ExpectationResult {
  const { isNot } = this;
  const pass = isSameMinute(received, expected);

  return {
    pass,
    message: () => `Expected ${received.toISOString()} ${isNot ? 'not ' : ''}to be in the same minute as ${expected.toISOString()}`,
    actual: received,
    expected
  };
}

/**
 * Check if a date is in the same hour as another date.
 */
function toBeSameHourAs(this: MatcherState, received: Date, expected: Date): ExpectationResult {
  const { isNot } = this;
  const pass = isSameHour(received, expected);

  return {
    pass,
    message: () => `Expected ${received.toISOString()} ${isNot ? 'not ' : ''}to be in the same hour as ${expected.toISOString()}`,
    actual: received,
    expected
  };
}

/**
 * Check if a date is in the same day as another date.
 */
function toBeSameDayAs(this: MatcherState, received: Date, expected: Date): ExpectationResult {
  const { isNot } = this;
  const pass = isSameDay(received, expected);

  return {
    pass,
    message: () => `Expected ${received.toISOString()} ${isNot ? 'not ' : ''}to be in the same day as ${expected.toISOString()}`,
    actual: received,
    expected
  };
}

/**
 * Check if a date is in the same week as another date.
 */
function toBeSameWeekAs(this: MatcherState, received: Date, expected: Date): ExpectationResult {
  const { isNot } = this;
  const pass = isSameWeek(received, expected);

  return {
    pass,
    message: () => `Expected ${received.toISOString()} ${isNot ? 'not ' : ''}to be in the same week as ${expected.toISOString()}`,
    actual: received,
    expected
  };
}

/**
 * Check if a date is in the same month as another date.
 */
function toBeSameMonthAs(this: MatcherState, received: Date, expected: Date): ExpectationResult {
  const { isNot } = this;
  const pass = isSameMonth(received, expected);

  return {
    pass,
    message: () => `Expected ${received.toISOString()} ${isNot ? 'not ' : ''}to be in the same month as ${expected.toISOString()}`,
    actual: received,
    expected
  };
}

/**
 * Check if a date is in the same quarter as another date.
 */
function toBeSameQuarterAs(this: MatcherState, received: Date, expected: Date): ExpectationResult {
  const { isNot } = this;
  const pass = isSameQuarter(received, expected);

  return {
    pass,
    message: () => `Expected ${received.toISOString()} ${isNot ? 'not ' : ''}to be in the same quarter as ${expected.toISOString()}`,
    actual: received,
    expected
  };
}

/**
 * Check if a date is in the same year as another date.
 */
function toBeSameYearAs(this: MatcherState, received: Date, expected: Date): ExpectationResult {
  const { isNot } = this;
  const pass = isSameYear(received, expected);

  return {
    pass,
    message: () => `Expected ${received.toISOString()} ${isNot ? 'not ' : ''}to be in the same year as ${expected.toISOString()}`,
    actual: received,
    expected
  };
}

/**
 * Check if a date is on a Monday.
 */
function toBeMonday(this: MatcherState, received: Date): ExpectationResult {
  const { isNot } = this;
  const pass = getDay(received) === 1;

  return {
    pass,
    message: () => `Expected ${received.toISOString()} ${isNot ? 'not ' : ''}to be on a Monday`,
    actual: received
  };
}

/**
 * Check if a date is on a Tuesday.
 */
function toBeTuesday(this: MatcherState, received: Date): ExpectationResult {
  const { isNot } = this;
  const pass = getDay(received) === 2;

  return {
    pass,
    message: () => `Expected ${received.toISOString()} ${isNot ? 'not ' : ''}to be on a Tuesday`,
    actual: received
  };
}

/**
 * Check if a date is on a Wednesday.
 */
function toBeWednesday(this: MatcherState, received: Date): ExpectationResult {
  const { isNot } = this;
  const pass = getDay(received) === 3;

  return {
    pass,
    message: () => `Expected ${received.toISOString()} ${isNot ? 'not ' : ''}to be on a Wednesday`,
    actual: received
  };
}

/**
 * Check if a date is on a Thursday.
 */
function toBeThursday(this: MatcherState, received: Date): ExpectationResult {
  const { isNot } = this;
  const pass = getDay(received) === 4;

  return {
    pass,
    message: () => `Expected ${received.toISOString()} ${isNot ? 'not ' : ''}to be on a Thursday`,
    actual: received
  };
}

/**
 * Check if a date is on a Friday.
 */
function toBeFriday(this: MatcherState, received: Date): ExpectationResult {
  const { isNot } = this;
  const pass = getDay(received) === 5;

  return {
    pass,
    message: () => `Expected ${received.toISOString()} ${isNot ? 'not ' : ''}to be on a Friday`,
    actual: received
  };
}

/**
 * Check if a date is on a Saturday.
 */
function toBeSaturday(this: MatcherState, received: Date): ExpectationResult {
  const { isNot } = this;
  const pass = getDay(received) === 6;

  return {
    pass,
    message: () => `Expected ${received.toISOString()} ${isNot ? 'not ' : ''}to be on a Saturday`,
    actual: received
  };
}

/**
 * Check if a date is on a Sunday.
 */
function toBeSunday(this: MatcherState, received: Date): ExpectationResult {
  const { isNot } = this;
  const pass = getDay(received) === 0;

  return {
    pass,
    message: () => `Expected ${received.toISOString()} ${isNot ? 'not ' : ''}to be on a Sunday`,
    actual: received
  };
}

export const allDateMatchers = {
  toBeBefore,
  toBeAfter,
  toBeSameSecondAs,
  toBeSameMinuteAs,
  toBeSameHourAs,
  toBeSameDayAs,
  toBeSameWeekAs,
  toBeSameMonthAs,
  toBeSameQuarterAs,
  toBeSameYearAs,
  toBeMonday,
  toBeTuesday,
  toBeWednesday,
  toBeThursday,
  toBeFriday,
  toBeSaturday,
  toBeSunday
};

export type { AllDateMatchers };
export { toBeBefore, toBeAfter, toBeSameSecondAs, toBeSameMinuteAs, toBeSameHourAs, toBeSameDayAs, toBeSameWeekAs, toBeSameMonthAs, toBeSameQuarterAs, toBeSameYearAs, toBeMonday, toBeTuesday, toBeWednesday, toBeThursday, toBeFriday, toBeSaturday, toBeSunday };
