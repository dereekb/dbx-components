import { flexLayoutWrapper, nameField, toggleField } from '@dereekb/dbx-form';
import { getDaysOfWeekNames, DayOfWeek } from '@dereekb/util';

export function dbxScheduleSelectionCalendarDateDaysFormFields() {
  const fields = dbxScheduleSelectionCalendarDateDaysFormDayFields();
  return [flexLayoutWrapper(fields, { relative: true, size: 3 })];
}

export function dbxScheduleSelectionCalendarDateDaysFormDayFields() {
  return getDaysOfWeekNames(false).map((dayOfWeekName: string) => {
    return toggleField({
      key: dayOfWeekName.toLowerCase(),
      label: dayOfWeekName
    });
  });
}
