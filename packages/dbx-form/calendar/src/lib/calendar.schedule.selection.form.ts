import { flexLayoutWrapper, toggleField } from '@dereekb/dbx-form';
import { getDaysOfWeekNames } from '@dereekb/util';

/**
 * Creates form fields for selecting which days of the week are enabled in a schedule selection calendar,
 * wrapped in a responsive flex layout.
 *
 * @returns An array of Formly field configs with toggle fields for each day of the week
 */
export function dbxScheduleSelectionCalendarDateDaysFormFields() {
  const fields = dbxScheduleSelectionCalendarDateDaysFormDayFields();
  return [flexLayoutWrapper(fields, { relative: true, size: 3 })];
}

/**
 * Creates an array of toggle field configs, one for each day of the week, keyed by lowercase day name.
 *
 * @returns An array of toggle Formly field configs for each day of the week
 */
export function dbxScheduleSelectionCalendarDateDaysFormDayFields() {
  return getDaysOfWeekNames(false).map((dayOfWeekName: string) => {
    return toggleField({
      key: dayOfWeekName.toLowerCase(),
      label: dayOfWeekName
    });
  });
}
