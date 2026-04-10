import type { BaseValueField } from '@ng-forge/dynamic-forms';
import { filterFromPOJO, type ArrayOrValue, type Maybe, type TimezoneString } from '@dereekb/util';
import type { ObservableOrValue } from '@dereekb/rxjs';
import type { DateRange, DateCellScheduleDateFilterConfig, DateCellScheduleDayCode, DateOrDateRangeOrDateCellIndexOrDateCellRange } from '@dereekb/date';
import type { CalendarScheduleSelectionState } from '../../calendar.schedule.selection.store';
import type { DbxScheduleSelectionCalendarDatePopupContentConfig } from '../../calendar.schedule.selection.dialog.component';
import type { DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import type { ForgeCalendarDateScheduleRangeFieldComponentProps } from './calendar.schedule.forge.field.component';

/**
 * The custom forge field type name for the calendar date schedule range field.
 */
export const FORGE_CALENDAR_DATE_SCHEDULE_RANGE_FIELD_TYPE = 'dbx-forge-calendar-date-schedule-range' as const;

/**
 * Field definition type for a forge calendar date schedule range field.
 */
export type ForgeCalendarDateScheduleRangeFieldDef = BaseValueField<ForgeCalendarDateScheduleRangeFieldComponentProps, unknown> & {
  readonly type: typeof FORGE_CALENDAR_DATE_SCHEDULE_RANGE_FIELD_TYPE;
};

/**
 * Configuration for a forge calendar date schedule range field.
 */
export interface ForgeCalendarDateScheduleRangeFieldConfig extends Pick<CalendarScheduleSelectionState, 'computeSelectionResultRelativeToFilter' | 'initialSelectionState'>, Partial<Pick<CalendarScheduleSelectionState, 'cellContentFactory'>> {
  readonly key?: string;
  readonly label?: string;
  readonly description?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly appearance?: string;
  /**
   * Whether or not to allow inputting custom text into the picker.
   *
   * If false, when the input text is picked the date picker will open.
   *
   * Is false by default.
   */
  readonly allowTextInput?: boolean;
  /**
   * Whether or not to hide the customize button. Defaults to false.
   */
  readonly hideCustomize?: boolean;
  /**
   * Whether or not to allow customizing before picking a date range to customize.
   *
   * Defaults to false.
   */
  readonly allowCustomizeWithoutDateRange?: boolean;
  /**
   * (Optional) Timezone to use for the output start date.
   *
   * If a filter is provided, this timezone overrides the filter's timezone output.
   */
  readonly outputTimezone?: ObservableOrValue<Maybe<TimezoneString>>;
  /**
   * (Optional) Default schedule days to allow.
   */
  readonly defaultScheduleDays?: ObservableOrValue<Maybe<Iterable<DateCellScheduleDayCode>>>;
  /**
   * Optional min/max date range to filter on. Works in conjunction with the filter.
   */
  readonly minMaxDateRange?: ObservableOrValue<Maybe<Partial<DateRange>>>;
  /**
   * (Optional) Observable with a filter value to apply to the date range.
   */
  readonly filter?: ObservableOrValue<Maybe<DateCellScheduleDateFilterConfig>>;
  /**
   * (Optional) Observable with days and values to exclude from the date range.
   */
  readonly exclusions?: ObservableOrValue<Maybe<ArrayOrValue<DateOrDateRangeOrDateCellIndexOrDateCellRange>>>;
  /**
   * Custom dialog content config for the popup
   */
  readonly dialogContentConfig?: Maybe<DbxScheduleSelectionCalendarDatePopupContentConfig>;
  /**
   * Custom details config for the date range
   */
  readonly customDetailsConfig?: Maybe<DbxInjectionComponentConfig>;
}

/**
 * Creates a forge field definition for a calendar date schedule range picker.
 *
 * This is the forge equivalent of {@link dateScheduleRangeField}.
 *
 * @param config - Optional schedule range field configuration overrides
 * @returns A validated forge field definition for date schedule range selection
 */
export function forgeDateScheduleRangeField(config: ForgeCalendarDateScheduleRangeFieldConfig = {}): ForgeCalendarDateScheduleRangeFieldDef {
  const { key = 'schedule', label, description, required, readonly: isReadonly, appearance, allowTextInput, hideCustomize, allowCustomizeWithoutDateRange, outputTimezone, defaultScheduleDays, minMaxDateRange, filter, exclusions, dialogContentConfig, computeSelectionResultRelativeToFilter, initialSelectionState, cellContentFactory, customDetailsConfig } = config;

  const props: ForgeCalendarDateScheduleRangeFieldComponentProps = filterFromPOJO({
    label: label ?? 'Schedule',
    description,
    appearance,
    allowTextInput,
    hideCustomize,
    allowCustomizeWithoutDateRange,
    outputTimezone,
    defaultScheduleDays,
    minMaxDateRange,
    filter,
    exclusions,
    dialogContentConfig,
    computeSelectionResultRelativeToFilter,
    initialSelectionState,
    cellContentFactory,
    customDetailsConfig
  });

  return filterFromPOJO({
    key,
    type: FORGE_CALENDAR_DATE_SCHEDULE_RANGE_FIELD_TYPE,
    label: label ?? 'Schedule',
    value: undefined as unknown,
    required,
    readonly: isReadonly,
    props: Object.keys(props).length > 0 ? props : undefined
  }) as ForgeCalendarDateScheduleRangeFieldDef;
}
