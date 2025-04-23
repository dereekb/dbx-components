import { DateCellIndex, DateRange, DateCellScheduleDateRange } from '@dereekb/date';
import { FactoryWithRequiredInput } from '@dereekb/util';
import { CalendarMonthViewDay } from 'angular-calendar';

export interface CalendarScheduleSelectionValue {
  /**
   * Schedule range.
   */
  readonly dateScheduleRange: DateCellScheduleDateRange;
  /**
   * Min and max dates in the selection.
   */
  readonly minMaxRange: DateRange;
}

export enum CalendarScheduleSelectionDayState {
  NOT_APPLICABLE = 0,
  DISABLED = 1,
  NOT_SELECTED = 2,
  SELECTED = 3
}

export interface CalendarScheduleSelectionMetadata {
  readonly state: CalendarScheduleSelectionDayState;
  readonly i: DateCellIndex;
}

export interface CalendarScheduleSelectionCellContent {
  readonly icon?: string;
  readonly text?: string;
}

export type CalendarScheduleSelectionCellContentFactory<M extends CalendarScheduleSelectionMetadata = CalendarScheduleSelectionMetadata> = FactoryWithRequiredInput<CalendarScheduleSelectionCellContent, CalendarMonthViewDay<M>>;

export const defaultCalendarScheduleSelectionCellContentFactory: CalendarScheduleSelectionCellContentFactory = (day: CalendarMonthViewDay<CalendarScheduleSelectionMetadata>) => {
  let icon: string | undefined;
  let text: string | undefined;

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

  const result: CalendarScheduleSelectionCellContent = {
    icon,
    text
  };

  return result;
};
