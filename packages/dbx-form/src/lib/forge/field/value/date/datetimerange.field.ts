import type { RowField } from '@ng-forge/dynamic-forms';
import { type Maybe } from '@dereekb/util';
import { DbxDateTimeFieldTimeMode } from '../../../../formly/field/value/date/datetime.field.component';
import type { DbxForgeDateTimeFieldComponentProps } from './datetime.field.component';
import { dbxForgeDateRangeRow, type DbxForgeDateRangeFieldDateConfig } from './daterange.field';

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

  function buildSide(config: Maybe<Partial<DbxForgeDateTimeRangeFieldTimeConfig>>, defaultLabel: string, defaultKey: string): Partial<DbxForgeDateRangeFieldDateConfig> {
    const props = {
      ...config?.props,
      timeMode: DbxDateTimeFieldTimeMode.REQUIRED,
      timeOnly: true,
      hideDateHint: true
    };

    return {
      label: defaultLabel,
      ...config,
      key: config?.key ?? defaultKey,
      required,
      props: props as DbxForgeDateRangeFieldDateConfig['props']
    };
  }

  return dbxForgeDateRangeRow({
    required,
    props: sharedProps,
    start: buildSide(inputStart, 'Start Time', 'start'),
    end: buildSide(inputEnd, 'End Time', 'end')
  });
}
