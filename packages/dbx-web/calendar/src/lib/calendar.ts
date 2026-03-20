import { formatToTimeAndDurationString, sortDateRangeStartAscendingCompareFunction } from '@dereekb/date';
import { type CalendarEvent } from 'angular-calendar';

export interface DbxCalendarEvent<T> {
  event: CalendarEvent<T>;
  action?: string;
}

function timeSubtitleForEvent(event: CalendarEvent): string {
  let subtitle;

  if (event.allDay) {
    subtitle = `(All Day)`;
  } else {
    subtitle = formatToTimeAndDurationString(event.start, event.end ?? new Date());
  }

  return subtitle;
}

/**
 * Appends time/duration subtitles to each calendar event's title and sorts the events by start date in ascending order.
 *
 * @param events - The calendar events to prepare and sort.
 * @returns A new array of calendar events with updated titles, sorted by start date.
 */
export function prepareAndSortCalendarEvents(events: CalendarEvent[]): CalendarEvent[] {
  return events
    .map((event: CalendarEvent) => {
      const subtitle = timeSubtitleForEvent(event);
      let title;

      if (event.allDay) {
        title = event.title + ' ' + subtitle;
      } else {
        title = `${event.title} - ${subtitle}`;
      }

      return {
        ...event,
        title
      };
    })
    .sort(sortDateRangeStartAscendingCompareFunction);
}
