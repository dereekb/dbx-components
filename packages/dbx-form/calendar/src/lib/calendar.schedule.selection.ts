import { DateBlockIndex, DateBlockRangeWithRange, DateRange, DateScheduleRange } from '@dereekb/date';
import { FactoryWithRequiredInput } from '@dereekb/util';
import { CalendarMonthViewDay } from 'angular-calendar';

export interface CalendarScheduleSelectionValue {
  /**
   * Schedule range.
   */
  dateScheduleRange: DateScheduleRange;
  /**
   * Min and max dates in the selection.
   */
  minMaxRange: DateRange;
}

export enum CalendarScheduleSelectionDayState {
  NOT_APPLICABLE = 0,
  DISABLED = 1,
  NOT_SELECTED = 2,
  SELECTED = 3
}

export interface CalendarScheduleSelectionMetadata {
  state: CalendarScheduleSelectionDayState;
  i: DateBlockIndex;
}

export interface CalendarScheduleSelectionCellContent {
  icon?: string;
  text?: string;
}

export type CalendarScheduleSelectionCellContentFactory = FactoryWithRequiredInput<CalendarScheduleSelectionCellContent, CalendarMonthViewDay<CalendarScheduleSelectionMetadata>>;

export const defaultCalendarScheduleSelectionCellContentFactory: CalendarScheduleSelectionCellContentFactory = (day: CalendarMonthViewDay<CalendarScheduleSelectionMetadata>) => {
  let icon;
  let text;

  switch (day.meta?.state) {
    case CalendarScheduleSelectionDayState.SELECTED:
      icon = 'check_box';
      break;
    case CalendarScheduleSelectionDayState.DISABLED:
      icon = 'block';
      break;
    case CalendarScheduleSelectionDayState.NOT_APPLICABLE:
      break;
    case CalendarScheduleSelectionDayState.NOT_SELECTED:
      icon = 'check_box_outline_blank';
      text = 'Add';
      break;
  }

  return {
    icon,
    text
  };
};
