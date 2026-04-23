import type { RowField } from '@ng-forge/dynamic-forms';
import { dbxForgeRow } from '../../wrapper/wrapper';
import { DbxDateTimeFieldTimeMode } from '../../../../formly/field/value/date/datetime.field.component';
import { dbxForgeDateTimeField, type DbxForgeDateTimeFieldConfig } from './datetime.field';
import type { DbxForgeDateTimeFieldComponentProps } from './datetime.field.component';
import { of } from 'rxjs';

// MARK: Date Range Field
/**
 * Per-field overrides for a forge date range start/end picker.
 *
 * Mirrors formly's `DateDateRangeFieldDateConfig`. Runtime component props go under `props`;
 * `dateLabel`, `timeOnly`, `timeMode`, and `getSyncFieldsObs` are managed by the row builder
 * and excluded from the override surface.
 */
export interface DbxForgeDateRangeFieldDateConfig extends Omit<DbxForgeDateTimeFieldConfig, 'props'> {
  readonly props?: Omit<DbxForgeDateTimeFieldComponentProps, 'dateLabel' | 'timeOnly' | 'timeMode' | 'getSyncFieldsObs'>;
}

type DbxForgeDateRangeRowSharedProps = Pick<DbxForgeDateTimeFieldComponentProps, 'timeDate' | 'timezone' | 'showTimezone' | 'presets' | 'valueMode' | 'minuteStep'>;

/**
 * Configuration for a forge date range row with separate start and end date pickers.
 *
 * Mirrors formly's `DateDateRangeFieldConfig`. Shared runtime props (timezone, presets,
 * valueMode, etc.) go under `props`; per-field overrides go under `start` / `end`.
 */
export interface DbxForgeDateRangeRowConfig {
  readonly required?: boolean;
  readonly props?: DbxForgeDateRangeRowSharedProps;
  readonly start?: Partial<DbxForgeDateRangeFieldDateConfig>;
  readonly end?: Partial<DbxForgeDateRangeFieldDateConfig>;
}

/**
 * Composite builder that creates a pair of date pickers for selecting a date range (start and end dates)
 * arranged in a flex row. The pickers are synchronized so the start date stays before the end date.
 *
 * This is the forge equivalent of formly's `formlyDateRangeField()`.
 *
 * @param config - Date range configuration with optional shared props and start/end overrides
 * @returns A {@link RowField} containing the start and end date field pair
 *
 * @example
 * ```typescript
 * const row = dbxForgeDateRangeRow({
 *   required: true,
 *   props: { timezone: 'America/New_York' },
 *   start: { key: 'from' },
 *   end: { key: 'to' }
 * });
 * ```
 */
export function dbxForgeDateRangeRow(config: DbxForgeDateRangeRowConfig = {}): RowField {
  const { required: inputRequired, start, end, props: sharedProps } = config;
  const required = inputRequired ?? start?.required ?? false;

  const startFieldKey = start?.key ?? 'start';
  const endFieldKey = end?.key ?? 'end';

  const startField = dbxForgeDateTimeField({
    ...start,
    required,
    key: startFieldKey,
    props: {
      ...sharedProps,
      ...start?.props,
      dateLabel: 'Start',
      timeMode: DbxDateTimeFieldTimeMode.NONE,
      allDayLabel: '',
      getSyncFieldsObs: () => of([{ syncWith: endFieldKey, syncType: 'after' as const }])
    }
  });

  const endField = dbxForgeDateTimeField({
    ...end,
    required,
    key: endFieldKey,
    props: {
      ...sharedProps,
      ...end?.props,
      dateLabel: 'End',
      timeMode: DbxDateTimeFieldTimeMode.NONE,
      allDayLabel: '',
      getSyncFieldsObs: () => of([{ syncWith: startFieldKey, syncType: 'before' as const }])
    }
  });

  return dbxForgeRow({
    fields: [
      { ...startField, col: 6 },
      { ...endField, col: 6 }
    ]
  });
}
