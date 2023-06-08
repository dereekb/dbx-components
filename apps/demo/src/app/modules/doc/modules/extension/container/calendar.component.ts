import { OnInit, Component } from '@angular/core';
import { DbxCalendarEvent, DbxCalendarStore } from '@dereekb/dbx-web/calendar';
import { DateBlock, DateBlockCollection, dateBlockTiming, durationSpanToDateRange, expandDateBlockCollection, systemBaseDateToNormalDate } from '@dereekb/date';
import { addMonths, setHours, startOfDay, addDays, addHours } from 'date-fns/esm';
import { Maybe, TimezoneString, range } from '@dereekb/util';
import { CalendarEvent } from 'angular-calendar';
import { dateScheduleRangeField } from '@dereekb/dbx-form/calendar';
import { BehaviorSubject, of } from 'rxjs';
import { DOC_EXTENSION_CALENDAR_SCHEDULE_TEST_FILTER } from '../component/selection.filter.calendar.component';
import { timezoneStringField } from '@dereekb/dbx-form';
import { FormlyFieldConfig } from '@ngx-formly/core';

export interface TestCalendarEventData extends DateBlock {
  value: string;
}

@Component({
  templateUrl: './calendar.component.html',
  providers: [DbxCalendarStore]
})
export class DocExtensionCalendarComponent implements OnInit {
  private _timezone = new BehaviorSubject<Maybe<TimezoneString>>(undefined);

  readonly timezone$ = this._timezone.asObservable();

  readonly timezoneSelectionField: FormlyFieldConfig[] = [timezoneStringField()];

  readonly onTimezoneChange = (value: { timezone: Maybe<TimezoneString> }) => {
    this._timezone.next(value?.timezone);
  };

  showRight = true;

  event: Maybe<DbxCalendarEvent<TestCalendarEventData>>;

  readonly defaultDateScheduleRangeFieldValue$ = of({
    dateSchedule: {
      start: startOfDay(new Date()),
      end: addDays(startOfDay(new Date()), 14),
      w: '8',
      ex: [0, 3, 4, 5]
    },
    dateScheduleForUtcTimezone: {
      start: startOfDay(new Date()),
      end: addDays(startOfDay(new Date()), 2),
      w: '89'
    },
    dateScheduleForUtcTimezoneWithFilter: {
      start: startOfDay(new Date()),
      end: addDays(startOfDay(new Date()), 2)
    }
  });

  readonly dateScheduleRangeFields = [
    dateScheduleRangeField({
      key: 'dateSchedule',
      required: true,
      label: 'Custom Label',
      timezone: this.timezone$,
      description: 'Input field used for picking a DateScheduleRange value.'
    }),
    dateScheduleRangeField({
      timezone: this.timezone$,
      key: 'dateScheduleWithFilter',
      required: true,
      description: 'Date schedule with a filter applied to it, and an initial selection of everything.',
      filter: DOC_EXTENSION_CALENDAR_SCHEDULE_TEST_FILTER,
      computeSelectionResultRelativeToFilter: true,
      initialSelectionState: 'all'
    }),
    dateScheduleRangeField({
      timezone: this.timezone$,
      key: 'dateScheduleWithMinMaxDateRange',
      required: true,
      description: 'Date schedule with a min and max date range applied to it and all days selected.',
      minMaxDateRange: of({ start: addDays(new Date(), -25), end: addDays(new Date(), 25) }),
      computeSelectionResultRelativeToFilter: true,
      initialSelectionState: 'all'
    }),
    dateScheduleRangeField({
      timezone: this.timezone$,
      key: 'dateScheduleWithFilterAndExclusions',
      required: true,
      description: 'Date schedule with a filter applied to it and additional exclusions.',
      filter: { ...DOC_EXTENSION_CALENDAR_SCHEDULE_TEST_FILTER, w: '89', ex: [] },
      computeSelectionResultRelativeToFilter: true,
      exclusions: [0, 2, 4],
      initialSelectionState: 'all'
    }),
    dateScheduleRangeField({
      timezone: this.timezone$,
      key: 'dateScheduleWithMinDateRange',
      required: true,
      description: 'Date schedule with a filter applied to it and additional exclusions.',
      filter: {
        //
        start: addHours(startOfDay(addDays(new Date(), 1)), 6), // tomorrow at 6AM
        end: addHours(startOfDay(addDays(new Date(), 1)), 18), // tomorrow at 6PM
        w: '89',
        ex: []
      },
      minMaxDateRange: { start: new Date() },
      computeSelectionResultRelativeToFilter: true,
      initialSelectionState: 'all'
    }),
    dateScheduleRangeField({
      key: 'dateScheduleForUtcTimezone',
      required: true,
      description: 'Date schedule for the UTC timezone.',
      timezone: 'UTC'
    }),
    dateScheduleRangeField({
      key: 'dateScheduleForUtcTimezoneWithFilter',
      required: true,
      description: 'Date schedule for the UTC timezone with filter. The timezone is ignored.',
      timezone: 'UTC',
      filter: {
        //
        ...DOC_EXTENSION_CALENDAR_SCHEDULE_TEST_FILTER,
        start: systemBaseDateToNormalDate(startOfDay(new Date())),
        end: systemBaseDateToNormalDate(startOfDay(addDays(new Date(), 3))),
        w: '89',
        ex: []
      }
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
