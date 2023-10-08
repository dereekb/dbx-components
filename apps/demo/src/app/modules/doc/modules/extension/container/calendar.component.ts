import { OnInit, Component } from '@angular/core';
import { DbxCalendarEvent, DbxCalendarStore } from '@dereekb/dbx-web/calendar';
import { DateCell, DateCellCollection, dateCellTiming, durationSpanToDateRange, expandDateCellCollection, expandDateCellScheduleDayCodes, systemBaseDateToNormalDate } from '@dereekb/date';
import { addMonths, setHours, startOfDay, addDays, addHours } from 'date-fns/esm';
import { Building, Maybe, TimezoneString, isEvenNumber, range } from '@dereekb/util';
import { CalendarEvent } from 'angular-calendar';
import { CalendarScheduleSelectionDayState, DbxScheduleSelectionCalendarComponentConfig, dateScheduleRangeField } from '@dereekb/dbx-form/calendar';
import { BehaviorSubject, interval, map, of, shareReplay, startWith } from 'rxjs';
import { DOC_EXTENSION_CALENDAR_SCHEDULE_TEST_FILTER } from '../component/selection.filter.calendar.component';
import { timezoneStringField } from '@dereekb/dbx-form';
import { FormlyFieldConfig } from '@ngx-formly/core';

export interface TestCalendarEventData extends DateCell {
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
      key: 'futureDateSchedule',
      required: false,
      label: 'Future Dates',
      timezone: this.timezone$,
      defaultScheduleDays: expandDateCellScheduleDayCodes('8'),
      minMaxDateRange: {
        start: startOfDay(new Date())
      },
      description: 'Simple date schedule that requires picking dates in the future.'
    }),
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
      description: 'Date schedule with a filter applied to it, and an initial selection of everything. Contains custom close config.',
      filter: DOC_EXTENSION_CALENDAR_SCHEDULE_TEST_FILTER,
      computeSelectionResultRelativeToFilter: true,
      initialSelectionState: 'all',
      dialogContentConfig: {
        dialogConfig: {
          panelClass: 'hello-world dbx-schedule-selection-calendar-compact',
          maxWidth: '420px'
        },
        closeConfig: {
          closeText: 'Save Changes',
          buttonColor: 'primary'
        }
      }
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
      key: 'dateScheduleWithTimingFilterAndMinDateRange',
      required: true,
      description: 'Date schedule with a filter and an explicit min date to be 4 days from now',
      filter: { ...DOC_EXTENSION_CALENDAR_SCHEDULE_TEST_FILTER, w: '89', ex: [] },
      minMaxDateRange: { start: addDays(new Date(), 4) },
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
        startsAt: systemBaseDateToNormalDate(startOfDay(new Date())),
        end: systemBaseDateToNormalDate(startOfDay(addDays(new Date(), 3))),
        w: '89',
        ex: []
      }
    })
  ];

  readonly date$ = this.calendarStore.date$;

  readonly scheduleConfig$ = interval(5000).pipe(
    startWith(0),
    map((i) => {
      const even = isEvenNumber(i);
      const x: Building<DbxScheduleSelectionCalendarComponentConfig> = {
        readonly: even,
        showButtonsOnReadonly: true
      };

      if (even) {
        x.customizeDay = (x, y) => {
          if (x.meta?.state !== CalendarScheduleSelectionDayState.SELECTED) {
            x.backgroundColor = 'red';
          }
        };
      } else {
        x.customizeDay = (x, y) => {
          if (x.meta?.state !== CalendarScheduleSelectionDayState.SELECTED) {
            x.backgroundColor = 'green';
          }
        };
      }

      return x as DbxScheduleSelectionCalendarComponentConfig;
    }),
    shareReplay(1)
  );

  constructor(readonly calendarStore: DbxCalendarStore<TestCalendarEventData>) {}

  ngOnInit(): void {
    function makeEvents(name: string, iFilter = 1, minutes = 90) {
      const now = new Date();
      const days = 90;
      const startsAt = setHours(addMonths(now, -1), 12);

      const timing = dateCellTiming({ startsAt, duration: minutes }, days);
      const eventData: TestCalendarEventData[] = range(0, days).map((i) => {
        const event: TestCalendarEventData = {
          i,
          value: `${i}`
        };

        return event;
      });

      const dateCellCollection: DateCellCollection<TestCalendarEventData> = {
        timing,
        blocks: eventData
      };

      const spans = expandDateCellCollection(dateCellCollection);
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
