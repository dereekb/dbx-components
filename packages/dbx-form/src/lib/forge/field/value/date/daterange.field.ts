import type { RowField } from '@ng-forge/dynamic-forms';
import { dbxForgeRow } from '../../wrapper/wrapper';
import { DbxDateTimeFieldTimeMode } from '../../../../formly/field/value/date/datetime.field.component';
import { dbxForgeDateTimeField, type DbxForgeDateTimeFieldConfig } from './datetime.field';
import { of } from 'rxjs';

// MARK: Date Range Field
/**
 * Configuration for a single date within a forge date range (no time mode or sync).
 *
 * Mirrors formly's `DateDateRangeFieldDateConfig`.
 */
export type DbxForgeDateRangeFieldDateConfig = Omit<DbxForgeDateTimeFieldConfig, 'dateLabel' | 'timeOnly' | 'timeMode' | 'getSyncFieldsObs'>;

/**
 * Configuration for a forge date range field with separate start and end date pickers.
 *
 * Mirrors formly's `DateDateRangeFieldConfig`. Each start/end sub-config is passed
 * through to {@link dbxForgeDateTimeField}, so all datetime features (timezone, presets,
 * pickerConfig, etc.) are available per-field.
 */
export interface DbxForgeDateRangeFieldConfig extends Pick<DbxForgeDateTimeFieldConfig, 'timeDate' | 'timezone' | 'showTimezone' | 'presets' | 'valueMode' | 'minuteStep'> {
  readonly required?: boolean;
  readonly start?: Partial<DbxForgeDateRangeFieldDateConfig>;
  readonly end?: Partial<DbxForgeDateRangeFieldDateConfig>;
}

/**
 * Creates a pair of date pickers for selecting a date range (start and end dates)
 * arranged in a flex row. The pickers are synchronized so the start date stays before the end date.
 *
 * This is the forge equivalent of formly's `formlyDateRangeField()`.
 *
 * @param config - Date range configuration with optional start/end overrides
 * @returns A {@link RowField} containing the start and end date field pair
 *
 * @example
 * ```typescript
 * const field = dbxForgeDateRangeField({ required: true, start: { key: 'from' }, end: { key: 'to' } });
 * ```
 */
export function dbxForgeDateRangeField(config: DbxForgeDateRangeFieldConfig = {}): RowField {
  const { required: inputRequired, start, end, timeDate, timezone, showTimezone, presets, valueMode, minuteStep } = config;
  const required = inputRequired ?? start?.required ?? false;

  const startFieldKey = start?.key ?? 'start';
  const endFieldKey = end?.key ?? 'end';

  const startField = dbxForgeDateTimeField({
    dateLabel: 'Start',
    timeMode: DbxDateTimeFieldTimeMode.NONE,
    getSyncFieldsObs: () => of([{ syncWith: endFieldKey, syncType: 'after' as const }]),
    presets,
    allDayLabel: '',
    timeDate,
    timezone,
    showTimezone,
    valueMode,
    minuteStep,
    ...start,
    required,
    key: startFieldKey
  });

  const endField = dbxForgeDateTimeField({
    dateLabel: 'End',
    timeMode: DbxDateTimeFieldTimeMode.NONE,
    getSyncFieldsObs: () => of([{ syncWith: startFieldKey, syncType: 'before' as const }]),
    presets,
    allDayLabel: '',
    timeDate,
    timezone,
    showTimezone,
    valueMode,
    minuteStep,
    ...end,
    required,
    key: endFieldKey
  });

  return dbxForgeRow({
    fields: [
      { ...startField, col: 6 },
      { ...endField, col: 6 }
    ]
  });
}
