import type { RowField } from '@ng-forge/dynamic-forms';
import { of } from 'rxjs';
import { DbxDateTimeFieldTimeMode } from '../../../../formly/field/value/date/datetime.field.component';
import type { DbxForgeDateTimeFieldComponentProps } from './datetime.field.component';
import { type DbxForgeDateRangeFieldDateConfig } from './daterange.field';
import { dbxForgeDateTimeField } from './datetime.field';
import { dbxForgeRow } from '../../wrapper/wrapper';

// MARK: Date-Time Range Field
/**
 * Per-field overrides for a forge date-time range start/end time picker.
 *
 * Mirrors formly's `DateTimeRangeFieldTimeConfig`. All-day related props are excluded
 * from the override surface.
 */
export interface DbxForgeDateTimeRangeFieldTimeConfig extends Omit<DbxForgeDateRangeFieldDateConfig, 'props'> {
  readonly props?: Omit<DbxForgeDateTimeFieldComponentProps, 'dateLabel' | 'timeMode' | 'timeOnly' | 'hideDateHint' | 'allDayLabel' | 'fullDayFieldName' | 'fullDayInUTC' | 'getSyncFieldsObs'>;
}

type DbxForgeDateTimeRangeRowSharedProps = Pick<DbxForgeDateTimeFieldComponentProps, 'timeDate' | 'timezone' | 'showTimezone' | 'presets' | 'valueMode' | 'minuteStep'>;

/**
 * Configuration for a forge date-time range row with separate start and end time pickers.
 *
 * Mirrors formly's `DateDateTimeRangeFieldConfig`.
 */
export interface DbxForgeDateTimeRangeRowConfig {
  readonly required?: boolean;
  readonly props?: DbxForgeDateTimeRangeRowSharedProps;
  readonly start?: Partial<DbxForgeDateTimeRangeFieldTimeConfig>;
  readonly end?: Partial<DbxForgeDateTimeRangeFieldTimeConfig>;
}

/**
 * Composite builder that creates a pair of time-only pickers for selecting a time range (start and end times)
 * arranged in a flex row.
 *
 * This is the forge equivalent of formly's `formlyDateTimeRangeField()`.
 *
 * @param inputConfig - Time range configuration with optional shared props and start/end overrides
 * @returns A {@link RowField} containing the start and end time field pair
 *
 * @example
 * ```typescript
 * const row = dbxForgeDateTimeRangeRow({ required: true });
 * ```
 */
export function dbxForgeDateTimeRangeRow(inputConfig: DbxForgeDateTimeRangeRowConfig = {}): RowField {
  const { required = false, start: inputStart, end: inputEnd, props: sharedProps } = inputConfig;

  const startFieldKey = inputStart?.key ?? 'start';
  const endFieldKey = inputEnd?.key ?? 'end';

  const startField = dbxForgeDateTimeField({
    label: inputStart?.label ?? 'Start Time',
    ...inputStart,
    required,
    key: startFieldKey,
    props: {
      ...sharedProps,
      ...inputStart?.props,
      timeMode: DbxDateTimeFieldTimeMode.REQUIRED,
      timeOnly: true,
      hideDateHint: true,
      getSyncFieldsObs: () => of([{ syncWith: endFieldKey, syncType: 'after' as const }])
    }
  });

  const endField = dbxForgeDateTimeField({
    label: inputEnd?.label ?? 'End Time',
    ...inputEnd,
    required,
    key: endFieldKey,
    props: {
      ...sharedProps,
      ...inputEnd?.props,
      timeMode: DbxDateTimeFieldTimeMode.REQUIRED,
      timeOnly: true,
      hideDateHint: true,
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
