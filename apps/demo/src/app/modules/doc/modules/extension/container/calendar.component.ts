import { OnInit, Component } from '@angular/core';
import { DbxCalendarEvent, DbxCalendarStore } from '@dereekb/dbx-web/calendar';
import { DateBlock, DateBlockCollection, dateBlockTiming, durationSpanToDateRange, expandDateBlockCollection } from '@dereekb/date';
import { addMonths, setHours, startOfDay, addDays } from 'date-fns/esm';
import { Maybe, range } from '@dereekb/util';
import { CalendarEvent } from 'angular-calendar';
import { dateScheduleRangeField } from '@dereekb/dbx-form/calendar';
import { of } from 'rxjs';
import { DOC_EXTENSION_CALENDAR_SCHEDULE_TEST_FILTER } from '../component/selection.filter.calendar.component';

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

  readonly defaultDateScheduleRangeFieldValue$ = of({
    dateSchedule: {
      start: startOfDay(new Date()),
      end: addDays(startOfDay(new Date()), 14),
      w: '8',
      ex: [0, 3, 4, 5]
    }
  });

  readonly dateScheduleRangeFields = [
    dateScheduleRangeField({
      key: 'dateSchedule',
      required: true,
      label: 'Custom Label',
      description: 'Input field used for picking a DateScheduleRange value.'
    }),
    dateScheduleRangeField({
      key: 'dateScheduleWithFilter',
      required: true,
      description: 'Date schedule with a filter applied to it',
      filter: DOC_EXTENSION_CALENDAR_SCHEDULE_TEST_FILTER
    })
  ];

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
