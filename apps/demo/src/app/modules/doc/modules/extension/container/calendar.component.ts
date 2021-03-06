import { OnInit, Component } from '@angular/core';
import { DbxCalendarEvent, DbxCalendarStore } from '@dereekb/dbx-web';
import { DateBlock, DateBlockCollection, dateBlockTiming, durationSpanToDateRange, expandDateBlockCollection } from '@dereekb/date';
import { addMonths, setHours } from 'date-fns/esm';
import { Maybe, range } from '@dereekb/util';
import { CalendarEvent } from 'angular-calendar';

export interface TestCalendarEventData extends DateBlock {
  value: string;
}

@Component({
  templateUrl: './calendar.component.html',
  providers: [DbxCalendarStore]
})
export class DocExtensionCalendarComponent implements OnInit {
  showRight = true;

  event: Maybe<DbxCalendarEvent<TestCalendarEventData>>;

  readonly date$ = this.calendarStore.date$;

  constructor(readonly calendarStore: DbxCalendarStore<TestCalendarEventData>) {}

  ngOnInit(): void {
    function makeEvents(name: string, iFilter = 1, minutes = 90) {
      const now = new Date();
      const days = 90;
      const startsAt = setHours(addMonths(now, -1), 12);

      const timing = dateBlockTiming({ startsAt, duration: minutes }, days);
      const eventData: TestCalendarEventData[] = range(0, days).map((i) => {
        const event: TestCalendarEventData = {
          i,
          value: `${i}`
        };

        return event;
      });

      const dateBlockCollection: DateBlockCollection<TestCalendarEventData> = {
        timing,
        blocks: eventData
      };

      const spans = expandDateBlockCollection(dateBlockCollection);
      const events: CalendarEvent<TestCalendarEventData>[] = spans
        .filter((x) => x.i % iFilter)
        .map((x) => {
          const { start, end } = durationSpanToDateRange(x);
          const title = `Event ${name} ${x.i}`;

          return {
            id: x.i,
            title,
            start,
            end,
            meta: x
          };
        });

      return events;
    }

    const events = [...makeEvents('A', 1), ...makeEvents('B', 2, 120), ...makeEvents('C', 3, 200), ...makeEvents('D', 5, 360), ...makeEvents('E', 5, 600), ...makeEvents('F', 6, 30), ...makeEvents('G', 7, 30)];
    this.calendarStore.setEvents(events);
  }
}
