import type { RowField } from '@ng-forge/dynamic-forms';
import { type Maybe } from '@dereekb/util';
import { DbxDateTimeFieldTimeMode } from '../../../../formly/field/value/date/datetime.field.component';
import { type DbxForgeDateTimeFieldConfig } from './datetime.field';
import { dbxForgeDateRangeField, type DbxForgeDateRangeFieldDateConfig } from './daterange.field';

// MARK: Date-Time Range Field
/**
 * Configuration for a single time within a forge date-time range (no full-day options).
 *
 * Mirrors formly's `DateTimeRangeFieldTimeConfig`.
 */
export type DbxForgeDateTimeRangeFieldTimeConfig = Omit<DbxForgeDateRangeFieldDateConfig, 'allDayLabel' | 'fullDayFieldName' | 'fullDayInUTC'>;

/**
 * Configuration for a forge date-time range field with separate start and end time pickers.
 *
 * Mirrors formly's `DateDateTimeRangeFieldConfig`.
 */
export interface DbxForgeDateTimeRangeFieldConfig extends Pick<DbxForgeDateTimeFieldConfig, 'timeDate' | 'timezone' | 'showTimezone' | 'presets' | 'valueMode' | 'minuteStep'> {
  readonly required?: boolean;
  readonly start?: Partial<DbxForgeDateTimeRangeFieldTimeConfig>;
  readonly end?: Partial<DbxForgeDateTimeRangeFieldTimeConfig>;
}

/**
 * Creates a pair of time-only pickers for selecting a time range (start and end times)
 * arranged in a flex row.
 *
 * This is the forge equivalent of formly's `formlyDateTimeRangeField()`.
 *
 * @param inputConfig - Time range configuration with optional start/end overrides
 * @returns A {@link RowField} containing the start and end time field pair
 *
 * @example
 * ```typescript
 * const field = dbxForgeDateTimeRangeField({ required: true });
 * ```
 */
export function dbxForgeDateTimeRangeField(inputConfig: DbxForgeDateTimeRangeFieldConfig = {}): RowField {
  const { required = false, start: inputStart, end: inputEnd, timezone, timeDate, showTimezone, presets, valueMode, minuteStep } = inputConfig;

  function dateTimeRangeFieldConfig(config: Maybe<Partial<DbxForgeDateTimeRangeFieldTimeConfig>>): Partial<DbxForgeDateTimeFieldConfig> {
    return {
      valueMode,
      minuteStep,
      ...config,
      required,
      timeMode: DbxDateTimeFieldTimeMode.REQUIRED,
      getSyncFieldsObs: undefined,
      timeOnly: true,
      hideDateHint: true
    };
  }

  const startKey = inputStart?.key ?? 'start';
  const endKey = inputEnd?.key ?? 'end';

  const start: Partial<DbxForgeDateTimeFieldConfig> = {
    label: 'Start Time',
    ...dateTimeRangeFieldConfig(inputStart),
    key: startKey
  };

  const end: Partial<DbxForgeDateTimeFieldConfig> = {
    label: 'End Time',
    ...dateTimeRangeFieldConfig(inputEnd),
    key: endKey
  };

  return dbxForgeDateRangeField({
    timezone,
    timeDate,
    showTimezone,
    presets,
    start,
    end
  });
}
