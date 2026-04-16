import { forgeToggleField } from '@dereekb/dbx-form';
import { getDaysOfWeekNames } from '@dereekb/util';
import type { FieldDef, FormConfig } from '@ng-forge/dynamic-forms';

/**
 * Creates forge form fields for selecting which days of the week are enabled in a schedule selection calendar
 * as a vertical list of toggle fields with styled boxes.
 *
 * This is the forge equivalent of {@link dbxScheduleSelectionCalendarDateDaysFormFields}.
 *
 * @returns A FormConfig with toggle fields for each day of the week
 */
export function dbxScheduleSelectionCalendarDateDaysForgeFormFields(): FormConfig {
  return { fields: dbxScheduleSelectionCalendarDateDaysForgeFormDayFields() } as FormConfig;
}

/**
 * Creates an array of forge toggle field definitions, one for each day of the week, keyed by lowercase day name.
 *
 * @returns An array of forge toggle field definitions for each day of the week
 */
export function dbxScheduleSelectionCalendarDateDaysForgeFormDayFields(): FieldDef<unknown>[] {
  return getDaysOfWeekNames(false).map((dayOfWeekName: string) => {
    return forgeToggleField({
      key: dayOfWeekName.toLowerCase(),
      label: dayOfWeekName,
      styledBox: false
    });
  });
}
