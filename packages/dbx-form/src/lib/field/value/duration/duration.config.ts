/**
 * Determines the shape of the output value from a time duration field.
 *
 * - `'number'` — output is a single number in the configured output unit
 * - `'hours_and_minutes'` — output is an HoursAndMinutes object
 * - `'duration_data'` — output is a TimeDurationData object
 */
export type TimeDurationFieldValueMode = 'number' | 'hours_and_minutes' | 'duration_data';
