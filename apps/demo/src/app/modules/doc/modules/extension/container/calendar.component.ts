import { OnInit } from '@angular/core';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { Component } from '@angular/core';
import { addressField, addressListField, cityField, countryField, emailField, phoneField, nameField, phoneAndLabelSectionField, wrappedPhoneAndLabelField, repeatArrayField, stateField, textAreaField, textField, zipCodeField, phoneListField, dateTimeField, DbxDateTimeFieldTimeMode, toggleField, checkboxField, numberField } from '@dereekb/dbx-form';
import { DbxCalendarStore } from '@dereekb/dbx-web';
import { DateBlock, DateBlockCollection, dateBlockTiming, durationSpanToDateRange, expandDateBlockCollection } from '@dereekb/date';
import { addMonths } from 'date-fns/esm';
import { setHours } from 'date-fns';
import { range } from '@dereekb/util';
import { CalendarEvent } from 'angular-calendar';

export interface TestCalendarEventData extends DateBlock {
  value: string;
}

@Component({
  templateUrl: './calendar.component.html',
  providers: [DbxCalendarStore]
})
export class DocExtensionCalendarComponent implements OnInit {
  constructor(readonly calendarStore: DbxCalendarStore<TestCalendarEventData>) {}

  ngOnInit(): void {
    const now = new Date();
    const days = 90;
    const startsAt = setHours(addMonths(now, -1), 12);

    const timing = dateBlockTiming({ startsAt, duration: 10 }, days);
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
      .filter((x) => x.i % 2)
      .map((x) => {
        const { start, end } = durationSpanToDateRange(x);
        const title = `Event ${x.i}`;

        return {
          id: x.i,
          title,
          start,
          end,
          meta: x
        };
      });

    this.calendarStore.setEvents(events);
  }
}
