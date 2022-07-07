import { formatToTimeAndDurationString } from '@dereekb/date';
import { CalendarEvent } from 'angular-calendar';

export class CalendarUtility {
  static timeSubtitleForEvent(event: CalendarEvent): string {
    let subtitle;

    if (event.allDay) {
      subtitle = `(All Day)`;
    } else {
      subtitle = formatToTimeAndDurationString(event.start, event.end ?? new Date());
    }

    return subtitle;
  }
}
