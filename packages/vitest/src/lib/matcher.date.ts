import type { ExpectationResult, MatcherState } from '@vitest/expect';
import { isBefore, isAfter, isSameSecond, isSameMinute, isSameHour, isSameDay, isSameWeek, isSameMonth, isSameQuarter, isSameYear, getDay } from 'date-fns';

// Vitest implemenation of matchers from the jest-date package.

/**
 * Utility type that extracts the `expected` parameter from a date matcher function, producing the consumer-facing matcher signature.
 *
 * Used by {@link AllDateMatchers} to map internal matcher implementations to their public `expect().toBe*()` signatures.
 */
export type DateMatcherTypeWithExpected<T extends (this: MatcherState, input: Date, expected: Date) => ExpectationResult> = T extends (this: MatcherState, input: any, expected: infer B) => ExpectationResult ? (expected: B) => ExpectationResult : never;

/**
 * Utility type that strips the `input` parameter from a date matcher function, producing a zero-argument consumer-facing matcher signature.
 *
 * Used by {@link AllDateMatchers} for day-of-week matchers like `toBeMonday()`.
 */
export type DateMatcherTypeWithoutExpected<T extends (this: MatcherState, input: Date) => ExpectationResult> = T extends (this: MatcherState, input: any) => ExpectationResult ? () => ExpectationResult : never;

/**
 * Augmented matcher interface providing date comparison and day-of-week assertion methods for Vitest.
 *
 * Register these matchers via `expect.extend(allDateMatchers)` to use them in tests.
 *
 * @see https://vitest.dev/guide/extending-matchers.html#extending-matchers
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
 * Asserts that the received date is chronologically before the expected date.
 *
 * @param received - The date under test
 * @param expected - The date to compare against
 * @returns Matcher result with a descriptive message on failure
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
 * Asserts that the received date is chronologically after the expected date.
 *
 * @param received - The date under test
 * @param expected - The date to compare against
 * @returns Matcher result with a descriptive message on failure
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
 * Asserts that the received date falls within the same calendar second as the expected date.
 *
 * @param received - The date under test
 * @param expected - The date to compare against
 * @returns Matcher result with a descriptive message on failure
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
 * Asserts that the received date falls within the same calendar minute as the expected date.
 *
 * @param received - The date under test
 * @param expected - The date to compare against
 * @returns Matcher result with a descriptive message on failure
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
 * Asserts that the received date falls within the same calendar hour as the expected date.
 *
 * @param received - The date under test
 * @param expected - The date to compare against
 * @returns Matcher result with a descriptive message on failure
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
 * Asserts that the received date falls on the same calendar day as the expected date.
 *
 * @param received - The date under test
 * @param expected - The date to compare against
 * @returns Matcher result with a descriptive message on failure
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
 * Asserts that the received date falls within the same calendar week as the expected date.
 *
 * @param received - The date under test
 * @param expected - The date to compare against
 * @returns Matcher result with a descriptive message on failure
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
 * Asserts that the received date falls within the same calendar month as the expected date.
 *
 * @param received - The date under test
 * @param expected - The date to compare against
 * @returns Matcher result with a descriptive message on failure
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
 * Asserts that the received date falls within the same fiscal quarter as the expected date.
 *
 * @param received - The date under test
 * @param expected - The date to compare against
 * @returns Matcher result with a descriptive message on failure
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
 * Asserts that the received date falls within the same calendar year as the expected date.
 *
 * @param received - The date under test
 * @param expected - The date to compare against
 * @returns Matcher result with a descriptive message on failure
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
 * Asserts that the received date falls on a Monday.
 *
 * @param received - The date under test
 * @returns Matcher result with a descriptive message on failure
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
 * Asserts that the received date falls on a Tuesday.
 *
 * @param received - The date under test
 * @returns Matcher result with a descriptive message on failure
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
 * Asserts that the received date falls on a Wednesday.
 *
 * @param received - The date under test
 * @returns Matcher result with a descriptive message on failure
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
 * Asserts that the received date falls on a Thursday.
 *
 * @param received - The date under test
 * @returns Matcher result with a descriptive message on failure
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
 * Asserts that the received date falls on a Friday.
 *
 * @param received - The date under test
 * @returns Matcher result with a descriptive message on failure
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
 * Asserts that the received date falls on a Saturday.
 *
 * @param received - The date under test
 * @returns Matcher result with a descriptive message on failure
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
 * Asserts that the received date falls on a Sunday.
 *
 * @param received - The date under test
 * @returns Matcher result with a descriptive message on failure
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

/**
 * Object containing all date matcher implementations, ready to be registered with `expect.extend()`.
 *
 * @example
 * ```typescript
 * import { allDateMatchers } from '@dereekb/vitest';
 * expect.extend(allDateMatchers);
 *
 * expect(new Date('2024-01-15')).toBeBefore(new Date('2024-02-01'));
 * expect(new Date('2024-01-15')).toBeMonday();
 * ```
 */
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
