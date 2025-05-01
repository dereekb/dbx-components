import { OnInit, Component, inject } from '@angular/core';
import { DbxCalendarEvent, DbxCalendarStore } from '@dereekb/dbx-web/calendar';
import { DateCell, DateCellCollection, dateCellTiming, durationSpanToDateRange, expandDateCellCollection, expandDateCellScheduleDayCodes, UTC_DATE_TIMEZONE_UTC_NORMAL_INSTANCE } from '@dereekb/date';
import { addMonths, setHours, startOfDay, addDays } from 'date-fns';
import { Building, Maybe, TimezoneString, isEvenNumber, range } from '@dereekb/util';
import { CalendarEvent } from 'angular-calendar';
import { CalendarScheduleSelectionDayState, DbxScheduleSelectionCalendarComponentConfig, dateScheduleRangeField } from '@dereekb/dbx-form/calendar';
import { BehaviorSubject, interval, map, of, shareReplay, startWith } from 'rxjs';
import { DOC_EXTENSION_CALENDAR_SCHEDULE_TEST_FILTER, DocExtensionCalendarScheduleSelectionWithFilterComponent } from '../component/selection.filter.calendar.component';
import { timezoneStringField } from '@dereekb/dbx-form';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureDerivedComponent } from '../../shared/component/feature.derived.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxCalendarComponent } from '../../../../../../../../../packages/dbx-web/calendar/src/lib/calendar.component';
import { MatButton } from '@angular/material/button';
import { DbxTwoColumnComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/column/two/two.column.component';
import { DbxTwoColumnContextDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/column/two/two.column.context.directive';
import { DbxTwoColumnFullLeftDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/column/two/two.column.full.left.directive';
import { DbxTwoBlockComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/block/two.block.component';
import { DbxTwoColumnRightComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/column/two/two.column.right.component';
import { DocFormExampleComponent } from '../../form/component/example.form.component';
import { DbxFormlyFieldsContextDirective } from '../../../../../../../../../packages/dbx-form/src/lib/formly/formly.context.directive';
import { DbxFormSourceDirective } from '../../../../../../../../../packages/dbx-form/src/lib/form/io/form.input.directive';
import { DbxFormValueChangeDirective } from '../../../../../../../../../packages/dbx-form/src/lib/form/io/form.change.directive';
import { DbxSubSectionComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/section/subsection.component';
import { DocExtensionCalendarScheduleSelectionComponent } from '../component/selection.calendar.component';
import { AsyncPipe, JsonPipe, DatePipe } from '@angular/common';

export interface TestCalendarEventData extends DateCell {
  value: string;
}

@Component({
    templateUrl: './calendar.component.html',
    providers: [DbxCalendarStore],
    standalone: true,
    imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureDerivedComponent, DocFeatureExampleComponent, DbxCalendarComponent, MatButton, DbxTwoColumnComponent, DbxTwoColumnContextDirective, DbxTwoColumnFullLeftDirective, DbxTwoBlockComponent, DbxTwoColumnRightComponent, DocFormExampleComponent, DbxFormlyFieldsContextDirective, DbxFormSourceDirective, DbxFormValueChangeDirective, DbxSubSectionComponent, DocExtensionCalendarScheduleSelectionWithFilterComponent, DocExtensionCalendarScheduleSelectionComponent, AsyncPipe, JsonPipe, DatePipe]
})
export class DocExtensionCalendarComponent implements OnInit {
  readonly calendarStore = inject(DbxCalendarStore<TestCalendarEventData>);

  private _timezone = new BehaviorSubject<Maybe<TimezoneString>>(undefined);

  readonly timezone$ = this._timezone.asObservable();

  readonly timezoneSelectionField: FormlyFieldConfig[] = [timezoneStringField()];

  readonly onTimezoneChange = (value: { timezone: Maybe<TimezoneString> }) => {
    this._timezone.next(value?.timezone);
  };

  showRight = true;

  event: Maybe<DbxCalendarEvent<TestCalendarEventData>>;

  readonly defaultDateCellScheduleRangeFieldValue$ = of({
    // first two
    futureDateSchedule: {
      start: addDays(startOfDay(new Date()), 1),
      end: addDays(startOfDay(new Date()), 3),
      w: '89'
    },
    dateSchedule: {
      start: startOfDay(new Date()),
      end: addDays(startOfDay(new Date()), 14),
      w: '8',
      ex: [0, 3, 4, 5]
    },
    // last two
    dateScheduleForUtcTimezone: {
      start: UTC_DATE_TIMEZONE_UTC_NORMAL_INSTANCE.startOfDayInTargetTimezone(new Date()),
      end: addDays(UTC_DATE_TIMEZONE_UTC_NORMAL_INSTANCE.startOfDayInTargetTimezone(new Date()), 2),
      w: '89'
    },
    dateScheduleForUtcTimezoneWithFilter: {
      start: UTC_DATE_TIMEZONE_UTC_NORMAL_INSTANCE.startOfDayInTargetTimezone(new Date()),
      end: addDays(UTC_DATE_TIMEZONE_UTC_NORMAL_INSTANCE.startOfDayInTargetTimezone(new Date()), 2)
    }
  });

  readonly dateCellScheduleRangeFields = [
    dateScheduleRangeField({
      key: 'futureDateSchedule',
      required: false,
      label: 'Future Dates',
      outputTimezone: this.timezone$,
      defaultScheduleDays: expandDateCellScheduleDayCodes('89'),
      minMaxDateRange: {
        start: startOfDay(new Date())
      },
      description: 'Simple date schedule that requires picking dates in the future.'
    }),
    dateScheduleRangeField({
      key: 'dateSchedule',
      required: true,
      label: 'Custom Label',
      outputTimezone: this.timezone$,
      description: 'Input field used for picking a DateCellScheduleRange value.'
    }),
    dateScheduleRangeField({
      outputTimezone: this.timezone$,
      key: 'dateScheduleWithFilter',
      label: 'Date Schedule with Filter',
      required: false,
      description: 'Date schedule with a filter applied to it, and an initial selection of everything. Contains custom close config.',
      filter: DOC_EXTENSION_CALENDAR_SCHEDULE_TEST_FILTER,
      computeSelectionResultRelativeToFilter: true,
      initialSelectionState: 'all',
      dialogContentConfig: {
        dialogConfig: {
          panelClass: 'dbx-schedule-selection-calendar-compact',
          maxWidth: '540px'
        },
        closeConfig: {
          closeText: 'Save Changes',
          buttonColor: 'primary'
        }
      }
    }),
    dateScheduleRangeField({
      outputTimezone: this.timezone$,
      key: 'dateScheduleWithMinMaxDateRange',
      label: 'Date Schedule with Min/Max Date Range',
      required: false,
      description: 'Date schedule with a min and max date range applied to it and all days selected.',
      minMaxDateRange: of({ start: addDays(new Date(), -25), end: addDays(new Date(), 25) }),
      computeSelectionResultRelativeToFilter: true,
      initialSelectionState: 'all'
    }),
    dateScheduleRangeField({
      outputTimezone: this.timezone$,
      key: 'dateScheduleWithFilterAndExclusions',
      label: 'Date Schedule with Filter and Exclusions',
      required: false,
      description: 'Date schedule with a filter applied to it and additional exclusions.',
      filter: { ...DOC_EXTENSION_CALENDAR_SCHEDULE_TEST_FILTER, w: '89', ex: [] },
      computeSelectionResultRelativeToFilter: true,
      exclusions: [0, 2, 4],
      initialSelectionState: 'all'
    }),
    dateScheduleRangeField({
      outputTimezone: this.timezone$,
      key: 'dateScheduleWithTimingFilterAndMinDateRange',
      label: 'Date Schedule with Timing Filter and Min Date Range',
      required: false,
      description: 'Date schedule with a filter and an explicit min date to be 4 days from now',
      filter: { ...DOC_EXTENSION_CALENDAR_SCHEDULE_TEST_FILTER, w: '89', ex: [] },
      minMaxDateRange: { start: addDays(new Date(), 4) },
      computeSelectionResultRelativeToFilter: true,
      initialSelectionState: 'all'
    }),
    dateScheduleRangeField({
      key: 'dateScheduleForUtcTimezone',
      label: 'Date Schedule for UTC Timezone',
      required: true,
      description: 'Date schedule for the UTC timezone.',
      outputTimezone: 'UTC'
    }),
    dateScheduleRangeField({
      key: 'dateScheduleForUtcTimezoneWithFilter',
      required: true,
      description: 'Date schedule for the timezone with filter. The timezone from the filter is ignored and overridden by the output timezone.',
      outputTimezone: 'UTC',
      filter: {
        //
        ...DOC_EXTENSION_CALENDAR_SCHEDULE_TEST_FILTER,
        startsAt: UTC_DATE_TIMEZONE_UTC_NORMAL_INSTANCE.startOfDayInTargetTimezone(new Date()),
        end: addDays(UTC_DATE_TIMEZONE_UTC_NORMAL_INSTANCE.startOfDayInTargetTimezone(new Date()), 5),
        timezone: 'UTC',
        w: '89',
        ex: []
      }
    })
  ];

  readonly date$ = this.calendarStore.date$;

  readonly singleSelectionConfig: DbxScheduleSelectionCalendarComponentConfig = {};

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
