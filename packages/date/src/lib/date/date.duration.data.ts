import { type Milliseconds, type TimeUnit, MS_IN_DAY, MS_IN_HOUR, MS_IN_MINUTE, MS_IN_SECOND, MS_IN_WEEK, timeUnitToMilliseconds } from '@dereekb/util';

// MARK: TimeDurationData
/**
 * Represents a time duration decomposed into individual unit fields.
 *
 * Each field is optional and defaults to 0 if not provided.
 * Used for parsing, formatting, and popover picker state.
 */
export interface TimeDurationData {
  readonly weeks?: number;
  readonly days?: number;
  readonly hours?: number;
  readonly minutes?: number;
  readonly seconds?: number;
  readonly milliseconds?: number;
}

/**
 * Returns true if the input TimeDurationData has no meaningful values (all zero or undefined).
 *
 * @param data - The duration data to check
 * @returns True if empty
 *
 * @example
 * ```typescript
 * timeDurationDataIsEmpty({}); // true
 * timeDurationDataIsEmpty({ hours: 0, minutes: 0 }); // true
 * timeDurationDataIsEmpty({ hours: 1 }); // false
 * ```
 */
export function timeDurationDataIsEmpty(data: TimeDurationData): boolean {
  return !data.weeks && !data.days && !data.hours && !data.minutes && !data.seconds && !data.milliseconds;
}

// MARK: Conversion
/**
 * Converts a TimeDurationData to total milliseconds by summing all fields.
 *
 * @param data - The duration data to convert
 * @returns Total milliseconds
 *
 * @example
 * ```typescript
 * durationDataToMilliseconds({ hours: 1, minutes: 30 }); // 5400000
 * durationDataToMilliseconds({ days: 1, hours: 2 }); // 93600000
 * ```
 */
export function durationDataToMilliseconds(data: TimeDurationData): Milliseconds {
  let ms = 0;
  if (data.weeks) ms += data.weeks * MS_IN_WEEK;
  if (data.days) ms += data.days * MS_IN_DAY;
  if (data.hours) ms += data.hours * MS_IN_HOUR;
  if (data.minutes) ms += data.minutes * MS_IN_MINUTE;
  if (data.seconds) ms += data.seconds * MS_IN_SECOND;
  if (data.milliseconds) ms += data.milliseconds;
  return ms;
}

/**
 * Maps a TimeUnit to the corresponding field name in TimeDurationData.
 */
const TIME_UNIT_TO_FIELD_MAP: Readonly<Record<TimeUnit, keyof TimeDurationData>> = {
  w: 'weeks',
  d: 'days',
  h: 'hours',
  min: 'minutes',
  s: 'seconds',
  ms: 'milliseconds'
};

/**
 * The default units used for decomposition (largest to smallest, excluding ms and weeks).
 */
const DEFAULT_DECOMPOSE_UNITS: readonly TimeUnit[] = ['d', 'h', 'min', 's'];

/**
 * The millisecond values for decomposition, ordered largest to smallest.
 */
const UNIT_MS_VALUES: ReadonlyArray<{ readonly unit: TimeUnit; readonly ms: Milliseconds }> = [
  { unit: 'w', ms: MS_IN_WEEK },
  { unit: 'd', ms: MS_IN_DAY },
  { unit: 'h', ms: MS_IN_HOUR },
  { unit: 'min', ms: MS_IN_MINUTE },
  { unit: 's', ms: MS_IN_SECOND },
  { unit: 'ms', ms: 1 }
];

/**
 * Decomposes milliseconds into a TimeDurationData object using the specified units.
 *
 * Breaks down from largest to smallest unit, only using units in the provided list.
 *
 * @param ms - The total milliseconds to decompose
 * @param units - Which units to decompose into (defaults to days, hours, minutes, seconds)
 * @returns A TimeDurationData with the decomposed values
 *
 * @example
 * ```typescript
 * millisecondsToDurationData(5400000); // { days: 0, hours: 1, minutes: 30, seconds: 0 }
 * millisecondsToDurationData(90000, ['min', 's']); // { minutes: 1, seconds: 30 }
 * ```
 */
export function millisecondsToDurationData(ms: Milliseconds, units?: readonly TimeUnit[]): TimeDurationData {
  const allowedUnits = new Set(units ?? DEFAULT_DECOMPOSE_UNITS);
  const result: Record<string, number> = {};
  let remaining = Math.abs(ms);

  for (const { unit, ms: unitMs } of UNIT_MS_VALUES) {
    if (allowedUnits.has(unit)) {
      const fieldName = TIME_UNIT_TO_FIELD_MAP[unit];
      const value = Math.floor(remaining / unitMs);
      result[fieldName] = value;
      remaining -= value * unitMs;
    }
  }

  return result;
}

/**
 * Reads a specific time unit value from a TimeDurationData object.
 *
 * @param data - The duration data
 * @param unit - The time unit to read
 * @returns The value for that unit, or 0 if not set
 */
export function getDurationDataValue(data: TimeDurationData, unit: TimeUnit): number {
  return data[TIME_UNIT_TO_FIELD_MAP[unit]] ?? 0;
}

/**
 * Returns a new TimeDurationData with the specified unit set to the given value.
 *
 * @param data - The original duration data
 * @param unit - The time unit to set
 * @param value - The new value
 * @returns A new TimeDurationData with the updated value
 */
export function setDurationDataValue(data: TimeDurationData, unit: TimeUnit, value: number): TimeDurationData {
  return { ...data, [TIME_UNIT_TO_FIELD_MAP[unit]]: value };
}

// MARK: Parsing
/**
 * Regex for matching duration components in a string.
 *
 * Matches patterns like "3d", "10 hours", "5min", "8 sec", "500ms", "2w", etc.
 */
const DURATION_COMPONENT_REGEX = /(\d+(?:\.\d+)?)\s*(w|wk|weeks?|d|days?|h|hr|hours?|m(?!s)|min|minutes?|s|sec|seconds?|ms|milliseconds?)/gi;

/**
 * Maps parsed unit strings to their canonical TimeUnit value.
 */
function normalizeUnitString(unitStr: string): TimeUnit {
  const lower = unitStr.toLowerCase();

  if (lower === 'ms' || lower === 'milliseconds' || lower === 'millisecond') {
    return 'ms';
  }

  if (lower === 's' || lower === 'sec' || lower === 'second' || lower === 'seconds') {
    return 's';
  }

  if (lower === 'm' || lower === 'min' || lower === 'minute' || lower === 'minutes') {
    return 'min';
  }

  if (lower === 'h' || lower === 'hr' || lower === 'hour' || lower === 'hours') {
    return 'h';
  }

  if (lower === 'd' || lower === 'day' || lower === 'days') {
    return 'd';
  }

  if (lower === 'w' || lower === 'wk' || lower === 'week' || lower === 'weeks') {
    return 'w';
  }

  return 'ms';
}

/**
 * Parses a human-readable duration string into a TimeDurationData object.
 *
 * Supports compact formats ("3d10h5m8s"), spaced formats ("3d 10h 5m 8s"),
 * and long formats ("3 days 10 hours 5 minutes 8 seconds"). Mixed formats
 * are also supported. If the same unit appears multiple times, values are summed.
 *
 * If the string contains only a number with no unit, it is treated as the
 * smallest unit that would make sense (milliseconds by default).
 *
 * @param input - The duration string to parse
 * @returns A TimeDurationData object with the parsed values
 *
 * @example
 * ```typescript
 * parseDurationString('3d10h5m8s'); // { days: 3, hours: 10, minutes: 5, seconds: 8 }
 * parseDurationString('2 hours 30 minutes'); // { hours: 2, minutes: 30 }
 * parseDurationString('1w 2d'); // { weeks: 1, days: 2 }
 * parseDurationString('500ms'); // { milliseconds: 500 }
 * ```
 */
export function parseDurationString(input: string): TimeDurationData {
  const result: Record<string, number> = {};

  let match: RegExpExecArray | null;
  let hasMatches = false;

  // Reset regex lastIndex for global regex
  DURATION_COMPONENT_REGEX.lastIndex = 0;

  while ((match = DURATION_COMPONENT_REGEX.exec(input)) !== null) {
    hasMatches = true;
    const amount = parseFloat(match[1]);
    const unit = normalizeUnitString(match[2]);
    const fieldName = TIME_UNIT_TO_FIELD_MAP[unit];

    // Sum if the same unit appears multiple times
    result[fieldName] = (result[fieldName] ?? 0) + amount;
  }

  // If no matches but the input is a plain number, treat as milliseconds
  if (!hasMatches) {
    const trimmed = input.trim();
    const asNumber = parseFloat(trimmed);

    if (!isNaN(asNumber)) {
      result['milliseconds'] = asNumber;
    }
  }

  return result;
}

/**
 * Parses a duration string directly to milliseconds.
 *
 * @param input - The duration string to parse
 * @returns Total milliseconds
 *
 * @example
 * ```typescript
 * parseDurationStringToMilliseconds('1h30m'); // 5400000
 * ```
 */
export function parseDurationStringToMilliseconds(input: string): Milliseconds {
  return durationDataToMilliseconds(parseDurationString(input));
}

// MARK: Formatting
/**
 * Compact format labels for each unit used in formatted strings.
 */
const COMPACT_UNIT_LABELS: ReadonlyArray<{ readonly field: keyof TimeDurationData; readonly label: string }> = [
  { field: 'weeks', label: 'w' },
  { field: 'days', label: 'd' },
  { field: 'hours', label: 'h' },
  { field: 'minutes', label: 'm' },
  { field: 'seconds', label: 's' },
  { field: 'milliseconds', label: 'ms' }
];

/**
 * Formats a TimeDurationData to a compact string like "3d10h5m8s".
 *
 * Omits zero-value units. Returns "0s" if all fields are zero or empty.
 *
 * @param data - The duration data to format
 * @returns A compact duration string
 *
 * @example
 * ```typescript
 * formatDurationString({ days: 3, hours: 10, minutes: 5, seconds: 8 }); // "3d10h5m8s"
 * formatDurationString({ hours: 2, minutes: 30 }); // "2h30m"
 * formatDurationString({}); // "0s"
 * ```
 */
export function formatDurationString(data: TimeDurationData): string {
  const parts: string[] = [];

  for (const { field, label } of COMPACT_UNIT_LABELS) {
    const value = data[field];

    if (value) {
      parts.push(`${value}${label}`);
    }
  }

  return parts.length > 0 ? parts.join('') : '0s';
}

/**
 * Long format labels for each unit.
 */
const LONG_UNIT_LABELS: ReadonlyArray<{ readonly field: keyof TimeDurationData; readonly singular: string; readonly plural: string }> = [
  { field: 'weeks', singular: 'week', plural: 'weeks' },
  { field: 'days', singular: 'day', plural: 'days' },
  { field: 'hours', singular: 'hour', plural: 'hours' },
  { field: 'minutes', singular: 'minute', plural: 'minutes' },
  { field: 'seconds', singular: 'second', plural: 'seconds' },
  { field: 'milliseconds', singular: 'millisecond', plural: 'milliseconds' }
];

/**
 * Formats a TimeDurationData to a long human-readable string.
 *
 * Omits zero-value units. Returns "0 seconds" if all fields are zero or empty.
 *
 * @param data - The duration data to format
 * @returns A human-readable duration string
 *
 * @example
 * ```typescript
 * formatDurationStringLong({ days: 3, hours: 10 }); // "3 days 10 hours"
 * formatDurationStringLong({ hours: 1, minutes: 1 }); // "1 hour 1 minute"
 * ```
 */
export function formatDurationStringLong(data: TimeDurationData): string {
  const parts: string[] = [];

  for (const { field, singular, plural } of LONG_UNIT_LABELS) {
    const value = data[field];

    if (value) {
      parts.push(`${value} ${value === 1 ? singular : plural}`);
    }
  }

  return parts.length > 0 ? parts.join(' ') : '0 seconds';
}
