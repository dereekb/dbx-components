import { type } from 'arktype';
import { isKnownTimezone } from '../timezone/timezone';
import { DATE_CELL_SCHEDULE_ENCODED_WEEK_REGEX } from './date.cell.schedule';
import { isValidDateCellTiming } from './date.cell';
import { isValidDateCellRange, isValidDateCellRangeSeries } from './date.cell.index';
import { DateRangeType } from './date.range';
import { CalendarDateType } from './date.calendar';

// MARK: Timezone
/**
 * ArkType DTO schema that validates a string is a recognized IANA timezone.
 *
 * Delegates to {@link isKnownTimezone} for the actual check.
 *
 * Intended for validating and parsing DTO/JSON data where timezones arrive as strings.
 *
 * @example
 * ```ts
 * const result = knownTimezoneType('America/Denver');
 * ```
 */
export const knownTimezoneType = type('string > 0').narrow((val, ctx) => (val != null && isKnownTimezone(val)) || ctx.mustBe('a known timezone'));

// MARK: DateDurationSpan
/**
 * ArkType DTO schema for {@link DateDurationSpan}.
 *
 * Parses date strings from JSON/DTO input into Date objects using `string.date.parse`.
 * Use this schema when validating and converting serialized data (e.g., API responses, JSON payloads)
 * into the corresponding runtime types.
 */
export const dateDurationSpanType = type({
  startsAt: 'string.date.parse',
  duration: 'number >= 0'
});

// MARK: DateRange
/**
 * ArkType DTO schema for {@link DateRange}.
 *
 * Parses date strings from JSON/DTO input into Date objects using `string.date.parse`.
 * Use this schema when validating and converting serialized data (e.g., API responses, JSON payloads)
 * into the corresponding runtime types.
 */
export const dateRangeType = type({
  start: 'string.date.parse',
  end: 'string.date.parse'
});

// MARK: DateRangeParams
/**
 * ArkType DTO schema for {@link DateRangeParams}.
 *
 * Parses date strings from JSON/DTO input into Date objects using `string.date.parse`.
 * Use this schema when validating and converting serialized data (e.g., API responses, JSON payloads)
 * into the corresponding runtime types.
 */
export const dateRangeParamsType = type({
  type: type.enumerated(...Object.values(DateRangeType)),
  date: 'string.date.parse',
  'distance?': 'number'
});

// MARK: DateCell
/**
 * ArkType DTO schema for {@link DateCell}.
 *
 * Validates a cell index from JSON/DTO input.
 * Use this schema when validating and converting serialized data (e.g., API responses, JSON payloads)
 * into the corresponding runtime types.
 */
export const dateCellType = type({
  i: 'number.integer >= 0'
});

// MARK: DateCellRange
/**
 * ArkType DTO schema for {@link DateCellRange}.
 *
 * Validates cell range indexes from JSON/DTO input.
 * Use this schema when validating and converting serialized data (e.g., API responses, JSON payloads)
 * into the corresponding runtime types.
 */
export const dateCellRangeType = dateCellType.merge({
  'to?': 'number.integer >= 0'
});

// MARK: DateCellTiming
/**
 * ArkType DTO schema for {@link DateCellTiming}.
 *
 * Parses date strings from JSON/DTO input into Date objects using `string.date.parse`.
 * Use this schema when validating and converting serialized data (e.g., API responses, JSON payloads)
 * into the corresponding runtime types.
 */
export const dateCellTimingType = dateDurationSpanType.merge({
  end: 'string.date.parse',
  timezone: knownTimezoneType
});

// MARK: CalendarDate
/**
 * ArkType DTO schema for {@link CalendarDate}.
 *
 * Parses date strings from JSON/DTO input into Date objects using `string.date.parse`.
 * Use this schema when validating and converting serialized data (e.g., API responses, JSON payloads)
 * into the corresponding runtime types.
 */
export const calendarDateType = dateDurationSpanType.merge({
  type: type.enumerated(...Object.values(CalendarDateType))
});

// MARK: DateCellSchedule
/**
 * ArkType DTO schema for {@link DateCellSchedule}.
 *
 * Validates schedule data from JSON/DTO input.
 * Use this schema when validating and converting serialized data (e.g., API responses, JSON payloads)
 * into the corresponding runtime types.
 */
export const dateCellScheduleType = type({
  w: [DATE_CELL_SCHEDULE_ENCODED_WEEK_REGEX, '&', 'string'] as const,
  'd?': 'number.integer >= 0 []',
  'ex?': 'number.integer >= 0 []'
});

// MARK: ModelRecurrenceInfo
/**
 * ArkType DTO schema for {@link ModelRecurrenceInfo}.
 *
 * Parses date strings from JSON/DTO input into Date objects using `string.date.parse`.
 * Use this schema when validating and converting serialized data (e.g., API responses, JSON payloads)
 * into the corresponding runtime types.
 */
export const modelRecurrenceInfoType = type({
  'timezone?': 'string',
  rrule: 'string',
  start: 'string.date.parse',
  end: 'string.date.parse',
  'forever?': 'boolean'
});

// MARK: Validators
/**
 * ArkType DTO schema that validates a value is a valid {@link DateCellTiming}.
 *
 * Parses date strings from JSON/DTO input into Date objects, then validates the resulting timing
 * using {@link isValidDateCellTiming}.
 */
export const validDateCellTimingType = dateCellTimingType.narrow((val, ctx) => (val != null && isValidDateCellTiming(val)) || ctx.mustBe('a valid DateCellTiming'));

/**
 * ArkType DTO schema that validates a value is a valid {@link DateCellRange} (non-negative indexes, `to >= i`).
 *
 * Validates cell range data from JSON/DTO input.
 */
export const validDateCellRangeType = dateCellRangeType.narrow((val, ctx) => (val != null && isValidDateCellRange(val)) || ctx.mustBe('a valid DateCellRange'));

/**
 * ArkType DTO schema that validates a value is a sorted array of non-overlapping {@link DateCellRange} values.
 *
 * Validates cell range series data from JSON/DTO input.
 */
export const validDateCellRangeSeriesType = type(dateCellRangeType.array()).narrow((val, ctx) => (val != null && isValidDateCellRangeSeries(val)) || ctx.mustBe('a valid DateCellRange series with items sorted in ascending order and no repeat indexes'));
