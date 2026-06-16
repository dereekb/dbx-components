import { type DateTimeMinuteConfig } from '@dereekb/date';

export enum DbxDateTimeFieldTimeMode {
  /**
   * Time is required.
   */
  REQUIRED = 'required',
  /**
   * Time is optional.
   */
  OPTIONAL = 'optional',
  /**
   * Time is permenantly off.
   */
  NONE = 'none'
}

/**
 * Picker configuration for the date-time field, derived from {@link DateTimeMinuteConfig} without the `date` property.
 */
export type DbxDateTimePickerConfiguration = Omit<DateTimeMinuteConfig, 'date'>;

/**
 * Direction of synchronization between date-time fields.
 */
export type DbxDateTimeFieldSyncType = 'before' | 'after';

/**
 * Error code used when the selected date is not in the schedule.
 */
export const DBX_DATE_TIME_FIELD_DATE_NOT_IN_SCHEDULE_ERROR = 'dateTimeFieldDateNotInSchedule';

/**
 * Error code used when the selected time/time input is not in the limited range.
 */
export const DBX_DATE_TIME_FIELD_TIME_NOT_IN_RANGE_ERROR = 'dateTimeFieldTimeNotInRange';
